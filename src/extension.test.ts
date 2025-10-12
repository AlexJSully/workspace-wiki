import * as assert from 'assert';
import { WorkspaceWikiTreeProvider, scanWorkspaceDocs } from './extension';

class MockEventEmitter {
	public event = () => {};
	fire() {}
}

describe('scanWorkspaceDocs', () => {
	it('should return an array of Uri-like objects', async () => {
		const mockWorkspace = {
			findFiles: async (pattern: string) => [{ fsPath: `/fake/path/doc.${pattern.split('.').pop()}` }],
		};
		const docs = await scanWorkspaceDocs(mockWorkspace);
		assert.ok(Array.isArray(docs));
		for (const uri of docs) {
			assert.ok(uri && typeof uri.fsPath === 'string');
		}
	});

	it('should only return files with supported extensions', async () => {
		const mockWorkspace = {
			findFiles: async (pattern: string) => [{ fsPath: `/fake/path/doc.${pattern.split('.').pop()}` }],
		};
		const docs = await scanWorkspaceDocs(mockWorkspace);
		for (const uri of docs) {
			const ext = uri.fsPath.split('.').pop()?.toLowerCase();
			assert.ok(['md', 'markdown', 'txt'].includes(ext ?? ''));
		}
	});
});

describe('WorkspaceWikiTreeProvider', () => {
	it('should instantiate and return tree items', async () => {
		const mockWorkspace = {
			findFiles: async (pattern: string) => [{ fsPath: `/fake/path/doc.${pattern.split('.').pop()}` }],
		};
		const MockTreeItem = function (uri: any, _state: any) {
			return {
				label: uri.fsPath.split('/').pop(),
				tooltip: uri.fsPath,
				command: { command: 'open', arguments: [uri] },
			};
		};
		const provider = new WorkspaceWikiTreeProvider(mockWorkspace, MockTreeItem, { None: 0 }, MockEventEmitter);
		const children = await provider.getChildren();
		assert.ok(Array.isArray(children));
		assert.ok(children.length > 0);
		assert.ok(children[0].label);
	});

	it('should return no children for a leaf node', async () => {
		const mockWorkspace = {
			findFiles: async () => [],
		};
		const MockTreeItem = function () {
			return {};
		};
		const provider = new WorkspaceWikiTreeProvider(mockWorkspace, MockTreeItem, { None: 0 }, MockEventEmitter);
		const leaf = { label: 'Leaf', tooltip: 'Leaf', command: undefined };
		const children = await provider.getChildren(leaf);
		assert.deepStrictEqual(children, []);
	});
});
