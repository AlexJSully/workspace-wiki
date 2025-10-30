import { scanWorkspaceDocs } from '@scanner';
import { TreeNode } from '@types';
import { buildTree } from './buildTree';

export class WorkspaceWikiTreeProvider {
	private _onDidChangeTreeData: any;
	readonly onDidChangeTreeData: any;
	private workspace: {
		findFiles: (pattern: string, exclude?: string, maxResults?: number) => Thenable<any[]>;
		getConfiguration?: (section: string) => { get: (key: string) => any };
	};
	private TreeItem: any;
	private CollapsibleState: any;
	private treeData: TreeNode[] = [];
	private nodeMap: Map<string, TreeNode> = new Map();
	private nodeMapBuilt: boolean = false;

	constructor(
		workspace: {
			findFiles: (pattern: string, exclude?: string, maxResults?: number) => Thenable<any[]>;
			getConfiguration?: (section: string) => { get: (key: string) => any };
		},
		TreeItem: any,
		CollapsibleState: any,
		EventEmitter: any,
	) {
		this.workspace = workspace;
		this.TreeItem = TreeItem;
		this.CollapsibleState = CollapsibleState;
		this._onDidChangeTreeData = new EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	async getChildren(element?: any): Promise<any[]> {
		if (element && (element as any).treeNode) {
			// Return children of the specified element
			const node = (element as any).treeNode as TreeNode;
			return (node.children || []).map((child) => this.createTreeItem(child));
		}

		// Root level - build hierarchical tree structure
		const uris = await scanWorkspaceDocs(this.workspace);

		// Get directory sort setting and acronyms
		let directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first';
		let acronyms: string[] = [];
		if (this.workspace.getConfiguration) {
			const config = this.workspace.getConfiguration('workspaceWiki');
			directorySort = config.get('directorySort') || 'files-first';
			acronyms = config.get('acronymCasing') || [];
		}

		this.treeData = buildTree(uris, directorySort, acronyms);

		// Clear existing map and rebuild immediately for consistency
		this.nodeMap.clear();
		this.buildNodeMap(this.treeData);
		this.nodeMapBuilt = true;

		return this.treeData.map((node) => this.createTreeItem(node));
	}

	private buildNodeMap(nodes: TreeNode[], parent?: TreeNode): void {
		for (const node of nodes) {
			// Use consistent absolute fsPath for both files and folders
			const absolutePath = node.uri ? node.uri.fsPath : node.path;
			this.nodeMap.set(absolutePath, node);
			if (parent) {
				(node as any).parent = parent;
			}
			if (node.children) {
				this.buildNodeMap(node.children, node);
			}
		}
	}

	getParent(element: any): any | undefined {
		if (element && (element as any).treeNode) {
			const node = (element as any).treeNode as TreeNode;
			const parent = (node as any).parent;
			if (parent) {
				return this.createTreeItem(parent);
			}
		}
		return undefined;
	}

	private createTreeItem(node: TreeNode): any {
		const collapsibleState =
			node.type === 'folder' && node.children && node.children.length > 0
				? this.CollapsibleState.Collapsed
				: this.CollapsibleState.None;

		const item = new this.TreeItem(node.title, collapsibleState);
		item.tooltip = node.path;

		// Set proper contextValue and resourceUri based on node type
		if (node.type === 'file' && node.uri) {
			item.resourceUri = node.uri;
			item.contextValue = 'file';

			// Get default open mode and file extension
			let defaultOpenMode = 'preview';
			let openWith: Record<string, string> = {
				md: 'markdown.showPreview',
				markdown: 'markdown.showPreview',
				txt: 'vscode.open',
			};

			if (this.workspace.getConfiguration) {
				const config = this.workspace.getConfiguration('workspaceWiki');
				defaultOpenMode = config.get('defaultOpenMode') || 'preview';
				openWith = config.get('openWith') || openWith;
			}

			// Determine which command to use for default click
			let fileExt = node.name.split('.').pop()?.toLowerCase();
			let defaultCommand = 'vscode.open';

			// Special case: README (no extension) should always use md/markdown preview if in preview mode
			if (defaultOpenMode === 'preview') {
				if (!node.name.includes('.') && node.name.toLowerCase() === 'readme') {
					defaultCommand = openWith['md'] || openWith['markdown'] || 'markdown.showPreview';
				} else if (fileExt && openWith[fileExt]) {
					defaultCommand = openWith[fileExt];
				}
			}

			item.command = {
				command: 'workspace-wiki.handleClick',
				title: 'Open Document',
				arguments: [node.uri, defaultCommand],
			};
		} else if (node.type === 'folder') {
			item.contextValue = 'folder';
			// Create a URI for the folder path so VS Code can show folder icons
			// We'll use a simple scheme since we just need it for icon display
			const folderPath = node.path;
			if (folderPath) {
				// Create a mock URI for folder icon display
				item.resourceUri = { scheme: 'file', fsPath: folderPath };
			}
		}

		// Store reference to tree node for getChildren
		(item as any).treeNode = node;

		return item;
	}

	getTreeItem(element: any): any {
		// If element has treeNode, it means it's our custom tree item
		if (element && (element as any).treeNode) {
			return element;
		}

		// Otherwise assume it's a TreeNode and create a tree item
		if (element && typeof element === 'object' && element.title) {
			return this.createTreeItem(element);
		}

		return element;
	}

	refresh(): void {
		// Clear node map flag to force rebuild on next access
		this.nodeMapBuilt = false;
		this.nodeMap.clear();
		this._onDidChangeTreeData.fire(undefined);
	}

	findNodeByPath(filePath: string): any | undefined {
		// Ensure nodeMap is built before lookup
		if (!this.nodeMapBuilt && this.treeData.length > 0) {
			this.buildNodeMap(this.treeData);
			this.nodeMapBuilt = true;
		}

		// Direct lookup with absolute path
		const node = this.nodeMap.get(filePath);
		if (node && node.type === 'file') {
			return this.createTreeItem(node);
		}

		// Try normalized path comparison for cross-platform compatibility
		const normalizedFilePath = filePath.replace(/\\/g, '/');
		for (const [mapPath, node] of this.nodeMap.entries()) {
			if (node.type === 'file') {
				const normalizedMapPath = mapPath.replace(/\\/g, '/');
				if (normalizedMapPath === normalizedFilePath) {
					return this.createTreeItem(node);
				}
			}
		}

		return undefined;
	}

	dispose(): void {
		// Clean up any resources if needed
		if (this._onDidChangeTreeData && typeof this._onDidChangeTreeData.dispose === 'function') {
			this._onDidChangeTreeData.dispose();
		}
	}
}
