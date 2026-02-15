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
	/** The full file system path */
	path: string;
	/** VS Code URI object for the file */
	uri?: any;
	/** Child nodes (for folders) */
	children?: TreeNode[];
	/** Whether this node represents an index file (index.md, etc.) */
	isIndex?: boolean;
	/** Whether this node represents a README file */
	isReadme?: boolean;
	/** Description from front matter (for tooltips) */
	description?: string;
}
