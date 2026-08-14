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

/**
 * Stands in for the built-in `markdown-language-features` extension, whose contributions decide
 * which Markdown surfaces the running VS Code can offer.
 *
 * The `customEditors` entry mirrors the real one: viewType, display name, and a `*.md`-only
 * selector. Values are copied from the extension shipped with VS Code 1.133 rather than invented,
 * so a test asserting the selector is asserting what VS Code actually publishes.
 *
 * @param options `markdownEditor` adds the `vscode.markdown.editor` contribution, absent before
 * VS Code 1.131; `selectorPatterns` overrides the filename patterns that editor claims
 * @returns An object shaped like the `packageJSON`-bearing entries of `vscode.extensions.all`
 */
export function createMockMarkdownExtension(options: { markdownEditor?: boolean; selectorPatterns?: string[] } = {}): {
	id: string;
	packageJSON: Record<string, unknown>;
} {
	const { markdownEditor = true, selectorPatterns = ['*.md'] } = options;

	const customEditors: Record<string, unknown>[] = [
		{
			viewType: 'vscode.markdown.preview.editor',
			displayName: 'Markdown Preview',
			selector: [{ filenamePattern: '*.md' }],
		},
	];

	if (markdownEditor) {
		customEditors.push({
			viewType: 'vscode.markdown.editor',
			displayName: 'Markdown Editor',
			selector: selectorPatterns.map((filenamePattern) => ({ filenamePattern })),
		});
	}

	return {
		id: 'vscode.markdown-language-features',
		packageJSON: {
			contributes: {
				customEditors,
				commands: [{ command: 'markdown.showPreview', title: 'Open Preview' }],
			},
		},
	};
}

/**
 * Replaces what `vscode.extensions.all` reports for the rest of the current test.
 *
 * Tests must call this in `beforeEach`, including with an empty list: the `vscode` stub is built
 * once per test file, so a list one test installs is still there for the next one.
 *
 * @param extensions The extensions to report, in the order VS Code would enumerate them
 */
export function setMockExtensions(extensions: unknown[]): void {
	// The `vscode` module is the platform API Jest has no host for; this reaches into the same
	// boundary stub `setupTests.ts` installs rather than adding a second seam.
	const mockVscode = require('vscode') as { extensions: { all: unknown[] } };
	mockVscode.extensions.all = extensions;
}
