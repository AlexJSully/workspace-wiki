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

	/**
	 * Returns the tree items to display under an element, or the root tree when no element is given.
	 *
	 * @param element The parent tree item, or undefined for the root level
	 * @returns Promise resolving to the child tree items (rebuilds the tree and node map at the root)
	 */
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

		this.treeData = await buildTree(uris, directorySort, acronyms);

		// Clear existing map and rebuild immediately for consistency
		this.nodeMap.clear();
		this.buildNodeMap(this.treeData);
		this.nodeMapBuilt = true;

		return this.treeData.map((node) => this.createTreeItem(node));
	}

	/**
	 * Populates `nodeMap` (absolute path to node) and records each node's parent for lookups and reveal.
	 *
	 * @param nodes The nodes to index
	 * @param parent The parent node to assign to each node, if any
	 */
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

	/**
	 * Returns the parent tree item for an element, used by VS Code for reveal and sync.
	 *
	 * @param element The tree item whose parent is requested
	 * @returns The parent tree item, or undefined at the root
	 */
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

	/**
	 * Builds a VS Code TreeItem from a TreeNode, setting collapsible state, tooltip, context value,
	 * and (for files) the click command derived from `defaultOpenMode` and `openWith`.
	 *
	 * @param node The tree node to convert
	 * @returns The configured TreeItem, with the source node attached as `treeNode`
	 */
	private createTreeItem(node: TreeNode): any {
		const collapsibleState =
			node.type === 'folder' && node.children && node.children.length > 0
				? this.CollapsibleState.Collapsed
				: this.CollapsibleState.None;

		const item = new this.TreeItem(node.title, collapsibleState);

		// Use description from front matter if available, otherwise fallback to path
		item.tooltip = node.description || node.path;

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

	/**
	 * Returns the TreeItem for an element: the element itself when it is already a tree item,
	 * otherwise a new item built from a TreeNode.
	 *
	 * @param element A tree item or a TreeNode
	 * @returns The TreeItem to render
	 */
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

	/**
	 * Clears the cached node map and fires the change event so VS Code rebuilds the tree.
	 */
	refresh(): void {
		// Clear node map flag to force rebuild on next access
		this.nodeMapBuilt = false;
		this.nodeMap.clear();
		this._onDidChangeTreeData.fire(undefined);
	}

	/**
	 * Finds the file tree item matching a path, using direct then normalized (cross-platform) comparison.
	 *
	 * @param filePath The absolute file system path to locate
	 * @returns The matching file tree item, or undefined if not found
	 */
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

	/** Disposes the tree-data change event emitter. */
	dispose(): void {
		// Clean up any resources if needed
		if (this._onDidChangeTreeData && typeof this._onDidChangeTreeData.dispose === 'function') {
			this._onDidChangeTreeData.dispose();
		}
	}
}
