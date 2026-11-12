import type { HostToView, PageData, SiteInfo, SiteNode, SiteRoute } from '@site/protocol';
import type { HostBridge } from './bridge';
import { el } from './dom';
import { RouteHistory, decodeSafely, findHomePage, flattenFiles } from './helpers';
import { renderMermaid } from './mermaid';
import { NavTree } from './navTree';
import { SearchBox } from './searchBox';
import { Toc } from './toc';
import { landingView, loadingView, messageView, pageView, resultsView } from './views';

/** Settings the page passes the app from its own markup. */
export interface AppOptions {
	/** URL of the lazily loaded Mermaid bundle. */
	mermaidSrc?: string;
	/** The page's script nonce, required for the Mermaid script the app adds. */
	nonce?: string;
}

/**
 * Ids of the shell's own elements. Upper case, so no heading id (always lower case, from `slugify`)
 * can collide with them.
 */
const NAV_ID = 'WikiNav';
const MAIN_ID = 'WikiMain';

/**
 * The Wiki Site: routes between pages, the landing page, and search results, driven entirely by host
 * messages. The navigation, search field, and outline are their own classes; this one coordinates them.
 */
export class WikiSiteApp {
	private site: SiteInfo | undefined;
	private tree: SiteNode[] = [];
	private readonly history: RouteHistory;
	private page: PageData | undefined;
	/** Stops work the shown page started, such as drawing diagrams; called before the page is replaced. */
	private releasePage: (() => void) | undefined;
	/** A scroll position to keep when the page shown is rendered again, after a save or a refresh. */
	private keptScroll: { uri: string; top: number } | undefined;

	private readonly shell: HTMLElement;
	private readonly brand: HTMLAnchorElement;
	private readonly backButton: HTMLButtonElement;
	private readonly forwardButton: HTMLButtonElement;
	private readonly navToggle: HTMLButtonElement;
	private readonly main: HTMLElement;
	private readonly nav: NavTree;
	private readonly search: SearchBox;
	private readonly toc: Toc;

	/**
	 * @param root The element the site renders into
	 * @param bridge The route to the host
	 * @param options Values the page markup supplies
	 */
	constructor(
		root: HTMLElement,
		private readonly bridge: HostBridge,
		private readonly options: AppOptions = {},
	) {
		const saved = bridge.getState() as { history?: unknown; expanded?: unknown } | undefined;
		this.history = RouteHistory.fromJSON(saved?.history);
		const expanded = new Set(
			Array.isArray(saved?.expanded)
				? saved.expanded.filter((uri): uri is string => typeof uri === 'string')
				: [],
		);

		this.shell = el('div', 'wiki');
		this.shell.dataset.state = 'loading';

		this.navToggle = el('button', 'icon-button nav-toggle');
		this.navToggle.type = 'button';
		this.navToggle.setAttribute('aria-label', 'Show navigation');
		this.navToggle.setAttribute('aria-expanded', 'false');
		this.navToggle.setAttribute('aria-controls', NAV_ID);
		this.navToggle.dataset.testid = 'nav-toggle';
		this.navToggle.innerHTML =
			'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg>';

		this.brand = el('a', 'brand');
		this.brand.href = '#';
		this.brand.dataset.home = '';
		this.brand.dataset.testid = 'brand';

		this.search = new SearchBox((route) => this.go(route));

		const historyButtons = el('div', 'history-buttons');
		this.backButton = historyButton('Back', 'history-back', 'M10 3 5 8l5 5');
		this.forwardButton = historyButton('Forward', 'history-forward', 'm6 3 5 5-5 5');
		historyButtons.append(this.backButton, this.forwardButton);

		const header = el('header', 'wiki-header');
		header.append(this.navToggle, this.brand, this.search.element, historyButtons);

		const navElement = el('nav', 'wiki-nav');
		navElement.id = NAV_ID;
		navElement.setAttribute('aria-label', 'Docs');
		navElement.dataset.testid = 'nav';
		this.nav = new NavTree(navElement, expanded, () => this.saveState());

		this.main = el('main', 'wiki-main');
		this.main.id = MAIN_ID;
		this.main.tabIndex = -1;
		this.main.dataset.testid = 'main';

		const tocElement = el('aside', 'wiki-toc');
		tocElement.setAttribute('aria-label', 'On this page');
		tocElement.dataset.testid = 'toc';
		this.toc = new Toc(tocElement, this.main);

		const body = el('div', 'wiki-body');
		body.append(navElement, this.main, tocElement);
		this.shell.append(header, body);
		root.replaceChildren(this.shell);

		this.bindEvents(navElement);
		this.main.append(loadingView('Loading the wiki…'));
		bridge.subscribe((message) => this.receive(message));
		bridge.post({ type: 'ready' });
	}

