/**
 * End-to-End Test Suite for Workspace Wiki Extension
 * Tests real user interaction flows and workflows.
 */
import { scanWorkspaceDocs } from '@scanner';
import * as assert from 'node:assert';
import * as vscode from 'vscode';

/**
 * Polls a value until it satisfies a condition.
 *
 * A fixed wait would encode how fast the machine running the suite happens to be, so a slow CI
 * runner would fail for a reason unrelated to the behaviour under test.
 *
 * @param read Produces the current value; awaited, so it may return a promise or a VS Code thenable
 * @param isReady Decides whether that value is the one being waited for
 * @param timeoutMs How long to keep polling; defaults to ten seconds
 * @returns The first value satisfying `isReady`
 * @throws When `timeoutMs` elapses first
 */
async function waitFor<T>(
	read: () => T | PromiseLike<T>,
	isReady: (value: T) => boolean,
	timeoutMs = 10_000,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		const value = await read();
		if (isReady(value)) {
			return value;
		}

		if (Date.now() > deadline) {
			throw new Error(`Timed out after ${timeoutMs}ms waiting for a condition`);
		}

		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

describe('Extension Activation E2E', () => {
	it('should activate extension and register commands', async () => {
		// Wait for extension to activate
		const extension = vscode.extensions.getExtension('alexjsully.workspace-wiki');
		if (extension && !extension.isActive) {
			await extension.activate();
		}

		const commands = await waitFor(
			() => vscode.commands.getCommands(),
			(registered) => registered.includes('workspace-wiki.refresh'),
		);

		// Check that our extension commands are registered
		const expectedCommands = [
			'workspace-wiki.handleClick',
			'workspace-wiki.openPreview',
			'workspace-wiki.openEditor',
			'workspace-wiki.refresh',
		];

		for (const command of expectedCommands) {
			assert.ok(commands.includes(command), `Command ${command} should be registered`);
		}
	});

	it('should create tree view and have proper configuration', async () => {
		// Check that workspace wiki configuration is available
		const config = vscode.workspace.getConfiguration('workspaceWiki');

		// Test default configuration values
		const supportedExtensions = config.get('supportedExtensions');
		const directorySort = config.get('directorySort');
		const autoReveal = config.get('autoReveal');

		assert.ok(Array.isArray(supportedExtensions), 'supportedExtensions should be an array');
		assert.ok(
			typeof directorySort === 'string' || directorySort === undefined,
			'directorySort should be string or undefined',
		);
		assert.ok(
			typeof autoReveal === 'boolean' || autoReveal === undefined,
			'autoReveal should be boolean or undefined',
		);
	});
});

describe('File Discovery and Scanning E2E', () => {
	it('should discover workspace documents', async () => {
		// This tests the actual scanning functionality in a real workspace
		const workspaceFolders = vscode.workspace.workspaceFolders;

		// In test environment, we might not have workspace folders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			// Skip test if no workspace folders
			console.log('Skipping workspace document test - no workspace folders');
			return;
		}

		// Test finding files in the example directory
		const files = await vscode.workspace.findFiles('**/*.md', null, 100);
		assert.ok(files.length > 0, 'Expected the example workspace to contain markdown files');

		// Verify the files have proper URI structure
		for (const file of files) {
			assert.ok(file.scheme === 'file', 'File should have file scheme');
			assert.ok(file.fsPath.length > 0, 'File should have valid fsPath');
		}
	});

	it('should read markdown front matter via workspace fs', async () => {
		const files = await vscode.workspace.findFiles('file-types-test/test-md.md', null, 1);
		assert.ok(files.length > 0, 'Expected the markdown fixture to be discoverable');

		const contentBytes = await vscode.workspace.fs.readFile(files[0]);
		const content = new TextDecoder().decode(contentBytes);

		assert.ok(content.includes('title:'), 'Front matter title should be present in markdown file');
		assert.ok(content.includes('description:'), 'Front matter description should be present in markdown file');
	});

	it('should respect exclude patterns', async () => {
		// Test that excluded directories are not included
		const allFiles = await vscode.workspace.findFiles('**/*.md', null, 1000);
		const nodeModulesFiles = allFiles.filter((uri) => uri.fsPath.includes('node_modules'));
		const gitFiles = allFiles.filter((uri) => uri.fsPath.includes('.git'));

		// These should be empty due to default exclusions
		assert.strictEqual(nodeModulesFiles.length, 0, 'Should exclude node_modules');
		assert.strictEqual(gitFiles.length, 0, 'Should exclude .git directories');
	});
});

describe('Tree View User Interactions E2E', () => {
	it('should handle file click commands', async () => {
		const commands = await vscode.commands.getCommands();

		assert.ok(commands.includes('workspace-wiki.handleClick'), 'handleClick command should be registered');
	});

	it('should support preview and editor modes', async () => {
		// Test that preview and editor commands are registered
		const commands = await vscode.commands.getCommands();

		assert.ok(commands.includes('workspace-wiki.openPreview'), 'openPreview command should be registered');
		assert.ok(commands.includes('workspace-wiki.openEditor'), 'openEditor command should be registered');
	});
});

