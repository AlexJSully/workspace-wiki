import { scanWorkspaceDocs } from '../scanner';
import { createMockUri } from '../test/mocks';
import { buildTree } from '../tree/buildTree';
import { WorkspaceWikiTreeProvider } from '../tree/treeProvider';

// Mock the scanner module
jest.mock('../scanner', () => ({
	scanWorkspaceDocs: jest.fn(),
}));

// Mock the buildTree module
jest.mock('../tree/buildTree', () => ({
	buildTree: jest.fn(),
}));

const mockScanWorkspaceDocs = scanWorkspaceDocs as jest.MockedFunction<typeof scanWorkspaceDocs>;
const mockBuildTree = buildTree as jest.MockedFunction<typeof buildTree>;

// Mock TreeNode interface for testing
interface MockTreeNode {
	type: 'file' | 'folder';
	name: string;
	title: string;
	path: string;
	uri?: any;
	children?: MockTreeNode[];
	isIndex?: boolean;
	isReadme?: boolean;
	description?: string;
}

// Mock implementations
const createMockTreeItem = (label: string, collapsibleState: any) => ({
	label,
	collapsibleState,
	tooltip: '',
	resourceUri: undefined,
	contextValue: undefined,
	command: undefined,
});

const createMockEventEmitter = () => ({
	event: jest.fn(),
	fire: jest.fn(),
	dispose: jest.fn(),
});

const createMockWorkspace = (config: any = {}) => ({
	findFiles: jest.fn().mockResolvedValue([]),
	getConfiguration: jest.fn().mockReturnValue({
		get: jest.fn().mockImplementation((key: string) => config[key]),
	}),
});

