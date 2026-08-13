import { WorkspaceLike } from '@types';
import { matchesGlobPattern, toSearchGlob } from '@utils';
import * as vscode from 'vscode';
import { buildIgnoreIndex } from './gitignore';

/** Extensions scanned when the setting is missing or malformed. */
const DEFAULT_EXTENSIONS = ['md', 'markdown', 'mdx', 'txt'];
/** Patterns excluded when the setting is missing. */
const DEFAULT_EXCLUDE_GLOBS = ['**/node_modules/**', '**/.git/**'];
/** Include patterns used when the setting is missing: none, so extensions alone decide the scan. */
const DEFAULT_INCLUDE_GLOBS: string[] = [];
/** Directory levels searched when the setting is missing; matches the `package.json` default. */
const DEFAULT_MAX_SEARCH_DEPTH = 10;
/** Extensions that make extensionless `README` files worth searching for. */
const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdx'];

/** Resolved `workspaceWiki.*` settings that shape a scan. */
interface ScanSettings {
	supportedExtensions: string[];
	includeGlobs: string[];
	excludeGlobs: string[];
	maxSearchDepth: number;
	showIgnoredFiles: boolean;
	showHiddenFiles: boolean;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : fallback;
}

/**
 * Reads the settings that shape a scan. Values are type-checked, not just coalesced: settings come
 * from user JSON, where a string in place of a number would silently disable a filter.
 *
 * @param workspace The workspace abstraction providing optional `getConfiguration`
 * @returns The resolved settings, with any unset or malformed value replaced by its default
 */
function readSettings(workspace: WorkspaceLike): ScanSettings {
	const settings: ScanSettings = {
		supportedExtensions: DEFAULT_EXTENSIONS,
		includeGlobs: DEFAULT_INCLUDE_GLOBS,
		excludeGlobs: DEFAULT_EXCLUDE_GLOBS,
		maxSearchDepth: DEFAULT_MAX_SEARCH_DEPTH,
		showIgnoredFiles: false,
		showHiddenFiles: false,
	};

	if (!workspace.getConfiguration) {
		return settings;
	}

	const config = workspace.getConfiguration('workspaceWiki');

	settings.supportedExtensions = asStringArray(config.get('supportedExtensions'), DEFAULT_EXTENSIONS);
	settings.includeGlobs = asStringArray(config.get('includeGlobs'), DEFAULT_INCLUDE_GLOBS);
	settings.excludeGlobs = asStringArray(config.get('excludeGlobs'), DEFAULT_EXCLUDE_GLOBS);

	// 0 is meaningful: it disables depth filtering, so it must survive the fallback.
	const maxSearchDepth = config.get('maxSearchDepth');
	settings.maxSearchDepth =
		typeof maxSearchDepth === 'number' && Number.isFinite(maxSearchDepth) && maxSearchDepth >= 0
			? maxSearchDepth
			: DEFAULT_MAX_SEARCH_DEPTH;

	const showIgnoredFiles = config.get('showIgnoredFiles');
	settings.showIgnoredFiles = typeof showIgnoredFiles === 'boolean' ? showIgnoredFiles : false;

	const showHiddenFiles = config.get('showHiddenFiles');
	settings.showHiddenFiles = typeof showHiddenFiles === 'boolean' ? showHiddenFiles : false;

	return settings;
}

/**
 * Builds the search patterns for a scan.
 *
 * @param supportedExtensions The extensions to search for
 * @param includeGlobs Extra file names or patterns to search for, normalized so a bare name matches at any depth
 * @returns The patterns to pass to `findFiles`, in search order
 */
function buildPatterns(supportedExtensions: string[], includeGlobs: string[]): string[] {
	const patterns = supportedExtensions.map((ext) => `**/*.${ext}`);

	const hasMarkdown = supportedExtensions.some((ext) => MARKDOWN_EXTENSIONS.includes(ext.toLowerCase()));
	if (hasMarkdown) {
		// README (no extension) at any depth, case-insensitive
		patterns.push('**/README');
		patterns.push('**/readme');
	}

	patterns.push(...includeGlobs.map(toSearchGlob).filter((pattern) => pattern));

	return patterns;
}

