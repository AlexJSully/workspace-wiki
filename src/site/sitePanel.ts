import { openInEditor, openInPreview } from '@controllers';
import { loadWikiTree } from '@tree/loadWikiTree';
import type { TreeNode, WorkspaceLike } from '@types';
import * as vscode from 'vscode';
import { type SiteBranding, findSiteBranding } from './branding';
import { containingFolder, resolveDocLink } from './links';
import { loadPageContent } from './pageContent';
import {
	type HostToView,
	type PageData,
	SITE_VIEW_TYPE,
	type SiteContextData,
	type SiteInfo,
	type SiteNode,
	type SiteRoute,
	type SiteTheme,
	type ViewToHost,
} from './protocol';
import { SearchIndex, flattenFiles } from './search';

/** Themes the `workspaceWiki.site.theme` setting accepts. */
const SITE_THEMES: readonly SiteTheme[] = ['vscode', 'paper', 'slate', 'lagoon'];
/**
 * Command of VS Code's integrated browser. Each call opens the URL in a new browser tab, since it
 * creates a fresh editor unless given a `reuseUrlFilter`. Present in desktop VS Code builds that ship
 * the integrated browser, and absent elsewhere.
 */
const INTEGRATED_BROWSER_COMMAND = 'workbench.action.browser.open';
/** Command of the built-in Simple Browser, used where the integrated browser is not available. */
const SIMPLE_BROWSER_COMMAND = 'simpleBrowser.api.open';
/** Schemes a link may open in the default browser or mail client. */
const OPENABLE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'ftp']);
/** Schemes the integrated browser can load. */
const BROWSABLE_SCHEMES = new Set(['http', 'https']);
/** Schemes on which the workbench can draw a workspace image as a tab icon. */
const TAB_ICON_SCHEMES = new Set(['file', 'vscode-remote']);

/** Options for {@link WikiSiteManager.open}. */
export interface OpenSiteOptions {
	/** Open another tab rather than revealing the existing one. */
	newTab?: boolean;
	/** Editor group to open in; the active group by default. */
	viewColumn?: vscode.ViewColumn;
}

/**
 * Converts a tree node to its JSON form for the webview.
 *
 * @param node The node
 * @returns The node with its URI serialized and children converted
 */
export function toSiteNode(node: TreeNode): SiteNode {
	const siteNode: SiteNode = {
		type: node.type,
		name: node.name,
		title: node.title,
		path: node.path,
		uri: node.uri.toString(),
	};
	if (node.description) {
		siteNode.description = node.description;
	}
	if (node.isIndex) {
		siteNode.isIndex = true;
	}
	if (node.isReadme) {
		siteNode.isReadme = true;
	}
	if (node.children) {
		siteNode.children = node.children.map(toSiteNode);
	}
	return siteNode;
}

/**
 * Checks a message from the webview against the protocol.
 *
 * The webview renders workspace content, which is sanitized but still not trusted, so every field
 * is type-checked before the host acts on it.
 *
 * @param raw The posted value
 * @returns The message, or undefined when it does not match any message shape
 */
export function parseViewMessage(raw: unknown): ViewToHost | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const message = raw as Record<string, unknown>;
	const isString = (key: string) => typeof message[key] === 'string';

	switch (message.type) {
		case 'ready':
			return { type: 'ready' };
		case 'navigate':
			return isString('uri') && (message.fragment === undefined || isString('fragment'))
				? { type: 'navigate', uri: message.uri as string, fragment: message.fragment as string | undefined }
				: undefined;
		case 'title':
			return isString('title') ? { type: 'title', title: message.title as string } : undefined;
		case 'openLink':
			return isString('href') && isString('fromUri') && typeof message.newTab === 'boolean'
				? {
						type: 'openLink',
						href: message.href as string,
						fromUri: message.fromUri as string,
						newTab: message.newTab,
					}
				: undefined;
		case 'openExternal':
			return isString('url') && typeof message.integrated === 'boolean'
				? { type: 'openExternal', url: message.url as string, integrated: message.integrated }
				: undefined;
		case 'openOriginal':
			return isString('uri') && (message.mode === 'preview' || message.mode === 'editor')
				? { type: 'openOriginal', uri: message.uri as string, mode: message.mode }
				: undefined;
		case 'openInNewTab':
			return isString('uri') ? { type: 'openInNewTab', uri: message.uri as string } : undefined;
		case 'search':
			return isString('query') ? { type: 'search', query: message.query as string } : undefined;
		default:
			return undefined;
	}
}

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

