/**
 * Configuration and settings utilities for workspace wiki
 */
import * as vscode from 'vscode';

/**
 * Gets workspace wiki configuration
 */
export function getWorkspaceWikiConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('workspaceWiki');
}

/**
 * Gets supported file extensions from configuration
 */
export function getSupportedExtensions(): string[] {
	const config = getWorkspaceWikiConfig();
	return config.get<string[]>('supportedExtensions') || ['md', 'markdown', 'txt'];
}

/**
 * Gets exclude patterns from configuration
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
 */
export function getDirectorySort(): 'files-first' | 'folders-first' | 'alphabetical' {
	const config = getWorkspaceWikiConfig();
	return config.get<'files-first' | 'folders-first' | 'alphabetical'>('directorySort') || 'files-first';
}

/**
 * Gets acronym casing settings from configuration
 */
export function getAcronymCasing(): string[] {
	const config = getWorkspaceWikiConfig();
	return config.get<string[]>('acronymCasing') || [];
}

/**
 * Gets auto-reveal settings from configuration
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
 */
export function getOpenWithSettings(): Record<string, string> {
	const config = getWorkspaceWikiConfig();
	return (
		config.get<Record<string, string>>('openWith') || {
			md: 'markdown.showPreview',
			markdown: 'markdown.showPreview',
			txt: 'vscode.open',
		}
	);
}

/**
 * Gets default open mode from configuration
 */
export function getDefaultOpenMode(): 'preview' | 'editor' {
	const config = getWorkspaceWikiConfig();
	return config.get<'preview' | 'editor'>('defaultOpenMode') || 'preview';
}

/**
 * Gets max search depth from configuration
 */
export function getMaxSearchDepth(): number {
	const config = getWorkspaceWikiConfig();
	return config.get<number>('maxSearchDepth') || 10;
}

/**
 * Gets show hidden files setting from configuration
 */
export function getShowHiddenFiles(): boolean {
	const config = getWorkspaceWikiConfig();
	return config.get<boolean>('showHiddenFiles') || false;
}

/**
 * Gets show ignored files setting from configuration
 */
export function getShowIgnoredFiles(): boolean {
	const config = getWorkspaceWikiConfig();
	return config.get<boolean>('showIgnoredFiles') || false;
}

/**
 * Syncs openWith extensions to supportedExtensions
 */
export function syncOpenWithToSupportedExtensions(): void {
	const config = getWorkspaceWikiConfig();
	const openWith = getOpenWithSettings();
	let supportedExtensions = getSupportedExtensions();

	// Ensure supportedExtensions is a valid array
	if (!Array.isArray(supportedExtensions)) {
		supportedExtensions = ['md', 'markdown', 'txt'];
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