/**
 * Counts directory levels below the file's own workspace folder, so each root of a multi-root
 * workspace is measured on its own terms.
 *
 * @param workspace The workspace abstraction providing `asRelativePath`
 * @param uri The file to measure
 * @returns The one-based depth
 */
function getDepth(workspace: WorkspaceLike, uri: vscode.Uri): number {
	const relativePath = workspace.asRelativePath(uri, false).replace(/\\/g, '/');
	const separatorCount = relativePath ? (relativePath.match(/\//g) || []).length : 0;
	return separatorCount + 1;
}

/**
 * Finds the documentation files to show in the tree.
 *
 * Searches the configured `supportedExtensions`, the `includeGlobs` patterns, plus extensionless
 * `README` when Markdown is enabled, then drops anything excluded by `excludeGlobs`, a `.gitignore`,
 * a dot-prefixed path segment, or `maxSearchDepth`. `showIgnoredFiles` and `showHiddenFiles` disable
 * those filters. Every match passes through the same filters, so an include pattern widens what is
 * searched for without escaping what is filtered out.
 *
 * @param workspace The workspace abstraction providing `findFiles`, `workspaceFolders`, `asRelativePath`, `fs`, and optional `getConfiguration`
 * @returns Promise resolving to the matching file URIs, in pattern order and deduplicated by `uri.toString()`
 */
export async function scanWorkspaceDocs(workspace: WorkspaceLike): Promise<vscode.Uri[]> {
	const { supportedExtensions, includeGlobs, excludeGlobs, maxSearchDepth, showIgnoredFiles, showHiddenFiles } =
		readSettings(workspace);

	// findFiles takes a single glob with no way to spell negation, so .gitignore is resolved
	// separately and applied as a filter below.
	const ignoreIndex = showIgnoredFiles ? null : await buildIgnoreIndex(workspace, excludeGlobs);

	const patterns = buildPatterns(supportedExtensions, includeGlobs);
	const exclude = !showIgnoredFiles && excludeGlobs.length > 0 ? `{${excludeGlobs.join(',')}}` : undefined;

	// Patterns overlap by design once include globs are configured, and a URI reaching the tree twice
	// would render twice and collide in the provider's node map, where the last write wins.
	const seen = new Set<string>();
	const results: vscode.Uri[] = [];
	for (const pattern of patterns) {
		let uris = (await workspace.findFiles(pattern, exclude, undefined)) as vscode.Uri[];
		if (!uris) {
			uris = [];
		}

		// For README (no extension), filter to only files named exactly 'README' (case-insensitive, no extension)
		if (pattern === '**/README' || pattern === '**/readme') {
			uris = uris.filter((uri: vscode.Uri) => {
				const fileName = uri.path.split('/').pop() || '';
				return /^readme$/i.test(fileName);
			});
		}

		if (!showIgnoredFiles && excludeGlobs.length > 0) {
			uris = uris.filter((uri: vscode.Uri) => !matchesGlobPattern(uri.path, excludeGlobs));
		}

		if (ignoreIndex) {
			uris = uris.filter((uri: vscode.Uri) => !ignoreIndex.isIgnored(uri));
		}

		if (!showHiddenFiles) {
			uris = uris.filter((uri: vscode.Uri) => {
				const segments = uri.path.split('/');
				return !segments.some((seg: string) => seg.startsWith('.') && seg.length > 1);
			});
		}

		if (maxSearchDepth > 0) {
			uris = uris.filter((uri: vscode.Uri) => getDepth(workspace, uri) <= maxSearchDepth);
		}

		for (const uri of uris) {
			const key = uri.toString();
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			results.push(uri);
		}
	}

	return results;
}
