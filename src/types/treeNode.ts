import * as vscode from 'vscode';

/**
 * Tree node representing a file or folder in the workspace wiki
 */
export interface TreeNode {
	/** The type of the node - file or folder */
	type: 'file' | 'folder';
	/** The original file/folder name */
	name: string;
	/** The display title (normalized from name) */
	title: string;
	/** Display path relative to the tree's common base. Never used for identity — that is `uri`. */
	path: string;
	/** The node's URI. Carries the real scheme and authority, so it works on virtual file systems. */
	uri: vscode.Uri;
	/** Child nodes (for folders) */
	children?: TreeNode[];
	/** Whether this node represents an index file (index.md, etc.) */
	isIndex?: boolean;
	/** Whether this node represents a README file */
	isReadme?: boolean;
	/** Description from front matter (for tooltips) */
	description?: string;
}