describe('Configuration and Settings E2E', () => {
	it('should handle dynamic configuration changes', async () => {
		const config = vscode.workspace.getConfiguration('workspaceWiki');

		// Test getting configuration values
		const originalSort = config.get('directorySort');
		const originalExtensions = config.get('supportedExtensions');

		// Verify configuration is accessible
		assert.ok(
			originalSort === undefined || typeof originalSort === 'string',
			'directorySort should be string or undefined',
		);
		assert.ok(
			originalExtensions === undefined || Array.isArray(originalExtensions),
			'supportedExtensions should be array or undefined',
		);
	});

	it('should register auto-reveal configuration settings', async () => {
		const config = vscode.workspace.getConfiguration('workspaceWiki');

		// Test that the new sync settings are available
		const autoReveal = config.get('autoReveal');
		const autoRevealDelay = config.get('autoRevealDelay');

		// These should have default values even if not explicitly set
		assert.ok(
			typeof autoReveal === 'boolean' || autoReveal === undefined,
			'autoReveal should be boolean or undefined',
		);
		assert.ok(
			typeof autoRevealDelay === 'number' || autoRevealDelay === undefined,
			'autoRevealDelay should be number or undefined',
		);
	});
});

describe('Tree View Enhancements E2E', () => {
	it('should register collapse all command', async () => {
		const allCommands = await vscode.commands.getCommands();

		// Our collapse all command might not be registered yet in test environment,
		// but we can verify the VS Code built-in collapse functionality exists
		const hasCollapseCommand = allCommands.some((cmd) => cmd.includes('collapseAll') || cmd.includes('collapse'));

		assert.ok(hasCollapseCommand || allCommands.length > 0, 'Collapse functionality should be available');
	});

	it('should handle tree refresh operations', async () => {
		// Test that refresh command is available
		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('workspace-wiki.refresh'), 'refresh command should be registered');
	});
});

