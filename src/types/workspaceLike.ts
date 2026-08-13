import * as vscode from 'vscode';

/**
 * The workspace API the scanner depends on, narrowed to what it uses.
 *
 * Routing file reads and searches through this seam keeps the scanner free of Node built-ins, which
 * do not resolve in the Web Worker extension host, and lets tests drive it without the `vscode`
 * module. URI and glob construction still uses the `vscode` namespace directly, since
 * `vscode.Uri` and `vscode.RelativePattern` are values rather than injectable behaviour.
 */
export interface WorkspaceLike {
	/** Searches the workspace for files matching a glob, minus anything the exclude pattern matches. */
	findFiles: (
		pattern: vscode.GlobPattern,
		exclude?: vscode.GlobPattern | null,
		maxResults?: number,
	) => Thenable<vscode.Uri[]>;
	/** Reads extension settings. Absent when a caller supplies no configuration, leaving defaults in force. */
	getConfiguration?: (section: string) => { get: (key: string) => any };
	/** The open workspace roots, used to scope `.gitignore` rules and to measure search depth. */
	workspaceFolders: readonly { uri: vscode.Uri }[] | undefined;
	/** Converts a URI to a path relative to whichever workspace folder contains it. */
	asRelativePath: (pathOrUri: vscode.Uri | string, includeWorkspaceFolder?: boolean) => string;
	/** Reads file contents. The scanner's only route to the file system. */
	fs: { readFile: (uri: vscode.Uri) => Thenable<Uint8Array> };
}