	/**
	 * Handles a message from the host.
	 *
	 * @param message The message
	 */
	receive(message: HostToView): void {
		switch (message.type) {
			case 'init':
				this.applyInit(message.site, message.tree, message.route);
				return;
			case 'page':
				if (this.shownPageUri() !== message.page.uri) {
					return;
				}
				if (this.page?.uri === message.page.uri) {
					this.keepScroll();
				}
				this.renderPage(message.page, message.fragment ?? this.currentFragment());
				return;
			case 'pageError':
				if (this.shownPageUri() === message.uri) {
					this.main.removeAttribute('aria-busy');
					this.toc.clear();
					this.main.replaceChildren(messageView('This page could not be shown', message.message));
				}
				return;
			case 'goto':
				this.go({ kind: 'page', uri: message.uri, fragment: message.fragment });
				return;
			case 'searchResults': {
				const current = this.history.current;
				if (current?.kind === 'search' && current.query === message.query) {
					this.main.replaceChildren(resultsView(message.query, message.results));
					this.main.scrollTop = 0;
				}
				return;
			}
		}
	}

	/**
	 * Moves to a route and records it in the history.
	 *
	 * @param route Where to go
	 */
	go(route: SiteRoute): void {
		const current = this.history.current;
		const samePage =
			route.kind === 'page' &&
			current?.kind === 'page' &&
			current.uri === route.uri &&
			this.page?.uri === route.uri;
		this.history.push(route);
		if (!samePage) {
			this.show();
			return;
		}
		// Same page: only the anchor changes, so scroll rather than reload.
		this.saveState();
		if (route.kind === 'page' && route.fragment) {
			this.scrollToFragment(route.fragment);
		}
	}

	private applyInit(site: SiteInfo, tree: SiteNode[], route: SiteRoute | undefined): void {
		// A refresh re-sends the site while a page is open; keep the reader where they were on it.
		if (this.page && !route) {
			this.keepScroll();
		}
		this.site = site;
		this.tree = tree;
		this.search.setFiles(flattenFiles(tree));
		this.nav.render(tree);
		this.applyTheme(site);
		this.renderBrand(site);
		this.shell.dataset.state = 'ready';

		if (route) {
			this.history.push(route);
		} else if (!this.history.current) {
			this.history.push({ kind: 'home' });
		}
		this.show();
	}

