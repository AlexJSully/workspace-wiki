import { createMockUri, createMockWorkspace } from '../test/mocks';
import { loadWikiTree } from './loadWikiTree';

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
});
