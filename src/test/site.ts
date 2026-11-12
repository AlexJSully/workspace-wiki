/**
 * Shared setup for the Wiki Site host tests: a manager over a small mock workspace, and readers for
 * what the mock webview panels were sent.
 */
import type { HostToView } from '@site/protocol';
import { WikiSiteManager } from '@site/sitePanel';
import { type MockWorkspaceConfig, createMockUri, createMockWorkspace } from './mocks';

/** `uri.toString()` of the mock workspace's README. */
export const README = 'file:///workspace-root/README.md';
/** `uri.toString()` of the mock workspace's guide page. */
export const GUIDE = 'file:///workspace-root/docs/guide.md';
/** The extension's install location in the tests. */
export const EXTENSION = createMockUri('/extension');

/** Waits for the host to finish handling posted messages, which it does asynchronously. */
export async function settle(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

/**
 * Creates a manager over a workspace holding `README.md` and `docs/guide.md`, or the files named.
 *
 * @param config Settings the workspace reports
 * @param files Workspace-relative paths of the files the scan finds
 * @returns The manager, its workspace, and the file contents, which a test may change
 */
export function createSiteManager(config: MockWorkspaceConfig = {}, files: string[] = ['README.md', 'docs/guide.md']) {
	const contents: Record<string, string> = {
		[README]: '# Home\n\nSee [the guide](docs/guide.md).',
		[GUIDE]: '---\ntitle: Guide\n---\n# Guide\n\nUse the scanner.',
	};
	const uris = files.map((path) => createMockUri(`/workspace-root/${path}`));
	const workspace = createMockWorkspace(config, {
		contents,
		// Serves each `**/*.<ext>` search the files with that extension, as `findFiles` would.
		files: (pattern) =>
			pattern.includes('favicon')
				? []
				: uris.filter((uri) => pattern.startsWith('**/*.') && uri.path.endsWith(pattern.slice(4))),
	});
	const manager = new WikiSiteManager(EXTENSION, workspace);
	return { manager, workspace, contents };
}

/**
 * Returns the mock panel `createWebviewPanel` returned, by creation order.
 *
 * @param index Which panel; the first by default
 * @returns The mock panel
 */
export function panelAt(index = 0): any {
	const vscode = require('vscode');
	return vscode.window.createWebviewPanel.mock.results[index].value;
}

/**
 * Lists the messages of one type a mock panel was sent.
 *
 * @param panel The mock panel
 * @param type The message type
 * @returns The messages, oldest first
 */
export function sent<T extends HostToView['type']>(panel: any, type: T): Extract<HostToView, { type: T }>[] {
	return panel.posted.filter((message: HostToView) => message.type === type);
}
