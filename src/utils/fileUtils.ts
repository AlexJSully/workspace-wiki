/**
 * File and path manipulation utilities for workspace wiki
 */
import * as vscode from 'vscode';

/**
 * Gets the relative path from workspace root
 *
 * @param uri The file URI
 * @returns The path relative to its workspace folder, or the URI's own path when outside any workspace
 */
export function getRelativePath(uri: vscode.Uri): string {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
	if (workspaceFolder) {
		return vscode.workspace.asRelativePath(uri, false);
	}
	return uri.path;
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
 * Expands the `{a,b}` alternations of a glob into one pattern per alternative, as VS Code's own glob
 * matcher reads them. Nested groups expand fully; a brace with no closing partner is left as written.
 *
 * @param pattern The glob
 * @returns Every pattern the alternations spell out, or the pattern alone when it has none
 */
export function expandBraces(pattern: string): string[] {
	const open = pattern.indexOf('{');
	if (open === -1) {
		return [pattern];
	}

	// Find the matching close brace and the top-level commas between them.
	let depth = 0;
	const commas: number[] = [];
	let close = -1;
	for (let i = open; i < pattern.length; i++) {
		const char = pattern[i];
		if (char === '{') {
			depth++;
		} else if (char === '}') {
			depth--;
			if (depth === 0) {
				close = i;
				break;
			}
		} else if (char === ',' && depth === 1) {
			commas.push(i);
		}
	}
	if (close === -1) {
		return [pattern];
	}

	const head = pattern.slice(0, open);
	const tail = pattern.slice(close + 1);
	const bounds = [open, ...commas, close];
	const alternatives = bounds.slice(0, -1).map((start, index) => pattern.slice(start + 1, bounds[index + 1]));

	return alternatives.flatMap((alternative) => expandBraces(`${head}${alternative}${tail}`));
}

/** Compiled matchers by pattern, so a pattern applied to every file of a scan is converted once. */
const compiledGlobs = new Map<string, ((path: string) => boolean)[]>();
/** Patterns cached at most; the cache restarts past this, since settings rarely hold more. */
const MAX_COMPILED_GLOBS = 500;

/**
 * Converts one glob, after brace expansion, to a matcher over a lowercased, forward-slash path.
 *
 * @param pattern A glob with no `{a,b}` alternations
 * @returns The matcher; a pattern that does not form a valid expression matches by substring
 */
function compileGlob(pattern: string): (path: string) => boolean {
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
		return (path) => regex.test(path);
	} catch {
		// If regex is invalid, do simple string matching
		const needle = pattern.toLowerCase();
		return (path) => path.includes(needle);
	}
}

/**
 * Checks if a file path matches any of the given glob patterns
 *
 * Patterns are converted to regular expressions: `**` matches across path segments, though a leading
 * `**\/` needs at least one `/` before the rest, so it never matches a bare file name; `*` matches
 * within a segment, `?` matches a single non-slash character, and `{a,b}` matches either alternative.
 * An invalid pattern falls back to a substring match. Each pattern is converted once and reused.
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
		if (typeof pattern !== 'string') {
			return false;
		}
		let matchers = compiledGlobs.get(pattern);
		if (!matchers) {
			if (compiledGlobs.size >= MAX_COMPILED_GLOBS) {
				compiledGlobs.clear();
			}
			matchers = expandBraces(pattern).map(compileGlob);
			compiledGlobs.set(pattern, matchers);
		}
		return matchers.some((matches) => matches(normalizedPath));
	});
}

/**
 * Resolves a path a setting gives relative to a workspace folder, such as `workspaceWiki.site.logo`.
 *
 * A leading `./` or `/` is ignored, and `.` and `..` segments are resolved before the result is
 * checked, so a value cannot name a file outside the folder.
 *
 * @param root The workspace folder the path is relative to
 * @param value The setting's value
 * @returns The file's URI, or undefined for a blank value or one that leaves the folder
 */
export function resolveSettingPath(root: vscode.Uri, value: string): vscode.Uri | undefined {
	const relative = value.trim().replace(/^\.?\//, '');
	if (!relative) {
		return undefined;
	}
	const uri = vscode.Uri.joinPath(root, relative);
	const base = root.path.replace(/\/$/, '');
	return uri.path === base || uri.path.startsWith(`${base}/`) ? uri : undefined;
}

/**
 * Turns an include pattern into one that matches at any depth.
 *
 * Separators are normalized first: the setting is typed by hand, so a Windows user may write
 * `docs\notes\*.adoc`, which would otherwise read as a bare file name and never match. A pattern
 * naming a file and nothing else (`doc.go`) is anchored to the workspace root by both `findFiles`
 * and `matchesGlobPattern`, which is never what naming a file means here, so it gains a `**\/`
 * prefix. A pattern that already spells out path structure passes through with its separators fixed.
 *
 * @param pattern The include pattern to normalize
 * @returns The search glob, or `''` for invalid input
 */
export function toSearchGlob(pattern: string): string {
	if (!pattern || typeof pattern !== 'string') {
		return '';
	}

	const normalized = normalizePath(pattern);
	return normalized.includes('/') ? normalized : `**/${normalized}`;
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