/**
 * Owns every Wiki Site tab: the shared tree, the search index, and the site settings they render.
 *
 * The tree is loaded once and shared, through the same {@link loadWikiTree} the sidebar uses, so
 * the site always shows the documents, order, and titles the sidebar does.
 */
export class WikiSiteManager implements vscode.Disposable {
	private readonly panels = new Set<WikiSitePanel>();
	private tree: Promise<TreeNode[]> | undefined;
	private docs = new Map<string, TreeNode>();
	private branding: Promise<SiteBranding> | undefined;
	private readonly searchIndex: SearchIndex;

	/**
	 * @param extensionUri The extension's install location, holding the webview bundle and icon
	 * @param workspace The workspace API used to discover and read documents
	 */
	constructor(
		readonly extensionUri: vscode.Uri,
		readonly workspace: WorkspaceLike,
	) {
		this.searchIndex = new SearchIndex((uri) => workspace.fs.readFile(uri));
	}

	/**
	 * Opens the site, or reveals the tab already open.
	 *
	 * @param target A page to show; the home page when omitted
	 * @param options Whether to open another tab, and in which editor group
	 * @returns The tab showing the site
	 */
	open(target?: vscode.Uri, options: OpenSiteOptions = {}): WikiSitePanel {
		const route: SiteRoute | undefined = target ? { kind: 'page', uri: target.toString() } : undefined;
		const existing = options.newTab ? undefined : [...this.panels].pop();
		if (existing) {
			existing.reveal(route);
			return existing;
		}

		const folders = (this.workspace.workspaceFolders ?? []).map((folder) => folder.uri);
		const panel = vscode.window.createWebviewPanel(
			SITE_VIEW_TYPE,
			this.siteName(),
			options.viewColumn ?? vscode.ViewColumn.Active,
			{
				enableScripts: true,
				enableFindWidget: true,
				localResourceRoots: [
					vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
					vscode.Uri.joinPath(this.extensionUri, 'media'),
					...folders,
				],
			},
		);

		const sitePanel = new WikiSitePanel(this, panel, route);
		this.panels.add(sitePanel);
		panel.onDidDispose(() => this.panels.delete(sitePanel));
		void this.applyTabIcon(panel);
		return sitePanel;
	}

	/** The open tabs. */
	get openPanels(): readonly WikiSitePanel[] {
		return [...this.panels];
	}

	/**
	 * Drops the cached tree, logo, and search text, then re-sends every tab its site so it shows the
	 * current documents and settings.
	 */
	refresh(): void {
		this.tree = undefined;
		this.branding = undefined;
		this.searchIndex.invalidate();
		for (const panel of this.panels) {
			void panel.sendInit();
			void this.applyTabIcon(panel.panel);
		}
	}

	/**
	 * Keeps the site current after a document is saved: its search text is re-read and any tab
	 * showing it re-renders.
	 *
	 * @param uri The saved document
	 */
	async handleSave(uri: vscode.Uri): Promise<void> {
		if (!this.docs.has(uri.toString())) {
			return;
		}
		await this.searchIndex.update(uri);
		for (const panel of this.panels) {
			await panel.reloadIfShowing(uri.toString());
		}
	}

	/**
	 * Loads the wiki tree, sharing one load between every tab until the next {@link refresh}.
	 *
	 * @returns The tree's roots
	 */
	getTree(): Promise<TreeNode[]> {
		if (!this.tree) {
			this.tree = loadWikiTree(this.workspace).then((tree) => {
				const files = flattenFiles(tree);
				this.docs = new Map(files.map((node) => [node.uri.toString(), node]));
				this.searchIndex.setFiles(files);
				return tree;
			});
		}
		return this.tree;
	}

	/**
	 * Looks a page up by URI.
	 *
	 * @param uri `uri.toString()` of the page
	 * @returns The page's node, or undefined when it is not in the wiki
	 */
	async findDoc(uri: string): Promise<TreeNode | undefined> {
		await this.getTree();
		return this.docs.get(uri);
	}

	/**
	 * Searches the wiki.
	 *
	 * @param query The user's query
	 * @returns Ranked results
	 */
	async search(query: string) {
		await this.getTree();
		return this.searchIndex.search(query);
	}

