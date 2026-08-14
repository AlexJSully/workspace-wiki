import { DEFAULT_OPEN_WITH, validateOpenWith } from '@controllers';
import { scanWorkspaceDocs } from '@scanner';
import { TreeNode, WorkspaceLike } from '@types';
import { getFileExtension } from '@utils';
import * as vscode from 'vscode';
import { buildTree } from './buildTree';

/**
 * Supplies the Workspace Wiki view with tree items.
 *
 * Implements VS Code's `TreeDataProvider` contract. A root-level `getChildren` rescans the
 * workspace, rebuilds the tree, and reindexes every node by `uri.toString()`; expanding a folder
 * reads from that already-built tree without touching the file system.
 */
export class WorkspaceWikiTreeProvider {
	private _onDidChangeTreeData: any;
	/** Event VS Code subscribes to; `refresh()` fires it to request a rebuild. */
	readonly onDidChangeTreeData: any;
	private workspace: WorkspaceLike;
	private TreeItem: any;
	private CollapsibleState: any;
	private treeData: TreeNode[] = [];
	/** Nodes keyed by `uri.toString()`, the only stable identity across file system providers. */
	private nodeMap: Map<string, TreeNode> = new Map();
	private nodeMapBuilt: boolean = false;

	/**
	 * @param workspace The workspace API used to discover and read documents
	 * @param TreeItem The `vscode.TreeItem` constructor
	 * @param CollapsibleState The `vscode.TreeItemCollapsibleState` enum
	 * @param EventEmitter The `vscode.EventEmitter` constructor
	 */
	constructor(workspace: WorkspaceLike, TreeItem: any, CollapsibleState: any, EventEmitter: any) {
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
	 * Populates `nodeMap` (URI string to node) and records each node's parent for lookups and reveal.
	 *
	 * @param nodes The nodes to index
	 * @param parent The parent node to assign to each node, if any
	 */
	private buildNodeMap(nodes: TreeNode[], parent?: TreeNode): void {
		for (const node of nodes) {
			this.nodeMap.set(node.uri.toString(), node);
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
			let openWith: Readonly<Record<string, string>> = DEFAULT_OPEN_WITH;

			if (this.workspace.getConfiguration) {
				const config = this.workspace.getConfiguration('workspaceWiki');
				defaultOpenMode = config.get('defaultOpenMode') || 'preview';
				// Validated through the same check the controller applies, so a malformed setting
				// resolves one way rather than giving the tree a dead click the context menu survives.
				// Read through the injected workspace, which keeps this on the seam the tests drive.
				openWith = validateOpenWith(config.get('openWith'));
			}

			// Determine which command to use for default click
			const fileExt = getFileExtension(node.name);
			let defaultCommand = 'vscode.open';

			// Special case: README (no extension) opens the way an `.md` file would, if in preview mode
			if (defaultOpenMode === 'preview') {
				if (!node.name.includes('.') && node.name.toLowerCase() === 'readme') {
					defaultCommand = openWith['md'] || openWith['markdown'] || DEFAULT_OPEN_WITH.md;
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
			// A real URI, so VS Code resolves the folder icon against the actual file system
			// provider rather than a fabricated `file:` path.
			item.resourceUri = node.uri;
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
	 * Finds the file tree item matching a URI.
	 *
	 * Lookup is by `uri.toString()`, which is exact and scheme-aware, so no path normalization
	 * or fallback scan is needed.
	 *
	 * @param uri The URI of the file to locate
	 * @returns The matching file tree item, or undefined if not found
	 */
	findNodeByUri(uri: vscode.Uri): any | undefined {
		// Ensure nodeMap is built before lookup
		if (!this.nodeMapBuilt && this.treeData.length > 0) {
			this.buildNodeMap(this.treeData);
			this.nodeMapBuilt = true;
		}

		const node = this.nodeMap.get(uri.toString());
		if (node && node.type === 'file') {
			return this.createTreeItem(node);
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
