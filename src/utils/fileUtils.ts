/**
 * File and path manipulation utilities for workspace wiki
 */
import * as vscode from 'vscode';

/**
 * Gets the relative path from workspace root
 *
 * @param uri The file URI
 * @returns The path relative to its workspace folder, or the absolute `fsPath` when outside any workspace
 */
export function getRelativePath(uri: vscode.Uri): string {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
	if (workspaceFolder) {
		return vscode.workspace.asRelativePath(uri, false);
	}
	return uri.fsPath;
}

/**
 * Checks if a path represents a hidden file or directory
 *
 * @param path The file path to inspect
 * @returns `true` if any segment starts with a dot, is longer than one character, and does not end with a dot
 */
export function isHiddenPath(path: string): boolean {
	if (!path || typeof path !== 'string') {
		return false;
	}

	const pathParts = path.split(/[/\\]/);

	// Check if any part of the path (directory or file) starts with a dot
	// but exclude single dots and files ending with dots
	return pathParts.some((part) => part.startsWith('.') && part.length > 1 && !part.endsWith('.'));
}

/**
 * Normalizes path separators to forward slashes
 *
 * @param path The path to normalize
 * @returns The path with backslashes converted to forward slashes, or `''` for invalid input
 */
export function normalizePath(path: string): string {
	if (!path || typeof path !== 'string') {
		return '';
	}

	return path.replace(/\\/g, '/');
}

/**
 * Gets the directory name from a file path
 *
 * @param path The file path
 * @returns The parent directory name (the second-to-last segment), or `''` if there is none
 */
export function getDirectoryName(path: string): string {
	if (!path || typeof path !== 'string') {
		return '';
	}

	const normalized = normalizePath(path);
	const parts = normalized.split('/');
	return parts[parts.length - 2] || '';
}

/**
 * Gets the file name from a file path
 *
 * @param path The file path
 * @returns The final path segment, or `''` if there is none
 */
export function getFileName(path: string): string {
	if (!path || typeof path !== 'string') {
		return '';
	}

	const normalized = normalizePath(path);
	const parts = normalized.split('/');
	return parts[parts.length - 1] || '';
}

/**
 * Checks if a file path matches any of the given glob patterns
 *
 * Patterns are converted to regular expressions (`**` matches any depth, `*` matches within a segment,
 * `?` matches a single non-slash character); an invalid pattern falls back to a substring match.
 *
 * @param filePath The file path to test
 * @param patterns The glob patterns to match against
 * @returns `true` if the path matches any pattern
 */
export function matchesGlobPattern(filePath: string, patterns: string[]): boolean {
	if (!filePath || !Array.isArray(patterns)) {
		return false;
	}

	const normalizedPath = normalizePath(filePath).toLowerCase();

	return patterns.some((pattern) => {
		try {
			let regexPattern = pattern.toLowerCase();

			// Escape special regex characters except glob ones
			regexPattern = regexPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

			// Handle glob patterns
			regexPattern = regexPattern
				.replace(/\*\*/g, '___DOUBLESTAR___') // Placeholder for **
				.replace(/\*/g, '[^/]*') // * matches any characters except /
				.replace(/___DOUBLESTAR___/g, '.*') // ** matches any characters including /
				.replace(/\?/g, '[^/]'); // ? matches any single character except /

			// Handle anchoring based on pattern
			if (pattern.startsWith('**/')) {
				// **/ at start means match anywhere
				regexPattern = regexPattern;
			} else if (pattern.startsWith('/')) {
				// / at start means match from root
				regexPattern = '^' + regexPattern.substring(1);
			} else if (pattern.includes('/')) {
				// Contains slash but doesn't start with ** or /, match from any directory boundary
				regexPattern = '(^|/)' + regexPattern;
			} else {
				// No slash, match filename only (no directories allowed)
				regexPattern = '^' + regexPattern;
			}

			// Ensure proper ending
			if (pattern.endsWith('/**')) {
				// Ends with /**, already handled by .* conversion
			} else {
				regexPattern = regexPattern + '$';
			}

			const regex = new RegExp(regexPattern);
			return regex.test(normalizedPath);
		} catch {
			// If regex is invalid, do simple string matching
			return normalizedPath.includes(pattern.toLowerCase());
		}
	});
}

/**
 * Calculates the depth of a file path (number of directory levels)
 *
 * @param path The file path
 * @returns The number of non-empty path segments
 */
export function getPathDepth(path: string): number {
	if (!path || typeof path !== 'string') {
		return 0;
	}

	const normalized = normalizePath(path);
	const parts = normalized.split('/').filter((part) => part.length > 0);
	return parts.length;
}