	/**
	 * Resolves the target of a webview context-menu command.
	 *
	 * @param context The `data-vscode-context` of the element right-clicked
	 * @returns The wiki page or workspace file it names, or undefined for an external link or no target
	 */
	async resolveContextUri(context: SiteContextData | undefined): Promise<vscode.Uri | undefined> {
		if (!context) {
			return undefined;
		}
		if (typeof context.uri === 'string') {
			return vscode.Uri.parse(context.uri);
		}
		if (typeof context.href === 'string' && typeof context.fromUri === 'string') {
			await this.getTree();
			const target = resolveDocLink(
				context.href,
				vscode.Uri.parse(context.fromUri),
				this.docs,
				this.workspace.workspaceFolders ?? [],
			);
			if (target.kind === 'doc') {
				return target.node.uri;
			}
			if (target.kind === 'file') {
				return target.uri;
			}
		}
		return undefined;
	}

	/**
	 * Resolves a link clicked in a page and opens it: a wiki page in the site (here or in a new tab),
	 * an external URL in the browser, and any other workspace file in its editor.
	 *
	 * @param panel The tab the link was clicked in
	 * @param href The `href` as written
	 * @param fromUri The page the link is on
	 * @param newTab Whether a wiki page should open in another tab
	 */
	async openLink(panel: WikiSitePanel, href: string, fromUri: string, newTab: boolean): Promise<void> {
		await this.getTree();
		const target = resolveDocLink(
			href,
			vscode.Uri.parse(fromUri),
			this.docs,
			this.workspace.workspaceFolders ?? [],
		);

		switch (target.kind) {
			case 'external':
				await this.openExternal(target.url, newTab);
				return;
			case 'doc':
				if (newTab) {
					this.open(target.node.uri, { newTab: true });
				} else {
					panel.post({ type: 'goto', uri: target.node.uri.toString(), fragment: target.fragment });
				}
				return;
			case 'file':
				await vscode.commands.executeCommand('vscode.open', target.uri);
				return;
			case 'anchor':
				return;
		}
	}

	/**
	 * Opens an external link.
	 *
	 * Without `integrated` the link goes to `env.openExternal`, VS Code's own handling of external
	 * links, which is normally the default browser. With `integrated` it opens in a new tab of VS Code's
	 * integrated browser, else the Simple Browser where that is all there is, else the default browser.
	 * Only web pages can open inside VS Code, so `mailto:` and the like always go to `env.openExternal`.
	 *
	 * @param url The link
	 * @param integrated Whether to open inside VS Code
	 */
	async openExternal(url: string, integrated: boolean): Promise<void> {
		let uri: vscode.Uri;
		try {
			uri = vscode.Uri.parse(url, true);
		} catch {
			return;
		}
		if (!OPENABLE_SCHEMES.has(uri.scheme)) {
			return;
		}

		if (integrated && BROWSABLE_SCHEMES.has(uri.scheme)) {
			const commands = await vscode.commands.getCommands(true);
			if (commands.includes(INTEGRATED_BROWSER_COMMAND)) {
				await vscode.commands.executeCommand(INTEGRATED_BROWSER_COMMAND, { url: uri.toString(true) });
				return;
			}
			if (commands.includes(SIMPLE_BROWSER_COMMAND)) {
				await vscode.commands.executeCommand(SIMPLE_BROWSER_COMMAND, uri, {
					viewColumn: vscode.ViewColumn.Active,
					preserveFocus: false,
				});
				return;
			}
		}

		await vscode.env.openExternal(uri);
	}

