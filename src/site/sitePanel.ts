import { flattenFiles } from '@site/webview/helpers';
import { loadWikiTree } from '@tree/loadWikiTree';
import type { TreeNode, WorkspaceLike } from '@types';
import { getFileName, resolveSettingPath } from '@utils';
import * as vscode from 'vscode';
import { type SiteBranding, findSiteBranding } from './branding';
import { type LinkTarget, containingFolder, resolveDocLink } from './links';
import { parseSiteContext } from './messages';
import { EXTERNAL_SCHEMES, SITE_VIEW_TYPE, type SiteInfo, type SiteRoute, type SiteTheme } from './protocol';
import { SearchIndex } from './search';
import { WikiSiteTab } from './siteTab';

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
const OPENABLE_SCHEMES = new Set(EXTERNAL_SCHEMES);
/** Schemes the integrated browser can load. */
const BROWSABLE_SCHEMES = new Set(['http', 'https']);

/** Options for {@link WikiSiteManager.open}. */
export interface OpenSiteOptions {
	/** Open another tab rather than revealing the existing one. */
	newTab?: boolean;
	/** Editor group to open in; the active group by default. */
	viewColumn?: vscode.ViewColumn;
}

/**
 * Owns every Wiki Site tab: the shared tree, the search index, and the site settings they render.
 *
 * The tree is loaded once and shared, through the same {@link loadWikiTree} the sidebar uses, so
 * the site always shows the documents, order, and titles the sidebar does.
 *
 * Every URI the webview can make the host act on, through a message or a right-click command, is
 * checked here: a page must be in the wiki tree, and any other file must sit inside a workspace folder.
 */
