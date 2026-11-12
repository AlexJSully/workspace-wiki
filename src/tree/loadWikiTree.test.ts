import { createMockUri, createMockWorkspace } from '../test/mocks';
import { INDEXED_FILES_CONTEXT, loadWikiTree } from './loadWikiTree';

describe('loadWikiTree', () => {
	const files = ['/workspace-root/zeta.md', '/workspace-root/api/index.md', '/workspace-root/README.md'].map(
		createMockUri,
	);

	it('builds the tree from the scan with the configured sort and acronyms', async () => {
		const workspace = createMockWorkspace(
			{ directorySort: 'folders-first', acronymCasing: ['API'], supportedExtensions: ['md'] },
			{ files: (pattern) => (pattern === '**/*.md' ? files : []) },
		);

		const tree = await loadWikiTree(workspace);

		expect(tree.map((node) => node.title)).toEqual(['README', 'API', 'Zeta']);
	});

	it('uses files-first and no acronyms when the workspace has no settings', async () => {
		const workspace = createMockWorkspace({}, { files: (pattern) => (pattern === '**/*.md' ? files : []) });
		delete workspace.getConfiguration;

		const tree = await loadWikiTree(workspace);

		expect(tree.map((node) => node.title)).toEqual(['README', 'Zeta', 'Api']);
	});

	it('publishes every file, and no folder, as the indexed-files context key', async () => {
		const vscode = require('vscode');
		const workspace = createMockWorkspace({}, { files: (pattern) => (pattern === '**/*.md' ? files : []) });

		await loadWikiTree(workspace);

		const [, key, indexedFiles] = vscode.commands.executeCommand.mock.calls.at(-1);
		expect(key).toBe(INDEXED_FILES_CONTEXT);
		expect(Object.keys(indexedFiles).sort()).toEqual(files.map((uri) => uri.toString()).sort());
	});

	it('publishes an empty index when the scan finds nothing', async () => {
		const vscode = require('vscode');
		const workspace = createMockWorkspace({}, { files: () => [] });

		await loadWikiTree(workspace);

		expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith('setContext', INDEXED_FILES_CONTEXT, {});
	});
});
