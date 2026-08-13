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
 * @returns The configured `includeGlobs`, or an empty list by default
 */
export function getIncludeGlobs(): string[] {
	const config = getWorkspaceWikiConfig();
	return config.get<string[]>('includeGlobs') || [];
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
 * Gets open with settings from configuration
 *
 * @returns A map of extension to command, or defaults for `md`/`markdown`/`mdx` (`markdown.showPreview`) and `txt` (`vscode.open`)
 */
export function getOpenWithSettings(): Record<string, string> {
	const config = getWorkspaceWikiConfig();
	return (
		config.get<Record<string, string>>('openWith') || {
			md: 'markdown.showPreview',
			markdown: 'markdown.showPreview',
			mdx: 'markdown.showPreview',
			txt: 'vscode.open',
		}
	);
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
 * Syncs openWith extensions to supportedExtensions
 *
 * Adds any extension present in `openWith` but missing from `supportedExtensions`, then writes the
 * result back to the workspace configuration when a change is needed (side effect; returns nothing).
 */
export function syncOpenWithToSupportedExtensions(): void {
	const config = getWorkspaceWikiConfig();
	const openWith = getOpenWithSettings();
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
		config.update('supportedExtensions', supportedExtensions, vscode.ConfigurationTarget.Workspace);
	}
}
