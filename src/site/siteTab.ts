import { openInEditor, openInPreview } from '@controllers';
import * as vscode from 'vscode';
import { parseViewMessage, toSiteNode } from './messages';
import { loadPageContent } from './pageContent';
import type { HostToView, PageData, SiteRoute, ViewToHost } from './protocol';
import type { WikiSiteManager } from './sitePanel';

/**
 * Creates a random nonce for the webview's Content Security Policy.
 *
 * @returns 32 hex characters
 */
function createNonce(): string {
	const bytes = new Uint8Array(16);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** One Wiki Site tab: its webview document, and the messages between it and the host. */
export class WikiSiteTab {
	/** The page this tab last showed, so a save of that page re-renders it. */
	private currentUri: string | undefined;
	/** A route to show once the webview reports ready, set when the tab was opened on a page. */
	private pendingRoute: SiteRoute | undefined;

	/**
	 * @param manager The manager owning this tab
	 * @param panel The VS Code webview panel
	 * @param route The page to open on, if not the home page
	 */
	constructor(
		private readonly manager: WikiSiteManager,
		readonly panel: vscode.WebviewPanel,
		route?: SiteRoute,
	) {
		this.pendingRoute = route;
		panel.webview.html = this.renderHtml();
		panel.webview.onDidReceiveMessage((raw) => {
			const message = parseViewMessage(raw);
			if (message) {
				void this.handleMessage(message).catch((error) =>
					console.error('[WorkspaceWiki] Wiki Site message failed:', message.type, error),
				);
			}
		});
	}

	/**
	 * Brings the tab forward, optionally moving it to a page.
	 *
	 * A hidden tab's webview is unloaded and reloads when shown, and a message posted before it is
	 * ready is lost, so for a hidden tab the route waits and goes out with the reloaded page's `init`.
	 *
	 * @param route The page to show
	 */
	reveal(route?: SiteRoute): void {
		const visible = this.panel.visible;
		this.panel.reveal();
		if (route?.kind !== 'page') {
			return;
		}
		if (visible) {
			this.post({ type: 'goto', uri: route.uri, fragment: route.fragment });
		} else {
			this.pendingRoute = route;
		}
	}

	/**
	 * Posts a message to the webview.
	 *
	 * @param message The message
	 */
	post(message: HostToView): void {
		void this.panel.webview.postMessage(message);
	}

	/** Sends the webview the site settings and tree, with any route the tab was opened on. */
	async sendInit(): Promise<void> {
		const [tree, site] = await Promise.all([this.manager.getTree(), this.manager.siteInfo(this.panel.webview)]);
		const route = this.pendingRoute;
		this.pendingRoute = undefined;
		this.post({ type: 'init', site, tree: tree.map(toSiteNode), route });
	}

	/**
	 * Re-renders the page if this tab is showing it.
	 *
	 * @param uri `uri.toString()` of the changed page
	 */
	async reloadIfShowing(uri: string): Promise<void> {
		if (this.currentUri === uri) {
			await this.sendPage(uri);
		}
	}

	private async handleMessage(message: ViewToHost): Promise<void> {
		switch (message.type) {
			case 'ready':
				await this.sendInit();
				return;
			case 'navigate':
				await this.sendPage(message.uri, message.fragment);
				return;
			case 'title':
				this.panel.title = message.title.trim() || this.manager.siteName();
				return;
			case 'openLink':
				await this.manager.openLink(this, message.href, message.fromUri, message.newTab);
				return;
			case 'openExternal':
				await this.manager.openExternal(message.url, message.integrated);
				return;
			case 'openOriginal': {
				const node = await this.manager.findDoc(message.uri);
				if (node) {
					(message.mode === 'editor' ? openInEditor : openInPreview)(node.uri);
				}
				return;
			}
			case 'openInNewTab': {
				const node = await this.manager.findDoc(message.uri);
				if (node) {
					this.manager.open(node.uri, { newTab: true });
				}
				return;
			}
			case 'search': {
				const results = await this.manager.search(message.query);
				this.post({ type: 'searchResults', query: message.query, results });
				return;
			}
		}
	}

	private async sendPage(uri: string, fragment?: string): Promise<void> {
		// Only wiki pages are served: a webview asking for any other URI does not get its contents.
		const node = await this.manager.findDoc(uri);
		if (!node) {
			this.post({ type: 'pageError', uri, message: 'This page is not part of the wiki.' });
			return;
		}

		this.currentUri = uri;
		const webview = this.panel.webview;
		try {
			const { kind, content, language, truncated } = await loadPageContent(node.uri, (target) =>
				this.manager.workspace.fs.readFile(target),
			);
			const folder = vscode.Uri.joinPath(node.uri, '..');
			const page: PageData = {
				uri,
				title: node.title,
				path: node.path,
				kind,
				content,
				language,
				truncated,
				description: node.description,
				resourceBase: webview.asWebviewUri(folder).toString(),
				rootBase: webview.asWebviewUri(this.manager.workspaceFolderOf(node.uri) ?? folder).toString(),
				fileSrc: kind === 'image' ? webview.asWebviewUri(node.uri).toString() : undefined,
			};
			this.post({ type: 'page', page, fragment });
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : String(error);
			this.post({ type: 'pageError', uri, message: `Could not read this file: ${reason}` });
		}
	}

	private renderHtml(): string {
		const webview = this.panel.webview;
		const nonce = createNonce();
		const asset = (file: string) =>
			webview.asWebviewUri(vscode.Uri.joinPath(this.manager.extensionUri, 'dist', 'webview', file)).toString();
		const csp = [
			"default-src 'none'",
			`img-src ${webview.cspSource} https: data:`,
			// Mermaid writes inline styles into the diagrams it draws.
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`font-src ${webview.cspSource}`,
			`script-src 'nonce-${nonce}'`,
		].join('; ');

		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset('site.css')}">
<title>Workspace Wiki</title>
</head>
<body>
<div id="app" data-mermaid-src="${asset('mermaid.js')}"></div>
<script nonce="${nonce}" src="${asset('site.js')}"></script>
</body>
</html>`;
	}
}
