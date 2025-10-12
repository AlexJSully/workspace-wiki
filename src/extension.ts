// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// No direct vscode import for testability

/**
 * Scanner module: Scans the workspace for documentation files (.md, .markdown, .txt)
 * Returns a list of file URIs matching supported extensions.
 */
export async function scanWorkspaceDocs(workspace: {
	findFiles: (pattern: string) => Thenable<any[]>;
}): Promise<any[]> {
	const patterns = ['**/*.md', '**/*.markdown', '**/*.txt'];
	const results: any[] = [];
	for (const pattern of patterns) {
		const uris = await Promise.resolve(workspace.findFiles(pattern));
		results.push(...uris);
	}
	return results;
}

// Activation logic moved to extension.vscode.ts

export class WorkspaceWikiTreeProvider {
	private _onDidChangeTreeData: any;
	readonly onDidChangeTreeData: any;
	private workspace: { findFiles: (pattern: string) => Thenable<any[]> };
	private TreeItem: any;
	private CollapsibleState: any;

	constructor(
		workspace: { findFiles: (pattern: string) => Thenable<any[]> },
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
		if (element) {
			return [];
		}
		const uris = await scanWorkspaceDocs(this.workspace);
		return uris.map((uri) => {
			const item = new this.TreeItem(uri, this.CollapsibleState.None);
			item.label = uri.fsPath.split('/').pop();
			item.tooltip = uri.fsPath;
			item.command = {
				command: 'vscode.open',
				title: 'Open Document',
				arguments: [uri],
			};
			return item;
		});
	}

	getTreeItem(element: any): any {
		return element;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}
}

// This method is called when your extension is deactivated
// Deactivate logic moved to extension.vscode.ts
