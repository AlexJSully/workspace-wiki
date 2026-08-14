/**
 * Configuration and settings utilities for workspace wiki
 */
import * as vscode from 'vscode';

/**
 * Gets workspace wiki configuration
 *
 * @returns The `workspaceWiki` workspace configuration
 */
export function getWorkspaceWikiConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('workspaceWiki');
}

/**
 * Gets supported file extensions from configuration
 *
 * @returns The configured extensions, or `['md', 'markdown', 'mdx', 'txt']` by default
 */
export function getSupportedExtensions(): string[] {
	const config = getWorkspaceWikiConfig();
	return config.get<string[]>('supportedExtensions') || ['md', 'markdown', 'mdx', 'txt'];
}

/**
 * Gets the include patterns that add files beyond `supportedExtensions`.
 *
 * Entries are type-checked rather than coalesced: the setting is user JSON, where a bare string in
 * place of an array would otherwise reach a caller that iterates it.
 *
 * @param config The configuration to read; pass the one already in hand so a caller reading several
 * settings sees one consistent snapshot rather than re-resolving between reads
 * @returns The configured `includeGlobs`, or an empty list when unset or malformed
 */
export function getIncludeGlobs(config: vscode.WorkspaceConfiguration = getWorkspaceWikiConfig()): string[] {
	const value = config.get<unknown>('includeGlobs');

	return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? (value as string[]) : [];
}

/**
 * Gets exclude patterns from configuration
 *
 * @returns The configured `excludeGlobs`, or a built-in fallback list of common build and output directories
 */
export function getExcludePatterns(): string[] {
	const config = getWorkspaceWikiConfig();
	return (
		config.get<string[]>('excludeGlobs') || [
			'**/node_modules/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
			'**/out/**',
			'**/.vscode/**',
			'**/.vs/**',
			'**/target/**',
			'**/.next/**',
			'**/.nuxt/**',
			'**/coverage/**',
			'**/.nyc_output/**',
			'**/temp/**',
			'**/tmp/**',
			'**/.cache/**',
			'**/bin/**',
			'**/obj/**',
			'**/packages/**',
			'**/.angular/**',
			'**/vendor/**',
			'**/deps/**',
			'**/_site/**',
			'**/.jekyll-cache/**',
			'**/.sass-cache/**',
			'**/public/**',
			'**/.docusaurus/**',
			'**/docs/.vitepress/cache/**',
			'**/docs/.vitepress/dist/**',
		]
	);
}

/**
 * Gets directory sort setting from configuration
 *
 * @returns The sort mode, or `'files-first'` by default
 */
export function getDirectorySort(): 'files-first' | 'folders-first' | 'alphabetical' {
	const config = getWorkspaceWikiConfig();
	return config.get<'files-first' | 'folders-first' | 'alphabetical'>('directorySort') || 'files-first';
}

/**
 * Gets acronym casing settings from configuration
 *
 * @returns The configured acronyms, or an empty array by default
 */
export function getAcronymCasing(): string[] {
	const config = getWorkspaceWikiConfig();
	return config.get<string[]>('acronymCasing') || [];
}

/**
 * Gets auto-reveal settings from configuration
 *
 * @returns `enabled` (default `true`) and `delay` in milliseconds (default `500`)
 */
export function getAutoRevealSettings(): { enabled: boolean; delay: number } {
	const config = getWorkspaceWikiConfig();
	return {
		enabled: config.get<boolean>('autoReveal') ?? true,
		delay: config.get<number>('autoRevealDelay') ?? 500,
	};
}

/**
 * Gets default open mode from configuration
 *
 * @returns `'preview'` or `'editor'`, default `'preview'`
 */
export function getDefaultOpenMode(): 'preview' | 'editor' {
	const config = getWorkspaceWikiConfig();
	return config.get<'preview' | 'editor'>('defaultOpenMode') || 'preview';
}

/**
 * Gets max search depth from configuration
 *
 * @returns The maximum directory depth to scan, or `10` by default
 */
export function getMaxSearchDepth(): number {
	const config = getWorkspaceWikiConfig();
	return config.get<number>('maxSearchDepth') || 10;
}

/**
 * Gets show hidden files setting from configuration
 *
 * @returns Whether hidden files and folders (dot-prefixed) are shown; default `false`
 */
export function getShowHiddenFiles(): boolean {
	const config = getWorkspaceWikiConfig();
	return config.get<boolean>('showHiddenFiles') || false;
}

/**
 * Gets show ignored files setting from configuration
 *
 * @returns Whether files matched by `.gitignore` and `excludeGlobs` are shown; default `false`
 */
export function getShowIgnoredFiles(): boolean {
	const config = getWorkspaceWikiConfig();
	return config.get<boolean>('showIgnoredFiles') || false;
}

/**
 * Reads the `openWith` entries the user set, ignoring the ones this extension ships as defaults.
 *
 * A default is not a request. Widening `supportedExtensions` from the merged value would let a new
 * key shipped in `package.json` rewrite the settings file of every user whose list predates it.
 *
 * @returns The user's own `openWith` entries, merged in VS Code's precedence order
 */
function getUserSetOpenWith(config: vscode.WorkspaceConfiguration): Record<string, string> {
	const inspected = config.inspect<Record<string, string>>('openWith');

	return {
		...(inspected?.globalValue ?? {}),
		...(inspected?.workspaceValue ?? {}),
		...(inspected?.workspaceFolderValue ?? {}),
	};
}

/**
 * Syncs openWith extensions to supportedExtensions
 *
 * Adds any extension the user set in `openWith` but left out of `supportedExtensions`, then writes
 * the result back to the workspace configuration when a change is needed (side effect; returns nothing).
 */
export function syncOpenWithToSupportedExtensions(): void {
	const config = getWorkspaceWikiConfig();
	const openWith = getUserSetOpenWith(config);
	let supportedExtensions = getSupportedExtensions();

	// Ensure supportedExtensions is a valid array
	if (!Array.isArray(supportedExtensions)) {
		supportedExtensions = ['md', 'markdown', 'mdx', 'txt'];
	}

	const openWithKeys = Object.keys(openWith);
	let updated = false;

	for (const ext of openWithKeys) {
		if (!supportedExtensions.includes(ext)) {
			supportedExtensions.push(ext);
			updated = true;
		}
	}

	// Also check if we needed to reset the array
	const originalExtensions = config.get<string[]>('supportedExtensions');
	if (!Array.isArray(originalExtensions)) {
		updated = true;
	}

	if (updated) {
		// A workspace this extension is allowed to read is not always one it is allowed to write:
		// an untrusted or virtual workspace rejects here, and an unhandled rejection would surface
		// to the user as an extension error over a setting they never asked to change.
		Promise.resolve(
			config.update('supportedExtensions', supportedExtensions, vscode.ConfigurationTarget.Workspace),
		).catch((error) => {
			console.error('[WorkspaceWiki] Failed to sync supportedExtensions:', error);
		});
	}
}