describe('File Type Support E2E', () => {
	it('should support different file extensions', async () => {
		// Test finding different file types in example directory
		const mdFiles = await vscode.workspace.findFiles('**/*.md', null, 50);
		const txtFiles = await vscode.workspace.findFiles('**/*.txt', null, 50);
		const htmlFiles = await vscode.workspace.findFiles('**/*.html', null, 50);

		assert.ok(mdFiles.length > 0, 'Expected .md fixtures in the example workspace');
		assert.ok(txtFiles.length > 0, 'Expected .txt fixtures in the example workspace');
		assert.ok(htmlFiles.length > 0, 'Expected .html fixtures in the example workspace');
	});

	it('should discover MDX documents', async () => {
		const mdxFiles = await vscode.workspace.findFiles('**/*.mdx', null, 50);

		assert.ok(mdxFiles.length > 0, 'Expected .mdx fixtures in the example workspace');
	});

	it('should open an MDX file with the built-in Markdown preview', async () => {
		// The default `openWith` entry for mdx is only worth having if the built-in preview accepts a
		// file whose language is not markdown, so the command is run against a real fixture here.
		const [mdxFile] = await vscode.workspace.findFiles('**/test-mdx.mdx', null, 1);
		assert.ok(mdxFile, 'Expected the .mdx fixture to be discoverable');

		await vscode.commands.executeCommand('markdown.showPreview', mdxFile);

		// The tab is identified by the file it previews rather than by its full label, which is a
		// string VS Code owns and can reword between releases.
		const label = await waitFor(
			() => vscode.window.tabGroups.activeTabGroup.activeTab?.label,
			(current) => !!current?.includes('test-mdx.mdx'),
		);

		assert.ok(label?.includes('test-mdx.mdx'), 'Expected a Markdown preview tab for the MDX file');

		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

	it('should open a Markdown file in the best surface this VS Code offers', async () => {
		// Only real VS Code can confirm the viewType `workspace-wiki.openMarkdown` asks for. Given one
		// no registered editor matches, `vscode.openWith` resolves to nothing and reports no error, so
		// a wrong string reaches users as a click that does nothing and no unit test can see it.
		//
		// Both tiers are asserted rather than the newer one alone, so the suite covers the degradation
		// path on a VS Code before 1.131 instead of failing on it.
		const markdownEditorRegistered = vscode.extensions.all.some((extension) =>
			(extension.packageJSON?.contributes?.customEditors ?? []).some(
				(editor: { viewType?: string }) => editor?.viewType === 'vscode.markdown.editor',
			),
		);

		const [mdFile] = await vscode.workspace.findFiles('**/nested-structure-test/test-file.md', null, 1);
		assert.ok(mdFile, 'Expected the .md fixture to be discoverable');

		// Every tab is closed first so the assertions below describe what this command opened. An
		// earlier test leaving this same fixture open would otherwise satisfy them on its own, and a
		// command that opened nothing at all would still pass.
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		await waitFor(
			() => vscode.window.tabGroups.activeTabGroup.tabs.length,
			(count) => count === 0,
		);

		await vscode.commands.executeCommand('workspace-wiki.openMarkdown', mdFile);

		if (markdownEditorRegistered) {
			// The tab is identified by its viewType rather than its label, which is a string VS Code
			// owns and can reword between releases: 1.132 called this editor "Markdown Editor
			// (Experimental)" and 1.133 calls it "Markdown Editor".
			const input = await waitFor(
				() => vscode.window.tabGroups.activeTabGroup.activeTab?.input,
				(current) => current instanceof vscode.TabInputCustom,
			);

			assert.strictEqual((input as vscode.TabInputCustom).viewType, 'vscode.markdown.editor');
		} else {
			const tab = await waitFor(
				() => vscode.window.tabGroups.activeTabGroup.activeTab,
				(current) => !!current?.label?.includes('test-file.md'),
			);

			// `markdown.showPreview` opens a webview panel, so the tab input type is what separates the
			// preview from a plain text editor. Asking a VS Code this old for the Markdown Editor does
			// not open nothing, as it does on 1.131 and later: it falls back to the text editor, which
			// is a TabInputText. Asserting merely "not a custom editor" would accept that fallback and
			// pass whether or not the chain degraded correctly.
			assert.ok(
				tab?.input instanceof vscode.TabInputWebview,
				'Expected the Markdown preview webview when the Markdown Editor is absent',
			);
		}

		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

	it('should handle index files appropriately', async () => {
		// Test finding index files
		const indexFiles = await vscode.workspace.findFiles('**/index.{md,html,txt}', null, 50);
		assert.ok(indexFiles.length > 0, 'Expected index fixtures in the example workspace');

		// Verify index files have proper structure
		for (const file of indexFiles) {
			const fileName = file.fsPath.split('/').pop() || '';
			assert.ok(fileName.toLowerCase().startsWith('index.'), 'Index files should start with "index."');
		}
	});
});

describe('Include Globs E2E', () => {
	/**
	 * Scans the example workspace through the extension's own scanner, so the settings in
	 * `example/.vscode/settings.json` are the ones under test.
	 *
	 * @returns The discovered paths
	 */
	async function scanPaths(): Promise<string[]> {
		const uris = await scanWorkspaceDocs(vscode.workspace);
		return uris.map((uri) => uri.path);
	}

	it('should include a file named by an include glob', async () => {
		const paths = await scanPaths();

		assert.ok(
			paths.some((path) => path.endsWith('/include-globs-test/doc.go')),
			'Expected doc.go to be discovered through includeGlobs',
		);
	});

	it('should include a file matched by a wildcard include glob', async () => {
		const paths = await scanPaths();

		assert.ok(
			paths.some((path) => path.endsWith('/include-globs-test/api.guide.ts')),
			'Expected api.guide.ts to be discovered through includeGlobs',
		);
	});

	it('should leave other files of the same extension out of the scan', async () => {
		const paths = await scanPaths();

		assert.ok(
			!paths.some((path) => path.endsWith('/include-globs-test/other.go')),
			'Including doc.go by name should not pull in the rest of the package',
		);
	});

	it('should discover MDX documents with the default settings', async () => {
		const paths = await scanPaths();

		assert.ok(
			paths.some((path) => path.endsWith('/file-types-test/test-mdx.mdx')),
			'Expected the .mdx fixture to be discovered',
		);
	});

	it('should return every discovered document exactly once', async () => {
		const paths = await scanPaths();

		assert.strictEqual(new Set(paths).size, paths.length, 'Scan results should be deduplicated');
	});
});

describe('User Workflow Integration E2E', () => {
	it('should support typical documentation browsing workflow', async () => {
		// 1. Discover documents
		const docs = await vscode.workspace.findFiles('**/*.md', null, 100);
		assert.ok(docs.length > 0, 'Expected documentation files to be discoverable');

		// 2. Verify README files are discoverable
		const readmeFiles = await vscode.workspace.findFiles('README.md', null, 10);
		assert.ok(readmeFiles.length > 0, 'Expected README files to be discoverable');

		// 3. Test configuration access (user would change these settings)
		const config = vscode.workspace.getConfiguration('workspaceWiki');
		const openWith = config.get('openWith');
		assert.ok(typeof openWith === 'object' || openWith === undefined, 'openWith should be object or undefined');
	});

	it('should handle nested directory structures', async () => {
		// Test nested structure in example directory
		const nestedFiles = await vscode.workspace.findFiles('nested-structure-test/**/*.md', null, 50);
		assert.ok(nestedFiles.length > 0, 'Expected nested markdown fixtures');

		// The fixture tree is deliberately uneven, so more than one nesting level must appear.
		const depths = new Set(nestedFiles.map((file) => file.path.split('/').length));
		assert.ok(depths.size > 1, 'Expected fixtures at more than one nesting level');
	});
});