describe('WorkspaceWikiTreeProvider', () => {
	let provider: WorkspaceWikiTreeProvider;
	let mockWorkspace: any;
	let mockTreeItem: any;
	let mockCollapsibleState: any;
	let mockEventEmitter: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockWorkspace = createMockWorkspace();
		mockTreeItem = jest.fn().mockImplementation(createMockTreeItem);
		mockCollapsibleState = {
			None: 0,
			Collapsed: 1,
			Expanded: 2,
		};
		mockEventEmitter = jest.fn().mockImplementation(createMockEventEmitter);

		provider = new WorkspaceWikiTreeProvider(mockWorkspace, mockTreeItem, mockCollapsibleState, mockEventEmitter);
	});

	describe('constructor', () => {
		it('should initialize provider with required dependencies', () => {
			expect(provider).toBeDefined();
			expect(provider.onDidChangeTreeData).toBeDefined();
		});

		it('should create event emitter for tree data changes', () => {
			expect(mockEventEmitter).toHaveBeenCalled();
		});
	});

	describe('getChildren', () => {
		it('should return children for a specific element', async () => {
			const mockNode: MockTreeNode = {
				type: 'folder',
				name: 'docs',
				title: 'Docs',
				path: '/workspace-root/docs',
				children: [
					{
						type: 'file',
						name: 'test.md',
						title: 'Test',
						path: '/workspace-root/docs/test.md',
						uri: createMockUri('/workspace-root/docs/test.md'),
					},
				],
			};

			const mockElement = { treeNode: mockNode };
			const result = await provider.getChildren(mockElement);

			expect(result).toHaveLength(1);
			expect(mockTreeItem).toHaveBeenCalledWith('Test', mockCollapsibleState.None);
		});

		it('should return root level items when no element provided', async () => {
			const mockUris = [createMockUri('/workspace-root/test.md')];
			const mockTreeData: MockTreeNode[] = [
				{
					type: 'file',
					name: 'test.md',
					title: 'Test',
					path: '/workspace-root/test.md',
					uri: mockUris[0],
				},
			];

			mockScanWorkspaceDocs.mockResolvedValue(mockUris);
			mockBuildTree.mockResolvedValue(mockTreeData);

			const result = await provider.getChildren();

			expect(mockScanWorkspaceDocs).toHaveBeenCalledWith(mockWorkspace);
			expect(mockBuildTree).toHaveBeenCalledWith(mockUris, 'files-first', []);
			expect(result).toHaveLength(1);
		});

		it('should use configuration for directory sort and acronyms', async () => {
			const mockConfig = {
				directorySort: 'folders-first',
				acronymCasing: ['API', 'REST'],
			};
			mockWorkspace = createMockWorkspace(mockConfig);
			provider = new WorkspaceWikiTreeProvider(
				mockWorkspace,
				mockTreeItem,
				mockCollapsibleState,
				mockEventEmitter,
			);

			const mockUris = [createMockUri('/workspace-root/test.md')];
			mockScanWorkspaceDocs.mockResolvedValue(mockUris);
			mockBuildTree.mockResolvedValue([]);

			await provider.getChildren();

			expect(mockBuildTree).toHaveBeenCalledWith(mockUris, 'folders-first', ['API', 'REST']);
		});

		it('should handle workspace without getConfiguration method', async () => {
			const simpleWorkspace = {
				findFiles: jest.fn().mockResolvedValue([]),
			};
			provider = new WorkspaceWikiTreeProvider(
				simpleWorkspace,
				mockTreeItem,
				mockCollapsibleState,
				mockEventEmitter,
			);

			const mockUris = [createMockUri('/workspace-root/test.md')];
			mockScanWorkspaceDocs.mockResolvedValue(mockUris);
			mockBuildTree.mockResolvedValue([]);

			await provider.getChildren();

			expect(mockBuildTree).toHaveBeenCalledWith(mockUris, 'files-first', []);
		});

		it('should build node map after getting root children', async () => {
			const mockTreeData: MockTreeNode[] = [
				{
					type: 'file',
					name: 'test.md',
					title: 'Test',
					path: '/workspace-root/test.md',
					uri: createMockUri('/workspace-root/test.md'),
				},
			];

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue(mockTreeData);

			await provider.getChildren();

			// Test that node map is built by checking findNodeByPath
			const foundNode = provider.findNodeByPath('/workspace-root/test.md');
			expect(foundNode).toBeDefined();
		});
	});

	describe('createTreeItem', () => {
		it('should set preview command for README (no extension) using md openWith', async () => {
			const mockConfig = {
				defaultOpenMode: 'preview',
				openWith: {
					md: 'markdown.showPreview',
					txt: 'vscode.open',
				},
			};
			mockWorkspace = createMockWorkspace(mockConfig);
			provider = new WorkspaceWikiTreeProvider(
				mockWorkspace,
				mockTreeItem,
				mockCollapsibleState,
				mockEventEmitter,
			);

			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'README',
				title: 'README',
				path: '/workspace-root/README',
				uri: createMockUri('/workspace-root/README'),
			};

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue([mockNode]);

			await provider.getChildren();

			// The created tree item should use markdown.showPreview as the command
			expect(mockTreeItem).toHaveBeenCalledWith('README', mockCollapsibleState.None);
			const createdItem = mockTreeItem.mock.results[0].value;
			expect(createdItem.command).toBeDefined();
			expect(createdItem.command.arguments[1]).toBe('markdown.showPreview');
		});

		it('should set preview command for README (no extension) using markdown openWith if md missing', async () => {
			const mockConfig = {
				defaultOpenMode: 'preview',
				openWith: {
					markdown: 'markdown.customPreview',
					txt: 'vscode.open',
				},
			};
			mockWorkspace = createMockWorkspace(mockConfig);
			provider = new WorkspaceWikiTreeProvider(
				mockWorkspace,
				mockTreeItem,
				mockCollapsibleState,
				mockEventEmitter,
			);

			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'README',
				title: 'README',
				path: '/workspace-root/README',
				uri: createMockUri('/workspace-root/README'),
			};

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue([mockNode]);

			await provider.getChildren();

			// The created tree item should use markdown.customPreview as the command
			expect(mockTreeItem).toHaveBeenCalledWith('README', mockCollapsibleState.None);
			const createdItem = mockTreeItem.mock.results[0].value;
			expect(createdItem.command).toBeDefined();
			expect(createdItem.command.arguments[1]).toBe('markdown.customPreview');
		});

		it('should fallback to markdown.showPreview for README (no extension) if no openWith entry', async () => {
			const mockConfig = {
				defaultOpenMode: 'preview',
				openWith: {
					txt: 'vscode.open',
				},
			};
			mockWorkspace = createMockWorkspace(mockConfig);
			provider = new WorkspaceWikiTreeProvider(
				mockWorkspace,
				mockTreeItem,
				mockCollapsibleState,
				mockEventEmitter,
			);

			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'README',
				title: 'README',
				path: '/workspace-root/README',
				uri: createMockUri('/workspace-root/README'),
			};

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue([mockNode]);

			await provider.getChildren();

			// The created tree item should fallback to markdown.showPreview
			expect(mockTreeItem).toHaveBeenCalledWith('README', mockCollapsibleState.None);
			const createdItem = mockTreeItem.mock.results[0].value;
			expect(createdItem.command).toBeDefined();
			expect(createdItem.command.arguments[1]).toBe('markdown.showPreview');
		});

		it('should create tree item for file nodes', async () => {
			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'test.md',
				title: 'Test',
				path: '/workspace-root/test.md',
				uri: createMockUri('/workspace-root/test.md'),
			};

			// Build tree data first to initialize provider
			mockScanWorkspaceDocs.mockResolvedValue([mockNode.uri]);
			mockBuildTree.mockResolvedValue([mockNode]);

			// This will internally call createTreeItem for root level items
			const result = await provider.getChildren();

			expect(result).toHaveLength(1);
			expect(mockTreeItem).toHaveBeenCalledWith('Test', mockCollapsibleState.None);
		});
		it('should create tree item for folder nodes with children', async () => {
			const mockNode: MockTreeNode = {
				type: 'folder',
				name: 'docs',
				title: 'Docs',
				path: '/workspace-root/docs',
				children: [
					{
						type: 'file',
						name: 'test.md',
						title: 'Test',
						path: '/workspace-root/docs/test.md',
						uri: createMockUri('/workspace-root/docs/test.md'),
					},
				],
			};

			// Build tree data first
			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue([mockNode]);
			await provider.getChildren();

			// Reset mock and test folder creation
			mockTreeItem.mockClear();
			const mockElement = { treeNode: mockNode };
			await provider.getChildren(mockElement);

			// The folder itself should be collapsed when it has children
			// This tests internal createTreeItem behavior through getChildren
			expect(mockTreeItem).toHaveBeenCalled();
		});

		it('should set command for file nodes with default open mode', async () => {
			const mockConfig = {
				defaultOpenMode: 'preview',
				openWith: {
					md: 'markdown.showPreview',
					txt: 'vscode.open',
				},
			};
			mockWorkspace = createMockWorkspace(mockConfig);
			provider = new WorkspaceWikiTreeProvider(
				mockWorkspace,
				mockTreeItem,
				mockCollapsibleState,
				mockEventEmitter,
			);

			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'test.md',
				title: 'Test',
				path: '/workspace-root/test.md',
				uri: createMockUri('/workspace-root/test.md'),
			};

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue([mockNode]);

			// This will internally call createTreeItem
			const _result = await provider.getChildren();

			// Verify the tree item was created with proper command
			expect(mockTreeItem).toHaveBeenCalled();
			const createdItem = mockTreeItem.mock.results[0].value;
			expect(createdItem.treeNode).toBe(mockNode);
		});

		test.each([
			{
				scenario: 'set tooltip to description when node has front matter description',
				nodeType: 'file' as const,
				name: 'test.md',
				title: 'Test File',
				path: '/workspace-root/test.md',
				description: 'This is a test file description from YAML front matter',
				expectedTooltip: 'This is a test file description from YAML front matter',
			},
			{
				scenario: 'set tooltip to path when file node has no description',
				nodeType: 'file' as const,
				name: 'test.md',
				title: 'Test File',
				path: '/workspace-root/test.md',
				description: undefined,
				expectedTooltip: '/workspace-root/test.md',
			},
			{
				scenario: 'handle tooltip for folder nodes with description',
				nodeType: 'folder' as const,
				name: 'docs',
				title: 'Documentation',
				path: '/workspace-root/docs',
				description: 'Project documentation folder',
				expectedTooltip: 'Project documentation folder',
			},
			{
				scenario: 'handle tooltip for folder nodes without description',
				nodeType: 'folder' as const,
				name: 'docs',
				title: 'Documentation',
				path: '/workspace-root/docs',
				description: undefined,
				expectedTooltip: '/workspace-root/docs',
			},
		])('should $scenario', async ({ nodeType, name, title, path, description, expectedTooltip }) => {
			const mockNode: MockTreeNode = {
				type: nodeType,
				name,
				title,
				path,
				...(description && { description }),
				...(nodeType === 'file' && { uri: createMockUri(path) }),
				...(nodeType === 'folder' && { children: [] }),
			};

			mockScanWorkspaceDocs.mockResolvedValue(nodeType === 'file' ? [mockNode.uri!] : []);
			mockBuildTree.mockResolvedValue([mockNode]);

			await provider.getChildren();

			expect(mockTreeItem).toHaveBeenCalled();
			const createdItem = mockTreeItem.mock.results[0].value;
			expect(createdItem.tooltip).toBe(expectedTooltip);
		});
	});

	describe('getParent', () => {
		it('should return undefined for root level items', () => {
			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'test.md',
				title: 'Test',
				path: '/workspace-root/test.md',
				uri: createMockUri('/workspace-root/test.md'),
			};

			const mockElement = { treeNode: mockNode };
			const result = provider.getParent(mockElement);

			expect(result).toBeUndefined();
		});

		it('should return parent tree item for nested items', async () => {
			const parentNode: MockTreeNode = {
				type: 'folder',
				name: 'docs',
				title: 'Docs',
				path: '/workspace-root/docs',
			};

			const childNode: MockTreeNode = {
				type: 'file',
				name: 'test.md',
				title: 'Test',
				path: '/workspace-root/docs/test.md',
				uri: createMockUri('/workspace-root/docs/test.md'),
			};

			// Set up parent relationship
			(childNode as any).parent = parentNode;

			const mockElement = { treeNode: childNode };
			const result = provider.getParent(mockElement);

			expect(result).toBeDefined();
			expect(mockTreeItem).toHaveBeenCalledWith('Docs', expect.any(Number));
		});

		it('should handle invalid elements', () => {
			expect(provider.getParent(null)).toBeUndefined();
			expect(provider.getParent({})).toBeUndefined();
			expect(provider.getParent({ someOtherProperty: 'value' })).toBeUndefined();
		});
	});

	describe('getTreeItem', () => {
		it('should return element if it already has treeNode', () => {
			const mockElement = { treeNode: { type: 'file' }, label: 'Test' };
			const result = provider.getTreeItem(mockElement);

			expect(result).toBe(mockElement);
		});

		it('should create tree item for TreeNode objects', () => {
			const mockNode: MockTreeNode = {
				type: 'file',
				name: 'test.md',
				title: 'Test',
				path: '/workspace-root/test.md',
				uri: createMockUri('/workspace-root/test.md'),
			};

			const _result = provider.getTreeItem(mockNode);

			expect(mockTreeItem).toHaveBeenCalledWith('Test', mockCollapsibleState.None);
		});

		it('should return element as-is for unknown objects', () => {
			const unknownElement = { someProperty: 'value' };
			const result = provider.getTreeItem(unknownElement);

			expect(result).toBe(unknownElement);
		});

		it('should handle null/undefined elements', () => {
			expect(provider.getTreeItem(null)).toBe(null);
			expect(provider.getTreeItem(undefined)).toBe(undefined);
		});
	});

	describe('refresh', () => {
		it('should clear node map and fire change event', () => {
			const mockEmitter = createMockEventEmitter();
			(provider as any)._onDidChangeTreeData = mockEmitter;

			provider.refresh();

			expect(mockEmitter.fire).toHaveBeenCalledWith(undefined);
		});

		it('should reset nodeMapBuilt flag', async () => {
			// Build initial tree to set the flag
			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue([]);
			await provider.getChildren();

			// Refresh should reset the flag
			provider.refresh();

			// Verify that flag was reset by checking it gets rebuilt on next access
			await provider.getChildren();
			expect(mockScanWorkspaceDocs).toHaveBeenCalledTimes(2);
		});
	});

	describe('findNodeByPath', () => {
		beforeEach(async () => {
			const mockTreeData: MockTreeNode[] = [
				{
					type: 'file',
					name: 'test.md',
					title: 'Test',
					path: '/workspace-root/test.md',
					uri: createMockUri('/workspace-root/test.md'),
				},
				{
					type: 'folder',
					name: 'docs',
					title: 'Docs',
					path: '/workspace-root/docs',
					children: [
						{
							type: 'file',
							name: 'nested.md',
							title: 'Nested',
							path: '/workspace-root/docs/nested.md',
							uri: createMockUri('/workspace-root/docs/nested.md'),
						},
					],
				},
			];

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue(mockTreeData);
			await provider.getChildren(); // Build the node map
		});

		it('should find file nodes by exact path', () => {
			const result = provider.findNodeByPath('/workspace-root/test.md');
			expect(result).toBeDefined();
			expect(mockTreeItem).toHaveBeenCalledWith('Test', mockCollapsibleState.None);
		});

		it('should find nested file nodes', () => {
			const result = provider.findNodeByPath('/workspace-root/docs/nested.md');
			expect(result).toBeDefined();
			expect(mockTreeItem).toHaveBeenCalledWith('Nested', mockCollapsibleState.None);
		});

		it('should return undefined for non-existent paths', () => {
			const result = provider.findNodeByPath('/nonexistent/path.md');
			expect(result).toBeUndefined();
		});

		it('should return undefined for folder paths', () => {
			const result = provider.findNodeByPath('/workspace-root/docs');
			expect(result).toBeUndefined();
		});

		it('should handle normalized path comparison', () => {
			// Test with backslashes (Windows-style paths)
			const result = provider.findNodeByPath('/workspace-root\\test.md');
			expect(result).toBeDefined();
		});

		it('should build node map if not already built', () => {
			// Reset the nodeMapBuilt flag
			(provider as any).nodeMapBuilt = false;

			const result = provider.findNodeByPath('/workspace-root/test.md');
			expect(result).toBeDefined();
		});

		it('should handle empty tree data', () => {
			// Clear tree data and node map
			(provider as any).treeData = [];
			(provider as any).nodeMap.clear();
			(provider as any).nodeMapBuilt = false;

			const result = provider.findNodeByPath('/any/path.md');
			expect(result).toBeUndefined();
		});
	});

	describe('buildNodeMap', () => {
		it('should build node map with parent relationships', async () => {
			const mockTreeData: MockTreeNode[] = [
				{
					type: 'folder',
					name: 'docs',
					title: 'Docs',
					path: 'docs',
					children: [
						{
							type: 'file',
							name: 'test.md',
							title: 'Test',
							path: '/workspace-root/docs/test.md',
							uri: createMockUri('/workspace-root/docs/test.md'),
						},
					],
				},
			];

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue(mockTreeData);
			await provider.getChildren();

			// Check that nested file can find its parent
			const childElement = { treeNode: mockTreeData[0].children![0] };
			const parentResult = provider.getParent(childElement);
			expect(parentResult).toBeDefined();
		});
	});

	describe('dispose', () => {
		it('should dispose event emitter if dispose method exists', () => {
			const mockEmitter = createMockEventEmitter();
			(provider as any)._onDidChangeTreeData = mockEmitter;

			provider.dispose();

			expect(mockEmitter.dispose).toHaveBeenCalled();
		});

		it('should handle event emitter without dispose method', () => {
			const mockEmitter = { fire: jest.fn() };
			(provider as any)._onDidChangeTreeData = mockEmitter;

			// Should not throw error
			expect(() => provider.dispose()).not.toThrow();
		});

		it('should handle missing event emitter', () => {
			(provider as any)._onDidChangeTreeData = null;

			// Should not throw error
			expect(() => provider.dispose()).not.toThrow();
		});
	});

	describe('integration scenarios', () => {
		it('should handle complete workflow: build tree, find nodes, refresh', async () => {
			const mockTreeData: MockTreeNode[] = [
				{
					type: 'file',
					name: 'test.md',
					title: 'Test',
					path: '/workspace-root/test.md',
					uri: createMockUri('/workspace-root/test.md'),
				},
			];

			mockScanWorkspaceDocs.mockResolvedValue([createMockUri('/workspace-root/test.md')]);
			mockBuildTree.mockResolvedValue(mockTreeData);

			// Build initial tree
			const initialChildren = await provider.getChildren();
			expect(initialChildren).toHaveLength(1);

			// Find node
			const foundNode = provider.findNodeByPath('/workspace-root/test.md');
			expect(foundNode).toBeDefined();

			// Refresh
			provider.refresh();

			// Build tree again after refresh
			const refreshedChildren = await provider.getChildren();
			expect(refreshedChildren).toHaveLength(1);
			expect(mockScanWorkspaceDocs).toHaveBeenCalledTimes(2);
		});

		it('should handle mixed file and folder structures', async () => {
			const mockTreeData: MockTreeNode[] = [
				{
					type: 'file',
					name: 'README.md',
					title: 'README',
					path: '/workspace-root/README.md',
					uri: createMockUri('/workspace-root/README.md'),
					isReadme: true,
				},
				{
					type: 'folder',
					name: 'docs',
					title: 'Docs',
					path: 'docs',
					children: [
						{
							type: 'file',
							name: 'index.md',
							title: 'Index',
							path: '/workspace-root/docs/index.md',
							uri: createMockUri('/workspace-root/docs/index.md'),
							isIndex: true,
						},
					],
				},
			];

			mockScanWorkspaceDocs.mockResolvedValue([]);
			mockBuildTree.mockResolvedValue(mockTreeData);

			const children = await provider.getChildren();
			expect(children).toHaveLength(2);

			// Test folder expansion
			const folderElement = children[1];
			const folderChildren = await provider.getChildren(folderElement);
			expect(folderChildren).toHaveLength(1);

			// Test finding both files
			expect(provider.findNodeByPath('/workspace-root/README.md')).toBeDefined();
			expect(provider.findNodeByPath('/workspace-root/docs/index.md')).toBeDefined();
		});
	});
});
