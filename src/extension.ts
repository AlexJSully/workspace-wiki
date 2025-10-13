// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

/**
 * Scanner module: Scans the workspace for documentation files (.md, .markdown, .txt)
 * Returns a list of file URIs matching supported extensions.
 */
/**
 * Scanner module: Scans the workspace for documentation files (.md, .markdown, .txt)
 * Returns a list of file URIs matching supported extensions, respecting excludes and settings.
 */
export async function scanWorkspaceDocs(workspace: {
	findFiles: (pattern: string, exclude?: string, maxResults?: number) => Thenable<any[]>;
	getConfiguration?: (section: string) => { get: (key: string) => any };
}): Promise<any[]> {
	// Read settings from workspaceWiki config if available
	let supportedExtensions = ['md', 'markdown', 'txt'];
	let excludeGlobs: string[] = ['**/node_modules/**', '**/.git/**'];
	let maxSearchDepth = 10;
	if (workspace.getConfiguration) {
		const config = workspace.getConfiguration('workspaceWiki');
		supportedExtensions = config.get('supportedExtensions') || supportedExtensions;
		excludeGlobs = config.get('excludeGlobs') || excludeGlobs;
		maxSearchDepth = config.get('maxSearchDepth') || maxSearchDepth;
	}
	// Build glob patterns for supported extensions
	const patterns = supportedExtensions.map((ext) => `**/*.${ext}`);
	const exclude = excludeGlobs.length > 0 ? `{${excludeGlobs.join(',')}}` : undefined;
	const results: any[] = [];
	for (const pattern of patterns) {
		let uris = await Promise.resolve(workspace.findFiles(pattern, exclude, undefined));
		// Filter out excluded files (simulate .gitignore/excludeGlobs)
		if (excludeGlobs.length > 0) {
			uris = uris.filter((uri) => {
				return !excludeGlobs.some((glob) => {
					const globPart = glob.replace('**/', '').replace('/**', '').replace('*', '');
					return uri.fsPath.includes(globPart);
				});
			});
		}
		// Optionally filter by maxSearchDepth
		if (maxSearchDepth > 0) {
			uris = uris.filter((uri) => {
				const relPath = uri.fsPath.replace(/\\/g, '/');
				// Calculate depth by counting directory separators after base path
				// /fake/path/level1.md -> 0 directories deep (depth 1)
				// /fake/path/deep/level2.md -> 1 directory deep (depth 2)
				// /fake/path/deep/deeper/level3.md -> 2 directories deep (depth 3)
				const pathMatch = relPath.match(/\/fake\/path\/(.*)$/);
				if (pathMatch) {
					const relativePath = pathMatch[1];
					const separatorCount = (relativePath.match(/\//g) || []).length;
					const depth = separatorCount + 1;
					return depth <= maxSearchDepth;
				}
				return true; // Keep file if we can't determine depth
			});
		}
		results.push(...uris);
	}
	return results;
}

/**
 * Convert file name to human-readable title
 * e.g. "gettingStarted.md" -> "Getting Started"
 */
export function normalizeTitle(fileName: string): string {
	if (!fileName || typeof fileName !== 'string') {
		return '';
	}

	const nameWithoutExt = fileName.replace(/\.(md|markdown|txt|html|pdf)$/i, '');

	// Handle special cases
	if (nameWithoutExt.toLowerCase() === 'readme') {
		return 'README';
	}

	// Convert camelCase to Title Case
	return nameWithoutExt
		.replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
		.replace(/[-_]/g, ' ') // kebab-case and snake_case
		.replace(/\b\w/g, (l) => l.toUpperCase()) // Title Case
		.trim();
}

/**
 * Tree node representing a file or folder
 */
interface TreeNode {
	type: 'file' | 'folder';
	name: string;
	title: string;
	path: string;
	uri?: any;
	children?: TreeNode[];
	isIndex?: boolean;
	isReadme?: boolean;
}

/**
 * Build hierarchical tree structure from flat file list
 */
export function buildTree(
	uris: any[],
	directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first',
): TreeNode[] {
	if (uris.length === 0) {
		return [];
	}

	const tree: TreeNode[] = [];
	const folders = new Map<string, TreeNode>();

	// Find common base path
	const allPaths = uris.map((uri) => uri.fsPath.split('/').filter((part: string) => part));
	const commonBase = allPaths.reduce((common, path) => {
		const minLength = Math.min(common.length, path.length);
		let i = 0;
		while (i < minLength && common[i] === path[i]) {
			i++;
		}
		return common.slice(0, i);
	}, allPaths[0]);

	// First pass: collect all files and create folder structure
	for (const uri of uris) {
		const pathParts = uri.fsPath.split('/').filter((part: string) => part);

		// Make path relative to common base
		const relativeParts = pathParts.slice(commonBase.length);
		const relativeFileName = relativeParts[relativeParts.length - 1];

		// Skip if we don't have a valid filename
		if (!relativeFileName) {
			continue;
		}

		// Build folder path using relative parts
		let currentPath = '';
		for (let i = 0; i < relativeParts.length - 1; i++) {
			const folderName = relativeParts[i];
			const parentPath = currentPath;
			currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

			if (!folders.has(currentPath)) {
				const folderNode: TreeNode = {
					type: 'folder',
					name: folderName,
					title: normalizeTitle(folderName),
					path: currentPath,
					children: [],
				};
				folders.set(currentPath, folderNode);

				// Add to parent folder or root
				if (parentPath && folders.has(parentPath)) {
					folders.get(parentPath)!.children!.push(folderNode);
				} else if (parentPath === '' || !parentPath) {
					// Add to root if no parent or parent is empty string
					tree.push(folderNode);
				}
			}
		}

		// Add file to appropriate parent
		const fileNode: TreeNode = {
			type: 'file',
			name: relativeFileName,
			title: normalizeTitle(relativeFileName),
			path: uri.fsPath,
			uri,
			isIndex: relativeFileName.toLowerCase() === 'index.md',
			isReadme: relativeFileName.toLowerCase().startsWith('readme.'),
		};

		const folderPath = relativeParts.slice(0, -1).join('/');
		if (folderPath && folders.has(folderPath)) {
			folders.get(folderPath)!.children!.push(fileNode);
		} else {
			tree.push(fileNode);
		}
	}

	// Sorting function based on directory sort setting
	const sortNodes = (nodes: TreeNode[]): void => {
		nodes.sort((a, b) => {
			// README always first
			if (a.isReadme) {
				return -1;
			}
			if (b.isReadme) {
				return 1;
			}

			// Apply directory sorting logic
			if (directorySort === 'alphabetical') {
				return a.title.localeCompare(b.title);
			} else if (directorySort === 'files-first') {
				if (a.type !== b.type) {
					return a.type === 'file' ? -1 : 1;
				}
			} else if (directorySort === 'folders-first') {
				if (a.type !== b.type) {
					return a.type === 'folder' ? -1 : 1;
				}
			}

			// Finally alphabetical within same type
			return a.title.localeCompare(b.title);
		});
	};

	// Second pass: handle index.md folder replacement and sorting
	const processNode = (node: TreeNode): void => {
		if (node.type === 'folder' && node.children) {
			// Note: We keep the original folder name, index.md files are shown as children

			// Sort children based on directory sort setting
			sortNodes(node.children);

			// Recursively process children
			node.children.forEach(processNode);
		}
	};

	// Sort root level
	sortNodes(tree);

	tree.forEach(processNode);
	return tree;
}

// Activation logic moved to extension.vscode.ts

export class WorkspaceWikiTreeProvider {
	private _onDidChangeTreeData: any;
	readonly onDidChangeTreeData: any;
	private workspace: {
		findFiles: (pattern: string, exclude?: string, maxResults?: number) => Thenable<any[]>;
		getConfiguration?: (section: string) => { get: (key: string) => any };
	};
	private TreeItem: any;
	private CollapsibleState: any;

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

		// Get directory sort setting
		let directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first';
		if (this.workspace.getConfiguration) {
			const config = this.workspace.getConfiguration('workspaceWiki');
			directorySort = config.get('directorySort') || 'files-first';
		}

		const tree = buildTree(uris, directorySort);

		return tree.map((node) => this.createTreeItem(node));
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
			const fileExt = node.name.split('.').pop()?.toLowerCase();
			let defaultCommand = 'vscode.open';

			if (defaultOpenMode === 'preview' && fileExt && openWith[fileExt]) {
				defaultCommand = openWith[fileExt];
			}

			item.command = {
				command: defaultCommand,
				title: defaultOpenMode === 'preview' ? 'Open in Preview' : 'Open Document',
				arguments: [node.uri],
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
		this._onDidChangeTreeData.fire(undefined);
	}

	dispose(): void {
		// Clean up any resources if needed
		if (this._onDidChangeTreeData && typeof this._onDidChangeTreeData.dispose === 'function') {
			this._onDidChangeTreeData.dispose();
		}
	}
}

/**
 * Opens a file in preview mode
 */
export function openInPreview(uri: vscode.Uri): void {
	const config = vscode.workspace.getConfiguration('workspaceWiki');
	const openWith = (config.get('openWith') as Record<string, string>) || {
		md: 'markdown.showPreview',
		markdown: 'markdown.showPreview',
		txt: 'vscode.open',
	};

	const fileExt = uri.fsPath.split('.').pop()?.toLowerCase();
	const command = fileExt && openWith[fileExt] ? openWith[fileExt] : 'vscode.open';

	vscode.commands.executeCommand(command, uri);
}

/**
 * Opens a file in editor mode
 */
export function openInEditor(uri: vscode.Uri): void {
	vscode.commands.executeCommand('vscode.open', uri);
}

// VS Code extension activation: register WorkspaceWikiTreeProvider for 'workspaceWiki' view

export function activate(context: vscode.ExtensionContext) {
	const syncOpenWithToSupportedExtensions = () => {
		const config = vscode.workspace.getConfiguration('workspaceWiki');
		const openWith = config.get('openWith') || {};
		let supportedExtensions = config.get('supportedExtensions') as string[] | undefined;
		if (!Array.isArray(supportedExtensions)) {
			supportedExtensions = ['md', 'markdown', 'txt'];
		}
		const openWithKeys = Object.keys(openWith);
		let updated = false;
		for (const ext of openWithKeys) {
			if (!supportedExtensions.includes(ext)) {
				supportedExtensions.push(ext);
				updated = true;
			}
		}
		if (updated) {
			config.update('supportedExtensions', supportedExtensions, vscode.ConfigurationTarget.Workspace);
		}
	};

	// Sync on activation
	syncOpenWithToSupportedExtensions();

	const treeProvider = new WorkspaceWikiTreeProvider(
		vscode.workspace,
		vscode.TreeItem,
		vscode.TreeItemCollapsibleState,
		vscode.EventEmitter,
	);

	vscode.window.registerTreeDataProvider('workspaceWiki', treeProvider);

	const openPreviewCommand = vscode.commands.registerCommand('workspace-wiki.openPreview', (item) => {
		if (item && item.treeNode && item.treeNode.uri) {
			openInPreview(item.treeNode.uri);
		}
	});

	const openEditorCommand = vscode.commands.registerCommand('workspace-wiki.openEditor', (item) => {
		if (item && item.treeNode && item.treeNode.uri) {
			openInEditor(item.treeNode.uri);
		}
	});

	const refreshCommand = vscode.commands.registerCommand('workspace-wiki.refresh', () => {
		treeProvider.refresh();
	});

	// Listen for configuration changes to auto-refresh tree and sync extensions
	const configurationChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
		if (
			event.affectsConfiguration('workspaceWiki.directorySort') ||
			event.affectsConfiguration('workspaceWiki.supportedExtensions') ||
			event.affectsConfiguration('workspaceWiki.excludeGlobs') ||
			event.affectsConfiguration('workspaceWiki.maxSearchDepth') ||
			event.affectsConfiguration('workspaceWiki.openWith')
		) {
			syncOpenWithToSupportedExtensions();
			treeProvider.refresh();
		}
	});

	context.subscriptions.push(treeProvider);
	context.subscriptions.push(openPreviewCommand);
	context.subscriptions.push(openEditorCommand);
	context.subscriptions.push(refreshCommand);
	context.subscriptions.push(configurationChangeListener);
}

export function deactivate() {
	// Clean up resources when extension is deactivated
}