	private applyTheme(site: SiteInfo): void {
		// High-contrast themes always win: their colours are an accessibility setting, not a style.
		const highContrast = document.body.classList.contains('vscode-high-contrast');
		this.shell.dataset.wikiTheme = highContrast ? 'vscode' : site.theme;

		for (const link of document.head.querySelectorAll('link[data-custom-css]')) {
			link.remove();
		}
		for (const href of site.customCss) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			link.dataset.customCss = '';
			document.head.appendChild(link);
		}
	}

	private renderBrand(site: SiteInfo): void {
		this.brand.replaceChildren();
		if (site.logoSrc) {
			const logo = el('img', 'brand-logo');
			logo.src = site.logoSrc;
			logo.alt = '';
			logo.dataset.testid = 'brand-logo';
			this.brand.append(logo);
		}
		const name = el('span', 'brand-name', site.name);
		name.dataset.testid = 'brand-name';
		this.brand.append(name);
		this.brand.setAttribute('aria-label', `${site.name} home`);
	}

	private bindEvents(navElement: HTMLElement): void {
		this.backButton.addEventListener('click', () => this.step(-1));
		this.forwardButton.addEventListener('click', () => this.step(1));
		this.navToggle.addEventListener('click', () => this.setNavOpen(this.shell.dataset.navOpen !== 'true'));
		document.addEventListener('keydown', (event) => this.onGlobalKey(event));

		// One set of listeners serves every page link, nav entry, breadcrumb, result, and button.
		this.shell.addEventListener('click', (event) => this.onClick(event));
		this.shell.addEventListener('auxclick', (event) => {
			const link = (event.target as HTMLElement).closest('a');
			if (event.button === 1 && link) {
				event.preventDefault();
				this.activateLink(link, { middle: true, modified: false });
			}
		});
		this.shell.addEventListener('mousedown', (event) => {
			// A middle press would otherwise start autoscroll before `auxclick` fires.
			if (event.button === 1 && (event.target as HTMLElement).closest('a')) {
				event.preventDefault();
			}
		});
		navElement.addEventListener('dblclick', (event) => {
			const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-uri]');
			if (link?.dataset.uri) {
				event.preventDefault();
				this.bridge.post({ type: 'openOriginal', uri: link.dataset.uri, mode: 'editor' });
			}
		});
	}

	private onGlobalKey(event: KeyboardEvent): void {
		const target = event.target as HTMLElement;
		const typing = target.closest('input, textarea, [contenteditable="true"]') !== null;

		if ((event.key === '/' && !typing) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
			event.preventDefault();
			this.search.focus();
			return;
		}
		if (event.altKey && event.key === 'ArrowLeft') {
			event.preventDefault();
			this.step(-1);
		} else if (event.altKey && event.key === 'ArrowRight') {
			event.preventDefault();
			this.step(1);
		} else if (event.key === 'Escape' && this.shell.dataset.navOpen === 'true') {
			this.setNavOpen(false);
		}
	}

	private onClick(event: MouseEvent): void {
		const target = event.target as HTMLElement;

		const folder = target.closest<HTMLButtonElement>('button[data-folder]');
		if (folder?.dataset.folder) {
			this.nav.toggle(folder.dataset.folder);
			return;
		}

		const open = target.closest<HTMLButtonElement>('button[data-open]');
		if (open && this.page) {
			const mode = open.dataset.open === 'editor' ? 'editor' : 'preview';
			this.bridge.post({ type: 'openOriginal', uri: this.page.uri, mode });
			return;
		}

		const link = target.closest('a');
		if (link) {
			event.preventDefault();
			this.activateLink(link, { middle: false, modified: event.ctrlKey || event.metaKey });
		}
	}

	/**
	 * Follows a link for a click. A middle click or Ctrl/Cmd+click opens a page in a new tab, and a
	 * middle click opens an external link inside VS Code rather than in the default browser.
	 *
	 * @param link The link clicked
	 * @param click Which button, and whether Ctrl or Cmd was held
	 */
	private activateLink(link: HTMLAnchorElement, click: { middle: boolean; modified: boolean }): void {
		const newTab = click.middle || click.modified;

		if (link.dataset.home !== undefined) {
			this.go({ kind: 'home' });
			return;
		}

		if (link.dataset.uri) {
			if (newTab) {
				this.bridge.post({ type: 'openInNewTab', uri: link.dataset.uri });
			} else {
				this.go({ kind: 'page', uri: link.dataset.uri });
				this.setNavOpen(false);
			}
			return;
		}

		const href = link.getAttribute('href') ?? '';
		switch (link.dataset.linkKind) {
			case 'anchor':
				if (!click.middle) {
					this.scrollToFragment(decodeSafely(href.slice(1)));
				}
				return;
			case 'external':
				this.bridge.post({ type: 'openExternal', url: href, integrated: click.middle });
				return;
			case 'internal':
				if (this.page) {
					this.bridge.post({ type: 'openLink', href, fromUri: this.page.uri, newTab });
				}
				return;
		}
	}

	private setNavOpen(open: boolean): void {
		this.shell.dataset.navOpen = String(open);
		this.navToggle.setAttribute('aria-expanded', String(open));
		this.navToggle.setAttribute('aria-label', open ? 'Hide navigation' : 'Show navigation');
	}

	private step(direction: -1 | 1): void {
		const route = direction < 0 ? this.history.back() : this.history.forward();
		if (route) {
			this.show();
		}
	}

	/** Renders whatever the current route is. */
	private show(): void {
		this.release();
		this.saveState();
		this.backButton.disabled = !this.history.canGoBack;
		this.forwardButton.disabled = !this.history.canGoForward;

		const route = this.history.current ?? { kind: 'home' };
		const uri =
			route.kind === 'page' ? route.uri : route.kind === 'home' ? findHomePage(this.tree)?.uri : undefined;
		if (uri) {
			this.page = undefined;
			this.nav.setActive(uri);
			this.main.setAttribute('aria-busy', 'true');
			const fragment = route.kind === 'page' ? route.fragment : undefined;
			this.bridge.post(fragment ? { type: 'navigate', uri, fragment } : { type: 'navigate', uri });
			return;
		}

		this.page = undefined;
		this.nav.setActive(undefined);
		this.toc.clear();
		if (route.kind === 'search') {
			this.search.setQuery(route.query);
			this.main.replaceChildren(loadingView(`Searching for “${route.query}”…`));
			this.setTitle(`Search: ${route.query}`);
			this.bridge.post({ type: 'search', query: route.query });
			return;
		}
		const name = this.site?.name ?? 'Workspace Wiki';
		this.setTitle(name);
		this.main.replaceChildren(landingView(name, this.tree));
	}

	private saveState(): void {
		this.bridge.setState({ history: this.history.toJSON(), expanded: [...this.nav.expanded] });
	}

	/** The page the current route shows: its own URI, or the README the home route resolves to. */
	private shownPageUri(): string | undefined {
		const route = this.history.current;
		if (route?.kind === 'page') {
			return route.uri;
		}
		return route?.kind === 'home' ? findHomePage(this.tree)?.uri : undefined;
	}

	private currentFragment(): string | undefined {
		const route = this.history.current;
		return route?.kind === 'page' ? route.fragment : undefined;
	}

	private setTitle(title: string): void {
		this.bridge.post({ type: 'title', title });
	}

	private keepScroll(): void {
		const uri = this.page?.uri ?? this.shownPageUri();
		if (uri) {
			this.keptScroll = { uri, top: this.main.scrollTop };
		}
	}

	/** Stops work the shown page started before something replaces it. */
	private release(): void {
		this.releasePage?.();
		this.releasePage = undefined;
	}

	private renderPage(page: PageData, fragment: string | undefined): void {
		this.release();
		const kept = this.keptScroll?.uri === page.uri ? this.keptScroll.top : undefined;
		this.keptScroll = undefined;
		this.page = page;
		this.main.removeAttribute('aria-busy');
		this.setTitle(page.title);

		const { article, body } = pageView(page, this.tree);
		this.main.replaceChildren(article);
		this.nav.setActive(page.uri);
		this.toc.render(body);

		if (kept !== undefined) {
			this.main.scrollTop = kept;
		} else if (fragment) {
			this.scrollToFragment(fragment);
		} else {
			this.main.scrollTop = 0;
		}

		this.releasePage = renderMermaid(body, this.options.mermaidSrc, this.options.nonce, this.isDark());
	}

	private isDark(): boolean {
		const theme = this.shell.dataset.wikiTheme;
		if (theme === 'slate') {
			return true;
		}
		if (theme === 'vscode') {
			const classes = document.body.classList;
			return (
				classes.contains('vscode-dark') ||
				(classes.contains('vscode-high-contrast') && !classes.contains('vscode-high-contrast-light'))
			);
		}
		return false;
	}

	/**
	 * Scrolls to a heading or element on the shown page. Only the page is searched, so an id the shell
	 * itself uses can never be the target.
	 *
	 * @param fragment The id, as written after `#`
	 */
	private scrollToFragment(fragment: string): void {
		const find = (id: string) => this.main.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
		const target = find(fragment) ?? find(fragment.toLowerCase());
		if (target) {
			target.scrollIntoView({ block: 'start' });
			target.classList.add('target-flash');
			setTimeout(() => target.classList.remove('target-flash'), 1200);
		}
	}
}

/**
 * Creates a back or forward button for the header.
 *
 * @param label The button's accessible name
 * @param testid Its test id
 * @param path The SVG path of its arrow
 * @returns The button, disabled until there is history to move through
 */
function historyButton(label: string, testid: string, path: string): HTMLButtonElement {
	const button = el('button', 'icon-button');
	button.type = 'button';
	button.setAttribute('aria-label', label);
	button.title = `${label} (Alt+${label === 'Back' ? 'Left' : 'Right'})`;
	button.dataset.testid = testid;
	button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
	button.disabled = true;
	return button;
}

/**
 * Starts the site in a page.
 *
 * @param root The element to render into
 * @param bridge The route to the host
 * @param options Values the page markup supplies
 * @returns The running app
 */
export function startApp(root: HTMLElement, bridge: HostBridge, options: AppOptions = {}): WikiSiteApp {
	return new WikiSiteApp(root, bridge, options);
}
