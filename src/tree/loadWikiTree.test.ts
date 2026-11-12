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

		expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith(
			'setContext',
			INDEXED_FILES_CONTEXT,
			Object.fromEntries(files.map((uri) => [uri.toString(), true])),
		);
	});

	it('publishes the newest load when an older, slower load finishes after it', async () => {
		const vscode = require('vscode');
		const olderFiles = [createMockUri('/workspace-root/old.md')];
		const newerFiles = [createMockUri('/workspace-root/new.md')];
		let releaseOlder!: () => void;
		const olderGate = new Promise<void>((resolve) => {
			releaseOlder = resolve;
		});
		const olderBase = createMockWorkspace({}, { files: (pattern) => (pattern === '**/*.md' ? olderFiles : []) });
		const older = {
			...olderBase,
			findFiles: async (...args: Parameters<typeof olderBase.findFiles>) => {
				await olderGate;
				return olderBase.findFiles(...args);
			},
		};
		const newer = createMockWorkspace({}, { files: (pattern) => (pattern === '**/*.md' ? newerFiles : []) });

		const olderLoad = loadWikiTree(older);
		await loadWikiTree(newer);
		releaseOlder();
		await olderLoad;

		expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith('setContext', INDEXED_FILES_CONTEXT, {
			[newerFiles[0].toString()]: true,
		});
	});

	it('publishes an empty index when the scan finds nothing', async () => {
		const vscode = require('vscode');
		const workspace = createMockWorkspace({}, { files: () => [] });

		await loadWikiTree(workspace);

		expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith('setContext', INDEXED_FILES_CONTEXT, {});
	});
});
