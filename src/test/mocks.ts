import type { WorkspaceLike } from '@types';
import type * as vscode from 'vscode';
import { URI } from 'vscode-uri';

/**
 * Builds a URI for testing using the same implementation VS Code itself uses.
 *
 * @param pathOrUri An absolute path (treated as `file:`) or a full URI string such as
 * `vscode-vfs://github/owner/repo/docs/a.md`
 * @returns The URI
 */
export function createMockUri(pathOrUri: string): vscode.Uri {
	// A single letter before the colon is a Windows drive, not a scheme (`C:\docs` vs `file:/docs`).
	const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(pathOrUri);
	const hasScheme = !isWindowsPath && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathOrUri);

	return (hasScheme ? URI.parse(pathOrUri) : URI.file(pathOrUri)) as vscode.Uri;
}

/**
 * Settings a mock workspace should report.
 *
 * Every member is optional and an omitted one is reported as undefined rather than defaulted, so a
 * test that leaves one out is exercising the production fallback for it.
 */
export interface MockWorkspaceConfig {
	/** Whether dot-prefixed paths survive the scan. */
	showHiddenFiles?: boolean;
	/** Whether `.gitignore` and `excludeGlobs` filtering is skipped. */
	showIgnoredFiles?: boolean;
	/** Glob patterns whose matches are dropped from the scan. */
	excludeGlobs?: string[];
	/** File names or patterns included beyond `supportedExtensions`. */
	includeGlobs?: string[];
	/** Extensions the scan searches for. */
	supportedExtensions?: string[];
	/** Directory levels searched; `0` disables depth filtering. */
	maxSearchDepth?: number;
	/** `'preview'` or `'editor'`, the mode a single click opens in. */
	defaultOpenMode?: string;
	/** `'files-first'`, `'folders-first'`, or `'alphabetical'`. */
	directorySort?: string;
	/** Acronyms whose casing a normalized title preserves. */
	acronymCasing?: string[];
	/** Extension-to-command map deciding how a file opens. */
	openWith?: Record<string, string>;
}

/** File-system and search behaviour a mock workspace should present. */
export interface MockWorkspaceFiles {
	/**
	 * URIs returned by `findFiles`, or a function for per-pattern control. The function receives the
	 * pattern already flattened to a string, so a `RelativePattern` cannot break a `String` predicate.
	 */
	files?: vscode.Uri[] | ((pattern: string, exclude?: vscode.GlobPattern | null) => vscode.Uri[]);
	/** File contents keyed by `uri.toString()`; anything absent reads as missing. */
	contents?: Record<string, string>;
	/** Workspace roots; defaults to a single `/workspace-root`. */
	folders?: vscode.Uri[];
}

/** The default document set used when a test does not care which files exist. */
const DEFAULT_FILES = [
	'/workspace-root/.github/agents.md',
	'/workspace-root/docs/visible.md',
	'/workspace-root/.env',
	'/workspace-root/visible.txt',
];

/**
 * Creates a mock workspace satisfying the whole `WorkspaceLike` seam.
 *
 * The single construction point for that seam in tests, so a new member on the interface is
 * supplied in one place.
 *
 * @param config Configuration settings for the mock workspace
 * @param files File list, file contents, and workspace roots
 * @returns A mock workspace
 */
export function createMockWorkspace(config: MockWorkspaceConfig = {}, files: MockWorkspaceFiles = {}): WorkspaceLike {
	const folders = (files.folders ?? [createMockUri('/workspace-root')]).map((uri) => ({ uri }));
	const contents = files.contents ?? {};

	const resolveFiles = (pattern: vscode.GlobPattern, exclude?: vscode.GlobPattern | null): vscode.Uri[] => {
		if (typeof files.files === 'function') {
			const asString = typeof pattern === 'string' ? pattern : pattern.pattern;
			return files.files(asString, exclude);
		}
		return files.files ?? DEFAULT_FILES.map(createMockUri);
	};

	return {
		findFiles: async (pattern, exclude) => resolveFiles(pattern, exclude),
		fs: {
			readFile: async (uri: vscode.Uri) => {
				const content = contents[uri.toString()];
				if (content === undefined) {
					const error: any = new Error(`File not found: ${uri.toString()}`);
					error.code = 'FileNotFound';
					throw error;
				}
				return new TextEncoder().encode(content);
			},
		},
		workspaceFolders: folders,
		asRelativePath: (pathOrUri, _includeWorkspaceFolder) => {
			const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.path;
			// Longest root first, so a nested workspace folder wins over its parent.
			const roots = folders.map((folder) => folder.uri.path).sort((a, b) => b.length - a.length);
			for (const root of roots) {
				if (path === root || path.startsWith(`${root}/`)) {
					return path.slice(root.length).replace(/^\//, '');
				}
			}
			return path;
		},
		// Unset settings return undefined rather than a stand-in default, so production fallbacks
		// are the ones under test. A mock that supplied its own defaults would silently mask them.
		getConfiguration: (_section: string) => ({
			get: (key: string) => config[key as keyof MockWorkspaceConfig],
		}),
	};
}

/**
 * Creates a mock workspace for hidden-file tests.
 *
 * @param showHiddenFiles Whether hidden files should be reported
 * @returns A mock workspace configured for hidden file tests
 */
export function createHiddenFilesMockWorkspace(showHiddenFiles: boolean): WorkspaceLike {
	return createMockWorkspace(
		{
			showHiddenFiles,
			excludeGlobs: [],
			supportedExtensions: ['md', 'txt'],
		},
		{
			files: DEFAULT_FILES.map(createMockUri),
		},
	);
}

/**
 * Creates a mock workspace for basic file-discovery tests.
 *
 * @param supportedExtensions Array of supported file extensions
 * @param excludeGlobs Array of exclude patterns
 * @returns A mock workspace configured for file discovery tests
 */
export function createFileDiscoveryMockWorkspace(
	supportedExtensions: string[] = ['md', 'txt'],
	excludeGlobs: string[] = [],
): WorkspaceLike {
	return createMockWorkspace({
		supportedExtensions,
		excludeGlobs,
	});
}