export class WikiSiteManager implements vscode.Disposable {
	private readonly tabs = new Set<WikiSiteTab>();
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
	open(target?: vscode.Uri, options: OpenSiteOptions = {}): WikiSiteTab {
		const route: SiteRoute | undefined = target ? { kind: 'page', uri: target.toString() } : undefined;
		const existing = options.newTab ? undefined : [...this.tabs].pop();
		if (existing) {
			existing.reveal(route);
			return existing;
		}

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
					...this.folders.map((folder) => folder.uri),
				],
			},
		);

		const tab = new WikiSiteTab(this, panel, route);
		this.tabs.add(tab);
		panel.onDidDispose(() => this.closeTab(tab));
		void this.applyTabIcon(panel);
		return tab;
	}

	/** The open tabs. */
	get openTabs(): readonly WikiSiteTab[] {
		return [...this.tabs];
	}

	/**
	 * Drops the cached tree, logo, and search text, then re-sends every tab its site so it shows the
	 * current documents and settings.
	 */
	refresh(): void {
		this.tree = undefined;
		this.branding = undefined;
		for (const tab of this.tabs) {
			void tab.sendInit();
			void this.applyTabIcon(tab.panel);
		}
	}

	/**
	 * Keeps the site current after a document is saved: its search text is re-read and any tab
	 * showing it re-renders.
	 *
	 * @param uri The saved document
	 */
	async handleSave(uri: vscode.Uri): Promise<void> {
		const node = this.docs.get(uri.toString());
		if (!node) {
			return;
		}
		await this.searchIndex.update(node);
		await Promise.all([...this.tabs].map((tab) => tab.reloadIfShowing(uri.toString())));
	}

	/**
	 * Loads the wiki tree, sharing one load between every tab until the next {@link refresh}.
	 *
	 * @returns The tree's roots
	 */
	getTree(): Promise<TreeNode[]> {
		if (!this.tree) {
			const loading: Promise<TreeNode[]> = loadWikiTree(this.workspace).then((tree) => {
				// A refresh during the load started a newer one; only the newest may set the page index.
				if (this.tree === loading) {
					const files = flattenFiles(tree);
					this.docs = new Map(files.map((node) => [node.uri.toString(), node]));
					this.searchIndex.setFiles(files);
				}
				return tree;
			});
			this.tree = loading;
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
	 * Resolves the target of a webview right-click command.
	 *
	 * The context can come from page content, so a `uri` is accepted only when it names a wiki page,
	 * and a link written in a page only when that page is in the wiki and the link stays inside a
	 * workspace folder.
	 *
	 * @param raw The command's argument: the `data-vscode-context` of the element right-clicked
	 * @returns The wiki page or workspace file it names, or undefined for an external link, no target,
	 * or a target outside the workspace
	 */
	async resolveContextUri(raw: unknown): Promise<vscode.Uri | undefined> {
		const context = parseSiteContext(raw);
		if (context?.uri !== undefined) {
			return (await this.findDoc(context.uri))?.uri;
		}
		if (context?.href === undefined || context.fromUri === undefined) {
			return undefined;
		}
		const target = await this.resolveLink(context.href, context.fromUri);
		if (target?.kind === 'doc') {
			return target.node.uri;
		}
		return target?.kind === 'file' ? target.uri : undefined;
	}

	/**
	 * Resolves a link clicked in a page and opens it: a wiki page in the site (here or in a new tab),
	 * an external URL in the browser, and any other workspace file in its editor.
	 *
	 * @param tab The tab the link was clicked in
	 * @param href The `href` as written
	 * @param fromUri The page the link is on
	 * @param newTab Whether a wiki page should open in another tab
	 */
	async openLink(tab: WikiSiteTab, href: string, fromUri: string, newTab: boolean): Promise<void> {
		const target = await this.resolveLink(href, fromUri);
		switch (target?.kind) {
			case 'external':
				await this.openExternal(target.url, newTab);
				return;
			case 'doc':
				if (newTab) {
					this.open(target.node.uri, { newTab: true });
				} else {
					tab.post({ type: 'goto', uri: target.node.uri.toString(), fragment: target.fragment });
				}
				return;
			case 'file':
				await vscode.commands.executeCommand('vscode.open', target.uri);
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
		const root = this.folders[0]?.uri;

		const stylesheets = root && Array.isArray(customCss) ? customCss : [];
		const { logo } = await this.getBranding();
		return {
			name: this.siteName(),
			theme: SITE_THEMES.includes(theme) ? theme : 'vscode',
			customCss: stylesheets
				.map((path) => (root && typeof path === 'string' ? resolveSettingPath(root, path) : undefined))
				.filter((uri): uri is vscode.Uri => uri !== undefined)
				.map((uri) => webview.asWebviewUri(uri).toString()),
			logoSrc: logo ? webview.asWebviewUri(logo).toString() : undefined,
		};
	}

	/**
	 * The name shown in the header: the workspace's own name, else its first folder's.
	 *
	 * @returns The site name
	 */
	siteName(): string {
		const folder = this.folders[0] ? getFileName(this.folders[0].uri.path) : '';
		return vscode.workspace.name || folder || 'Workspace Wiki';
	}

	/**
	 * Finds the workspace folder holding a URI.
	 *
	 * @param uri The URI to place
	 * @returns The deepest workspace folder containing it, or undefined
	 */
	workspaceFolderOf(uri: vscode.Uri): vscode.Uri | undefined {
		return containingFolder(uri, this.folders);
	}

	/** Closes every tab. */
	dispose(): void {
		for (const tab of [...this.tabs]) {
			tab.panel.dispose();
		}
		this.tabs.clear();
	}

	private get folders(): readonly { uri: vscode.Uri }[] {
		return this.workspace.workspaceFolders ?? [];
	}

	/**
	 * Resolves a link written in a wiki page, keeping only targets the host may open: wiki pages,
	 * external links, and files inside a workspace folder.
	 *
	 * @param href The `href` as written
	 * @param fromUri `uri.toString()` of the page the link is on, which must be a wiki page
	 * @returns Where the link leads, or undefined when it leads outside the workspace or comes from
	 * a page that is not in the wiki
	 */
	private async resolveLink(href: string, fromUri: string): Promise<LinkTarget | undefined> {
		const from = await this.findDoc(fromUri);
		if (!from) {
			return undefined;
		}
		const target = resolveDocLink(href, from.uri, this.docs, this.folders);
		return target.kind === 'file' && !this.workspaceFolderOf(target.uri) ? undefined : target;
	}

	/** Forgets a closed tab, and with the last one the tree and search text it was holding. */
	private closeTab(tab: WikiSiteTab): void {
		this.tabs.delete(tab);
		if (this.tabs.size === 0) {
			this.tree = undefined;
			this.docs = new Map();
			this.searchIndex.setFiles([]);
		}
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
	 * Sets a tab's icon: the workspace's tab icon when it has one, otherwise the Workspace Wiki icon in
	 * its light- and dark-theme colours.
	 *
	 * @param panel The tab
	 */
	private async applyTabIcon(panel: vscode.WebviewPanel): Promise<void> {
		const { tabIcon } = await this.getBranding();
		panel.iconPath = tabIcon ?? {
			light: vscode.Uri.joinPath(this.extensionUri, 'media', 'icon-light.svg'),
			dark: vscode.Uri.joinPath(this.extensionUri, 'media', 'icon-dark.svg'),
		};
	}
}
