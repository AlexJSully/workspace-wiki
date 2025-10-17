/**
 * Preview controller for handling file opening and interaction logic
 */
import * as vscode from 'vscode';

// Track last click times for double-click detection
const lastClickTimes: Map<string, number> = new Map();
const DOUBLE_CLICK_THRESHOLD = 500; // milliseconds

/**
 * Opens a file in preview mode
 */
export function openInPreview(uri: vscode.Uri): void {
	const config = vscode.workspace.getConfiguration('workspaceWiki');
	const openWith = (config.get('openWith') as Record<string, string>) || {
		md: 'markdown.showPreview',
		markdown: 'markdown.showPreview',
		txt: 'vscode.open',
	};

	const fileExt = uri.fsPath.split('.').pop()?.toLowerCase();
	const command = fileExt && openWith[fileExt] ? openWith[fileExt] : 'vscode.open';

	vscode.commands.executeCommand(command, uri);
}

/**
 * Opens a file in editor mode
 */
export function openInEditor(uri: vscode.Uri): void {
	vscode.commands.executeCommand('vscode.open', uri);
}

/**
 * Handles file clicks with double-click detection
 */
export function handleFileClick(uri: vscode.Uri, defaultCommand: string): void {
	// Handle case when vscode is not available (e.g., in tests)
	if (typeof vscode === 'undefined' || !vscode.commands) {
		// In test environment, use the global mock
		const globalVscode = (global as any).vscode;
		if (globalVscode?.commands?.executeCommand) {
			const now = Date.now();
			const path = uri.fsPath;
			const lastClick = lastClickTimes.get(path) || 0;

			if (now - lastClick < DOUBLE_CLICK_THRESHOLD) {
				// Double-click detected - open in editor
				globalVscode.commands.executeCommand('vscode.open', uri);
				lastClickTimes.delete(path); // Clear to prevent triple-click issues
			} else {
				// Single click - execute default command
				globalVscode.commands.executeCommand(defaultCommand, uri);
				lastClickTimes.set(path, now);

				// Clear old entries to prevent memory leaks
				setTimeout(() => {
					if (lastClickTimes.get(path) === now) {
						lastClickTimes.delete(path);
					}
				}, DOUBLE_CLICK_THRESHOLD + 100);
			}
		}
		return;
	}

	const now = Date.now();
	const path = uri.fsPath;
	const lastClick = lastClickTimes.get(path) || 0;

	if (now - lastClick < DOUBLE_CLICK_THRESHOLD) {
		// Double-click detected - open in editor
		openInEditor(uri);
		lastClickTimes.delete(path); // Clear to prevent triple-click issues
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
 */
export function getOpenCommand(uri: vscode.Uri, mode: 'preview' | 'editor' = 'preview'): string {
	if (mode === 'editor') {
		return 'vscode.open';
	}

	const config = vscode.workspace.getConfiguration('workspaceWiki');
	const openWith = (config.get('openWith') as Record<string, string>) || {
		md: 'markdown.showPreview',
		markdown: 'markdown.showPreview',
		txt: 'vscode.open',
	};

	const fileExt = uri.fsPath.split('.').pop()?.toLowerCase();
	return fileExt && openWith[fileExt] ? openWith[fileExt] : 'vscode.open';
}

/**
 * Clears all stored click times (useful for testing)
 */
export function clearClickTimes(): void {
	lastClickTimes.clear();
}

/**
 * Gets the double click threshold value
 */
export function getDoubleClickThreshold(): number {
	return DOUBLE_CLICK_THRESHOLD;
}