	/**
	 * Builds the site settings for a tab.
	 *
	 * @param webview The tab's webview, which converts workspace URIs to ones it may load
	 * @returns The site name, logo, theme, and custom stylesheets
	 */
	async siteInfo(webview: vscode.Webview): Promise<SiteInfo> {
		const config = this.workspace.getConfiguration?.('workspaceWiki');
		const theme = config?.get('site.theme');
		const customCss = config?.get('site.customCss');
		const root = this.workspace.workspaceFolders?.[0]?.uri;

		const { logo } = await this.getBranding();
		const info: SiteInfo = {
			name: this.siteName(),
			theme: SITE_THEMES.includes(theme) ? theme : 'vscode',
			customCss:
				root && Array.isArray(customCss)
					? customCss
							.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
							.map((path) =>
								webview
									.asWebviewUri(vscode.Uri.joinPath(root, path.trim().replace(/^\.?\//, '')))
									.toString(),
							)
					: [],
		};
		if (logo) {
			info.logoSrc = webview.asWebviewUri(logo).toString();
		}
		return info;
	}

	/**
	 * The name shown in the header: the workspace's own name, else its first folder's.
	 *
	 * @returns The site name
	 */
	siteName(): string {
		const folder = this.workspace.workspaceFolders?.[0]?.uri.path.split('/').filter(Boolean).pop();
		return vscode.workspace.name || folder || 'Workspace Wiki';
	}

	/**
	 * Finds the workspace folder holding a URI.
	 *
	 * @param uri The URI to place
	 * @returns The deepest workspace folder containing it, or undefined
	 */
	workspaceFolderOf(uri: vscode.Uri): vscode.Uri | undefined {
		return containingFolder(uri, this.workspace.workspaceFolders ?? []);
	}

	private getBranding(): Promise<SiteBranding> {
		if (!this.branding) {
			const configured = this.workspace.getConfiguration?.('workspaceWiki').get('site.logo');
			this.branding = findSiteBranding(this.workspace, typeof configured === 'string' ? configured : '').catch(
				() => ({}),
			);
		}
		return this.branding;
	}

	/**
	 * Sets a tab's icon: the workspace's tab icon when there is one the workbench can draw, otherwise
	 * the Workspace Wiki icon in its light- and dark-theme colours.
	 *
	 * @param panel The tab
	 */
	private async applyTabIcon(panel: vscode.WebviewPanel): Promise<void> {
		const { tabIcon } = await this.getBranding();
		panel.iconPath =
			tabIcon && TAB_ICON_SCHEMES.has(tabIcon.scheme)
				? tabIcon
				: {
						light: vscode.Uri.joinPath(this.extensionUri, 'media', 'icon-light.svg'),
						dark: vscode.Uri.joinPath(this.extensionUri, 'media', 'icon-dark.svg'),
					};
	}

	/** Closes every tab. */
	dispose(): void {
		for (const panel of [...this.panels]) {
			panel.panel.dispose();
		}
		this.panels.clear();
	}
}

/** One Wiki Site tab: its webview document, and the messages between it and the host. */
export class WikiSitePanel {
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
	 * @param route The page to show
	 */
	reveal(route?: SiteRoute): void {
		this.panel.reveal();
		if (route?.kind === 'page') {
			this.post({ type: 'goto', uri: route.uri, fragment: route.fragment });
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
			const content = await loadPageContent(node.uri, (target) => this.manager.workspace.fs.readFile(target));
			const folder = node.uri.with({ path: node.uri.path.slice(0, node.uri.path.lastIndexOf('/')) || '/' });
			const page: PageData = {
				uri,
				title: node.title,
				path: node.path,
				kind: content.kind,
				resourceBase: webview.asWebviewUri(folder).toString(),
				rootBase: webview.asWebviewUri(this.manager.workspaceFolderOf(node.uri) ?? folder).toString(),
				...(content.content !== undefined && { content: content.content }),
				...(content.language && { language: content.language }),
				...(content.truncated && { truncated: true }),
				...(node.description && { description: node.description }),
				...((content.kind === 'image' || content.kind === 'pdf') && {
					fileSrc: webview.asWebviewUri(node.uri).toString(),
				}),
			};
			this.post({ type: 'page', page, fragment });
		} catch (error: any) {
			this.post({ type: 'pageError', uri, message: `Could not read this file: ${error?.message ?? error}` });
		}
	}

	private renderHtml(): string {
		const webview = this.panel.webview;
		const nonce = createNonce();
		const asset = (file: string) =>
			webview.asWebviewUri(vscode.Uri.joinPath(this.manager.extensionUri, 'dist', 'webview', file)).toString();
		const csp = [
			"default-src 'none'",
			// pdf.js draws some PDF images through `blob:` URLs.
			`img-src ${webview.cspSource} https: data: blob:`,
			// Mermaid writes inline styles into the diagrams it draws.
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`font-src ${webview.cspSource}`,
			// pdf.js fetches the PDF it shows.
			`connect-src ${webview.cspSource}`,
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
<div id="app" data-mermaid-src="${asset('mermaid.js')}" data-pdf-src="${asset('pdf.js')}"></div>
<script nonce="${nonce}" src="${asset('site.js')}"></script>
</body>
</html>`;
	}
}
