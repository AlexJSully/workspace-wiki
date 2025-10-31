/**
 * Preview controller for handling file opening and interaction logic
 */
import * as vscode from 'vscode';

// Track last click times for double-click detection
/** Map of file paths to their last click timestamps */
const lastClickTimes: Map<string, number> = new Map();
/** Time threshold (in milliseconds) to consider two clicks as a double-click */
const DOUBLE_CLICK_THRESHOLD = 500;

/** Default commands per extension when configuration is missing or invalid */
const DEFAULT_OPEN_WITH: Record<string, string> = {
	md: 'markdown.showPreview',
	markdown: 'markdown.showPreview',
	txt: 'vscode.open',
};

/**
 * Gets the file extension from a URI
 * @param uri The URI to extract the file extension from
 * @returns The file extension in lowercase, or undefined if none exists
 */
function getFileExtension(uri: vscode.Uri): string | undefined {
	const parts = uri.fsPath.split('.');
	if (parts.length < 2) {
		return undefined;
	}

	return parts.pop()?.toLowerCase();
}

/**
 * Retrieves the 'openWith' configuration from settings
 * @returns A mapping of file extensions to commands
 */
function getOpenWithConfig(): Record<string, string> {
	const config = vscode.workspace.getConfiguration('workspaceWiki');

	const userValue = config.get('openWith') as unknown;

	if (userValue && typeof userValue === 'object' && !Array.isArray(userValue)) {
		const entries = Object.entries(userValue);

		if (entries.every(([k, v]) => typeof k === 'string' && typeof v === 'string')) {
			return userValue as Record<string, string>;
		}
	}

	return DEFAULT_OPEN_WITH;
}

/**
 * Opens a file in preview mode
 * @param uri The URI of the file to open
 */
export function openInPreview(uri: vscode.Uri): void {
	const command = getOpenCommand(uri, 'preview');
	vscode.commands.executeCommand(command, uri);
}

/**
 * Opens a file in editor mode
 * @param uri The URI of the file to open
 */
export function openInEditor(uri: vscode.Uri): void {
	vscode.commands.executeCommand('vscode.open', uri);
}

/**
 * Handles file clicks with double-click detection
 * @param uri The URI of the file that was clicked
 * @param defaultCommand The default command to execute on single click
 */
export function handleFileClick(uri: vscode.Uri, defaultCommand: string): void {
	const now = Date.now();
	const path = uri.fsPath;
	const lastClick = lastClickTimes.get(path) || 0;

	if (now - lastClick < DOUBLE_CLICK_THRESHOLD) {
		// Double-click detected - open in editor
		openInEditor(uri);

		// Clear to prevent triple-click issues
		lastClickTimes.delete(path);
	} else {
		// Single click - execute default command (preview)
		vscode.commands.executeCommand(defaultCommand, uri);
		lastClickTimes.set(path, now);

		// Clear old entries to prevent memory leaks
		setTimeout(() => {
			if (lastClickTimes.get(path) === now) {
				lastClickTimes.delete(path);
			}
		}, DOUBLE_CLICK_THRESHOLD + 100);
	}
}

/**
 * Gets the appropriate command for opening a file based on extension and settings
 *
 * @param uri The URI of the file
 * @param mode The mode to open the file in ('preview' or 'editor')
 * @returns The command string to execute
 */
export function getOpenCommand(uri: vscode.Uri, mode: 'preview' | 'editor' = 'preview'): string {
	if (mode === 'editor') {
		return 'vscode.open';
	}

	const openWith = getOpenWithConfig();
	const fileExt = getFileExtension(uri);

	return fileExt && fileExt in openWith ? openWith[fileExt] : 'vscode.open';
}

/** Clears all stored click times (useful for testing) */
export function clearClickTimes(): void {
	lastClickTimes.clear();
}

/**
 * Gets the double click threshold value
 * @returns The double click threshold in milliseconds
 */
export function getDoubleClickThreshold(): number {
	return DOUBLE_CLICK_THRESHOLD;
}
