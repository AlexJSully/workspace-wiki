/**
 * Web extension host smoke suite.
 *
 * Covers what genuinely differs in a browser: that the bundle loads at all, that reads go through
 * `vscode.workspace.fs`, and that nothing depends on `fsPath`. Broad behaviour is already covered
 * by the Jest and desktop E2E suites, so this stays deliberately small.
 */
import { buildIgnoreIndex } from '@scanner';
import { scanWorkspaceDocs } from '@scanner';
import { buildTree } from '@tree';
import { extractFrontMatter } from '@utils';
import * as vscode from 'vscode';
import { ok, runRegistered, strictEqual, test } from './runner';

/**
 * Returns the first workspace folder, failing the test if there is none.
 *
 * @returns The workspace folder URI
 */
function requireWorkspaceFolder(): vscode.Uri {
	const folders = vscode.workspace.workspaceFolders;
	ok(folders && folders.length > 0, 'Web tests need an open workspace folder');
	return folders[0].uri;
}

test('activates the extension in the web extension host', async () => {
	const extension = vscode.extensions.getExtension('alexjsully.workspace-wiki');
	ok(extension, 'Extension should be present in the web host');

	if (!extension.isActive) {
		await extension.activate();
	}

	ok(extension.isActive, 'Extension should activate');
});

test('registers its commands', async () => {
	const commands = await vscode.commands.getCommands();

	for (const command of [
		'workspace-wiki.handleClick',
		'workspace-wiki.openPreview',
		'workspace-wiki.openEditor',
		'workspace-wiki.refresh',
	]) {
		ok(commands.includes(command), `Command ${command} should be registered`);
	}
});

test('reads front matter through workspace.fs', async () => {
	// Filter by name rather than globbing for it: the test-web file system provider does not
	// support filename-specific globs, and this test is about the read, not about search.
	const files = await vscode.workspace.findFiles('**/*.md', null, 200);
	const fixture = files.find((uri) => uri.path.endsWith('/test-md.md'));
	ok(fixture, 'Expected the markdown fixture to be discoverable');

	// Reads through the discovered URI directly, so the workspace scheme reaches `workspace.fs`.
	const frontMatter = await extractFrontMatter(fixture);

	strictEqual(frontMatter.title, 'Test Markdown `.md` File', 'Front matter title should be read');
	ok(frontMatter.description, 'Front matter description should be read');
});

test('scans documents and builds a tree carrying the workspace scheme', async () => {
	const folderUri = requireWorkspaceFolder();

	const uris = await scanWorkspaceDocs(vscode.workspace);
	ok(uris.length > 0, 'Scan should discover documents');

	for (const uri of uris) {
		strictEqual(uri.scheme, folderUri.scheme, 'Discovered URIs should keep the workspace scheme');
	}

	const tree = await buildTree(uris);
	ok(tree.length > 0, 'Tree should have root nodes');

	/**
	 * Walks the tree asserting every node carries a usable URI.
	 *
	 * @param nodes The nodes to check
	 */
	const assertNodeUris = (nodes: typeof tree): void => {
		for (const node of nodes) {
			ok(node.uri, `Node ${node.name} should have a URI`);
			strictEqual(node.uri.scheme, folderUri.scheme, `Node ${node.name} should keep the workspace scheme`);
			if (node.children) {
				assertNodeUris(node.children);
			}
		}
	};

	assertNodeUris(tree);
});

test('discovers and applies .gitignore rules', async () => {
	const folderUri = requireWorkspaceFolder();

	// Proves `findFiles` surfaces dotfiles here and that the rules parse — a host that hid
	// `.gitignore` would leave the extension silently unfiltered.
	const index = await buildIgnoreIndex(vscode.workspace, []);

	strictEqual(
		index.isIgnored(vscode.Uri.joinPath(folderUri, 'ignore-me.md')),
		true,
		'A file named in .gitignore should be reported ignored',
	);
	strictEqual(
		index.isIgnored(vscode.Uri.joinPath(folderUri, 'ignore-folder', 'nested.md')),
		true,
		'A file inside an ignored folder should be reported ignored',
	);
	strictEqual(
		index.isIgnored(vscode.Uri.joinPath(folderUri, 'README.md')),
		false,
		'An untracked-by-gitignore file should not be reported ignored',
	);
});

/**
 * Entry point invoked by `@vscode/test-web` via `--extensionTestsPath`.
 *
 * @returns Resolves when every case passes, rejects otherwise
 */
export function run(): Promise<void> {
	return runRegistered();
}
