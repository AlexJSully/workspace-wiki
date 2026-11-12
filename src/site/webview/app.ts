import type { HostToView, PageData, SearchResult, SiteInfo, SiteNode, SiteRoute } from '@site/protocol';
import type { HostBridge } from './bridge';
import { RouteHistory, findAncestors, findHomePage, flattenFiles, splitByRanges, suggestPages } from './helpers';
import { renderMermaid } from './mermaid';
import { renderPdf } from './pdf';
import { highlightCode, renderDocument } from './render';

/** Settings the page passes the app from its own markup. */
export interface AppOptions {
	/** URL of the lazily loaded Mermaid bundle. */
	mermaidSrc?: string;
	/** URL of the lazily loaded pdf.js bundle. */
	pdfSrc?: string;
	/** The page's script nonce, required for the Mermaid script the app adds. */
	nonce?: string;
}

/** Context attached to elements that name a wiki page, for the webview's right-click menu. */
interface DocContext {
	webviewSection: 'doc';
	uri: string;
	preventDefaultContextMenuItems: true;
}

/**
 * Creates an element with a class and text in one step.
 *
 * @param tag The tag name
 * @param className The class attribute, if any
 * @param text The text content, if any
 * @returns The element
 */
function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	if (className) {
		element.className = className;
	}
	if (text !== undefined) {
		element.textContent = text;
	}
	return element;
}

/**
 * The context-menu data for an element naming a page.
 *
 * @param uri The page
 * @returns The JSON for `data-vscode-context`
 */
function docContext(uri: string): string {
	const context: DocContext = { webviewSection: 'doc', uri, preventDefaultContextMenuItems: true };
	return JSON.stringify(context);
}

/**
 * The Wiki Site: header, navigation, page, outline, and search, driven entirely by host messages.
 */
export class WikiSiteApp {
	private site: SiteInfo | undefined;
	private tree: SiteNode[] = [];
	private files: SiteNode[] = [];
	private history: RouteHistory;
	private expanded = new Set<string>();
	private page: PageData | undefined;
	/** Frees what the shown page holds, such as an open PDF; called before the page is replaced. */
	private releasePage: (() => void) | undefined;
	private tocObserver: IntersectionObserver | undefined;
	private suggestions: SiteNode[] = [];
	private activeSuggestion = -1;

	private readonly shell: HTMLElement;
	private readonly brand: HTMLAnchorElement;
	private readonly searchInput: HTMLInputElement;
	private readonly suggestionList: HTMLUListElement;
	private readonly backButton: HTMLButtonElement;
	private readonly forwardButton: HTMLButtonElement;
	private readonly navToggle: HTMLButtonElement;
	private readonly nav: HTMLElement;
	private readonly main: HTMLElement;
	private readonly toc: HTMLElement;

	/**
	 * @param root The element the site renders into
	 * @param bridge The route to the host
	 * @param options Values the page markup supplies
	 */
	constructor(
		private readonly root: HTMLElement,
		private readonly bridge: HostBridge,
		private readonly options: AppOptions = {},
	) {
		const saved = bridge.getState() as { history?: unknown; expanded?: unknown } | undefined;
		this.history = RouteHistory.fromJSON(saved?.history);
		if (Array.isArray(saved?.expanded)) {
			this.expanded = new Set(saved.expanded.filter((uri): uri is string => typeof uri === 'string'));
		}

		this.shell = el('div', 'wiki');
		this.shell.dataset.state = 'loading';

		const header = el('header', 'wiki-header');
		this.navToggle = el('button', 'icon-button nav-toggle');
		this.navToggle.type = 'button';
		this.navToggle.setAttribute('aria-label', 'Show navigation');
		this.navToggle.setAttribute('aria-expanded', 'false');
		this.navToggle.setAttribute('aria-controls', 'wiki-nav');
		this.navToggle.dataset.testid = 'nav-toggle';
		this.navToggle.innerHTML =
			'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg>';

		this.brand = el('a', 'brand');
		this.brand.href = '#';
		this.brand.dataset.testid = 'brand';

		const search = el('div', 'search');
		search.setAttribute('role', 'search');
		this.searchInput = el('input', 'search-input');
		this.searchInput.type = 'search';
		this.searchInput.placeholder = 'Search the docs';
		this.searchInput.setAttribute('aria-label', 'Search the docs');
		this.searchInput.setAttribute('role', 'combobox');
		this.searchInput.setAttribute('aria-autocomplete', 'list');
		this.searchInput.setAttribute('aria-expanded', 'false');
		this.searchInput.setAttribute('aria-controls', 'search-suggestions');
		this.searchInput.autocomplete = 'off';
		this.searchInput.spellcheck = false;
		this.searchInput.dataset.testid = 'search-input';
		const shortcut = el('kbd', 'search-shortcut', '/');
		shortcut.setAttribute('aria-hidden', 'true');
		this.suggestionList = el('ul', 'suggestions');
		this.suggestionList.id = 'search-suggestions';
		this.suggestionList.setAttribute('role', 'listbox');
		this.suggestionList.setAttribute('aria-label', 'Matching pages');
		this.suggestionList.dataset.testid = 'search-suggestions';
		this.suggestionList.hidden = true;
		search.append(this.searchInput, shortcut, this.suggestionList);

		const historyButtons = el('div', 'history-buttons');
		this.backButton = this.historyButton('Back', 'history-back', 'M10 3 5 8l5 5');
		this.forwardButton = this.historyButton('Forward', 'history-forward', 'm6 3 5 5-5 5');
		historyButtons.append(this.backButton, this.forwardButton);

		header.append(this.navToggle, this.brand, search, historyButtons);

		const body = el('div', 'wiki-body');
		this.nav = el('nav', 'wiki-nav');
		this.nav.id = 'wiki-nav';
		this.nav.setAttribute('aria-label', 'Docs');
		this.nav.dataset.testid = 'nav';
		this.main = el('main', 'wiki-main');
		this.main.id = 'main';
		this.main.tabIndex = -1;
		this.main.dataset.testid = 'main';
		this.toc = el('aside', 'wiki-toc');
		this.toc.setAttribute('aria-label', 'On this page');
		this.toc.dataset.testid = 'toc';
		body.append(this.nav, this.main, this.toc);

		this.shell.append(header, body);
		root.replaceChildren(this.shell);

		this.bindEvents();
		this.main.append(this.loadingNote('Loading the wiki…'));
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
				if (this.isShowingPage(message.page.uri)) {
					this.renderPage(message.page, message.fragment ?? this.currentFragment());
				}
				return;
			case 'pageError':
				if (this.isShowingPage(message.uri)) {
					this.renderMessage('This page could not be shown', message.message);
				}
				return;
			case 'goto':
				this.go({ kind: 'page', uri: message.uri, fragment: message.fragment });
				return;
			case 'searchResults': {
				const current = this.history.current;
				if (current?.kind === 'search' && current.query === message.query) {
					this.renderResults(message.query, message.results);
				}
				return;
			}
		}
	}

	private historyButton(label: string, testid: string, path: string): HTMLButtonElement {
		const button = el('button', 'icon-button');
		button.type = 'button';
		button.setAttribute('aria-label', label);
		button.title = `${label} (Alt+${label === 'Back' ? 'Left' : 'Right'})`;
		button.dataset.testid = testid;
		button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
		button.disabled = true;
		return button;
	}

	private applyInit(site: SiteInfo, tree: SiteNode[], route: SiteRoute | undefined): void {
		this.site = site;
		this.tree = tree;
		this.files = flattenFiles(tree);
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

	private bindEvents(): void {
		this.brand.addEventListener('click', (event) => {
			event.preventDefault();
			this.go({ kind: 'home' });
		});
		this.backButton.addEventListener('click', () => this.step(-1));
		this.forwardButton.addEventListener('click', () => this.step(1));
		this.navToggle.addEventListener('click', () => this.setNavOpen(this.shell.dataset.navOpen !== 'true'));

		this.searchInput.addEventListener('input', () => this.updateSuggestions());
		this.searchInput.addEventListener('keydown', (event) => this.onSearchKey(event));
		this.searchInput.addEventListener('blur', () => {
			// Wait so a click on a suggestion lands before the list goes.
			setTimeout(() => this.closeSuggestions(), 150);
		});

		document.addEventListener('keydown', (event) => this.onGlobalKey(event));

		// One set of listeners serves every page link, nav entry, breadcrumb, and result.
		this.shell.addEventListener('click', (event) => this.onClick(event));
		this.shell.addEventListener('auxclick', (event) => this.onAuxClick(event));
		this.shell.addEventListener('mousedown', (event) => {
			// A middle press would otherwise start autoscroll before `auxclick` fires.
			if (event.button === 1 && (event.target as HTMLElement).closest('a')) {
				event.preventDefault();
			}
		});
		this.nav.addEventListener('dblclick', (event) => {
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
			this.searchInput.focus();
			this.searchInput.select();
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
		if (folder) {
			this.toggleFolder(folder.dataset.folder ?? '');
			return;
		}

		const link = target.closest<HTMLAnchorElement>('a');
		if (!link || link === this.brand) {
			return;
		}

		const newTab = event.ctrlKey || event.metaKey;
		if (link.closest('.suggestions')) {
			this.closeSuggestions();
		}
		if (link.dataset.uri) {
			event.preventDefault();
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
				event.preventDefault();
				this.scrollToFragment(decodeURIComponent(href.slice(1)));
				return;
			case 'external':
				event.preventDefault();
				this.bridge.post({ type: 'openExternal', url: href, integrated: false });
				return;
			case 'internal':
				event.preventDefault();
				if (this.page) {
					this.bridge.post({ type: 'openLink', href, fromUri: this.page.uri, newTab });
				}
				return;
			case 'blocked':
				event.preventDefault();
				return;
		}
	}

	private onAuxClick(event: MouseEvent): void {
		if (event.button !== 1) {
			return;
		}
		const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
		if (!link || link === this.brand) {
			return;
		}
		event.preventDefault();

		if (link.dataset.uri) {
			this.bridge.post({ type: 'openInNewTab', uri: link.dataset.uri });
			return;
		}
		const href = link.getAttribute('href') ?? '';
		if (link.dataset.linkKind === 'external') {
			this.bridge.post({ type: 'openExternal', url: href, integrated: true });
		} else if (link.dataset.linkKind === 'internal' && this.page) {
			this.bridge.post({ type: 'openLink', href, fromUri: this.page.uri, newTab: true });
		}
	}

	private onSearchKey(event: KeyboardEvent): void {
		const count = this.suggestions.length;
		if (event.key === 'ArrowDown' && count > 0) {
			event.preventDefault();
			this.setActiveSuggestion((this.activeSuggestion + 1) % count);
		} else if (event.key === 'ArrowUp' && count > 0) {
			event.preventDefault();
			this.setActiveSuggestion((this.activeSuggestion - 1 + count) % count);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const chosen = this.suggestions[this.activeSuggestion];
			const query = this.searchInput.value.trim();
			this.closeSuggestions();
			if (chosen) {
				this.go({ kind: 'page', uri: chosen.uri });
			} else if (query) {
				this.go({ kind: 'search', query });
			}
		} else if (event.key === 'Escape') {
			if (this.suggestionList.hidden) {
				this.searchInput.blur();
			}
			this.closeSuggestions();
		}
	}

	private updateSuggestions(): void {
		this.suggestions = suggestPages(this.files, this.searchInput.value);
		this.activeSuggestion = -1;
		this.suggestionList.replaceChildren();

		this.suggestions.forEach((node, index) => {
			const item = el('li', 'suggestion');
			item.id = `suggestion-${index}`;
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', 'false');
			const link = el('a', 'suggestion-link');
			link.href = '#';
			link.dataset.uri = node.uri;
			link.dataset.vscodeContext = docContext(node.uri);
			link.tabIndex = -1;
			link.append(el('span', 'suggestion-title', node.title), el('span', 'suggestion-path', node.path));
			item.append(link);
			this.suggestionList.append(item);
		});

		const query = this.searchInput.value.trim();
		if (query) {
			const item = el('li', 'suggestion suggestion-all');
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', 'false');
			item.textContent = `Search all pages for “${query}”`;
			item.addEventListener('mousedown', (event) => {
				event.preventDefault();
				this.closeSuggestions();
				this.go({ kind: 'search', query });
			});
			this.suggestionList.append(item);
		}

		const open = this.suggestionList.childElementCount > 0;
		this.suggestionList.hidden = !open;
		this.searchInput.setAttribute('aria-expanded', String(open));
		this.searchInput.removeAttribute('aria-activedescendant');
	}

	private setActiveSuggestion(index: number): void {
		this.activeSuggestion = index;
		this.suggestionList.querySelectorAll('[role="option"]').forEach((option, i) => {
			option.setAttribute('aria-selected', String(i === index));
		});
		this.searchInput.setAttribute('aria-activedescendant', `suggestion-${index}`);
	}

	private closeSuggestions(): void {
		this.suggestionList.hidden = true;
		this.suggestions = [];
		this.activeSuggestion = -1;
		this.searchInput.setAttribute('aria-expanded', 'false');
		this.searchInput.removeAttribute('aria-activedescendant');
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

	/**
	 * Moves to a route and records it in the history.
	 *
	 * @param route Where to go
	 */
	go(route: SiteRoute): void {
		const current = this.history.current;
		if (
			route.kind === 'page' &&
			current?.kind === 'page' &&
			current.uri === route.uri &&
			this.page?.uri === route.uri
		) {
			// Same page: only the anchor changes, so scroll rather than reload.
			this.history.push(route);
			this.saveState();
			if (route.fragment) {
				this.scrollToFragment(route.fragment);
			}
			return;
		}
		this.history.push(route);
		this.show();
	}

	/** Renders whatever the current route is. */
	private show(): void {
		this.release();
		this.saveState();
		this.backButton.disabled = !this.history.canGoBack;
		this.forwardButton.disabled = !this.history.canGoForward;

		const route = this.history.current ?? { kind: 'home' };
		if (route.kind === 'home') {
			const home = findHomePage(this.tree);
			if (home) {
				this.requestPage(home.uri, undefined);
			} else {
				this.renderLanding();
			}
		} else if (route.kind === 'page') {
			this.requestPage(route.uri, route.fragment);
		} else {
			this.searchInput.value = route.query;
			this.page = undefined;
			this.renderNav();
			this.clearToc();
			this.main.replaceChildren(this.loadingNote(`Searching for “${route.query}”…`));
			this.setTitle(`Search: ${route.query}`);
			this.bridge.post({ type: 'search', query: route.query });
		}
	}

	private saveState(): void {
		this.bridge.setState({ history: this.history.toJSON(), expanded: [...this.expanded] });
	}

	private requestPage(uri: string, fragment: string | undefined): void {
		this.page = undefined;
		this.expandTo(uri);
		this.renderNav(uri);
		this.main.setAttribute('aria-busy', 'true');
		this.bridge.post(fragment ? { type: 'navigate', uri, fragment } : { type: 'navigate', uri });
	}

	/** The page the current route shows: its own URI, or the README the home route resolves to. */
	private shownPageUri(): string | undefined {
		const route = this.history.current;
		if (route?.kind === 'page') {
			return route.uri;
		}
		if (route?.kind === 'home') {
			return findHomePage(this.tree)?.uri;
		}
		return undefined;
	}

	private isShowingPage(uri: string): boolean {
		return this.shownPageUri() === uri;
	}

	private currentFragment(): string | undefined {
		const route = this.history.current;
		return route?.kind === 'page' ? route.fragment : undefined;
	}

	private setTitle(title: string): void {
		this.bridge.post({ type: 'title', title });
	}

	private expandTo(uri: string): void {
		for (const node of findAncestors(this.tree, uri).slice(0, -1)) {
			this.expanded.add(node.uri);
		}
	}

	private toggleFolder(uri: string): void {
		if (this.expanded.has(uri)) {
			this.expanded.delete(uri);
		} else {
			this.expanded.add(uri);
		}
		this.saveState();
		const button = this.nav.querySelector<HTMLButtonElement>(`button[data-folder="${CSS.escape(uri)}"]`);
		const open = this.expanded.has(uri);
		button?.setAttribute('aria-expanded', String(open));
		const group = button?.nextElementSibling as HTMLElement | null;
		if (group) {
			group.hidden = !open;
		}
	}

	private renderNav(activeUri: string | undefined = this.shownPageUri()): void {
		const scroll = this.nav.scrollTop;
		this.nav.replaceChildren();
		if (this.tree.length === 0) {
			this.nav.append(el('p', 'nav-empty', 'No documents found.'));
			return;
		}
		this.nav.append(this.renderNavList(this.tree, activeUri, 0));
		this.nav.scrollTop = scroll;
		this.nav.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
	}

	private renderNavList(nodes: SiteNode[], activeUri: string | undefined, depth: number): HTMLUListElement {
		const list = el('ul', depth === 0 ? 'nav-list' : 'nav-list nav-group');
		for (const node of nodes) {
			const item = el('li', 'nav-item');
			if (node.type === 'folder') {
				const open = this.expanded.has(node.uri);
				const button = el('button', 'nav-folder');
				button.type = 'button';
				button.dataset.folder = node.uri;
				button.dataset.testid = 'nav-folder';
				button.setAttribute('aria-expanded', String(open));
				const chevron = el('span', 'chevron');
				chevron.setAttribute('aria-hidden', 'true');
				button.append(el('span', 'nav-label', node.title), chevron);
				item.append(button);
				const children = this.renderNavList(node.children ?? [], activeUri, depth + 1);
				children.hidden = !open;
				item.append(children);
			} else {
				const link = el('a', 'nav-link');
				link.href = '#';
				link.dataset.uri = node.uri;
				link.dataset.testid = 'nav-link';
				link.dataset.vscodeContext = docContext(node.uri);
				link.title = node.description ?? node.path;
				link.append(el('span', 'nav-label', node.title));
				if (node.uri === activeUri) {
					link.setAttribute('aria-current', 'page');
				}
				item.append(link);
			}
			list.append(item);
		}
		return list;
	}

	private renderBreadcrumbs(uri: string): HTMLElement {
		const crumbs = el('nav', 'breadcrumbs');
		crumbs.setAttribute('aria-label', 'Breadcrumbs');
		crumbs.dataset.testid = 'breadcrumbs';
		const list = el('ol');
		const home = el('li');
		const homeLink = el('a', undefined, 'Home');
		homeLink.href = '#';
		homeLink.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.go({ kind: 'home' });
		});
		home.append(homeLink);
		list.append(home);

		const chain = findAncestors(this.tree, uri);
		chain.forEach((node, index) => {
			const item = el('li');
			if (index === chain.length - 1) {
				const current = el('span', undefined, node.title);
				current.setAttribute('aria-current', 'page');
				item.append(current);
			} else {
				item.append(el('span', undefined, node.title));
			}
			list.append(item);
		});
		crumbs.append(list);
		return crumbs;
	}

	/** Frees the shown page's resources before something replaces it. */
	private release(): void {
		this.releasePage?.();
		this.releasePage = undefined;
	}

	private renderPage(page: PageData, fragment: string | undefined): void {
		this.release();
		this.page = page;
		this.main.removeAttribute('aria-busy');
		this.setTitle(page.title);

		const article = el('article', `page page-${page.kind}`);
		article.dataset.testid = 'page';
		article.dataset.kind = page.kind;

		const header = el('header', 'page-header');
		header.append(this.renderBreadcrumbs(page.uri));

		const body = el('div', 'page-body');
		body.dataset.testid = 'page-body';
		let ownTitle: HTMLElement | null = null;

		switch (page.kind) {
			case 'markdown':
			case 'html': {
				body.append(renderDocument(page));
				// A document opening with its own H1 keeps it as the page title rather than showing two.
				const first = body.firstElementChild;
				if (first?.tagName === 'H1') {
					ownTitle = first as HTMLElement;
				}
				break;
			}
			case 'code': {
				const pre = el('pre', 'code-block code-file');
				const code = el('code', `hljs language-${page.language ?? 'plaintext'}`);
				code.innerHTML = highlightCode(page.content ?? '', page.language);
				pre.append(code);
				body.append(pre);
				break;
			}
			case 'image': {
				const figure = el('figure', 'image-page');
				const image = el('img');
				image.src = page.fileSrc ?? '';
				image.alt = page.title;
				figure.append(image);
				body.append(figure);
				break;
			}
			case 'pdf': {
				const pdf = el('div', 'pdf-document');
				pdf.dataset.testid = 'pdf-document';
				body.append(pdf);
				break;
			}
			case 'binary': {
				const note = el('div', 'binary-note');
				note.dataset.testid = 'binary-note';
				note.append(
					el('p', 'binary-title', 'This file can’t be shown here'),
					el(
						'p',
						undefined,
						'It is not a text, Markdown, HTML, image, or PDF file. Open it to view it in its own editor.',
					),
				);
				body.append(note);
				break;
			}
		}

		const title = ownTitle ?? el('h1', undefined, page.title);
		title.classList.add('page-title');
		title.dataset.testid = 'page-title';
		header.append(title);
		if (page.description) {
			header.append(el('p', 'page-lede', page.description));
		}
		header.append(this.renderSource(page));

		if (page.truncated) {
			body.prepend(el('p', 'page-notice', 'This file is larger than 1 MB, so only its beginning is shown.'));
		}

		article.append(header, body);
		this.main.replaceChildren(article);
		this.renderNav(page.uri);
		this.renderToc(body);

		if (fragment) {
			this.scrollToFragment(fragment);
		} else {
			this.main.scrollTop = 0;
		}

		void renderMermaid(body, this.options.mermaidSrc, this.options.nonce, this.isDark());

		// Drawn once the article is in the page, since pages are sized to the width it is given.
		const pdf = body.querySelector<HTMLElement>('.pdf-document');
		if (pdf) {
			this.releasePage = renderPdf(pdf, page.fileSrc, this.options.pdfSrc, this.options.nonce);
		}
	}

	private renderSource(page: PageData): HTMLElement {
		const source = el('div', 'page-source');
		const path = el('code', 'page-path', page.path);
		path.dataset.testid = 'page-path';
		const actions = el('div', 'page-actions');
		const preview = el('button', 'button', 'Open preview');
		preview.type = 'button';
		preview.dataset.testid = 'open-preview';
		preview.addEventListener('click', () =>
			this.bridge.post({ type: 'openOriginal', uri: page.uri, mode: 'preview' }),
		);
		const edit = el('button', 'button button-quiet', 'Edit source');
		edit.type = 'button';
		edit.dataset.testid = 'edit-source';
		edit.addEventListener('click', () => this.bridge.post({ type: 'openOriginal', uri: page.uri, mode: 'editor' }));
		actions.append(preview, edit);
		source.append(path, actions);
		return source;
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

	private clearToc(): void {
		this.tocObserver?.disconnect();
		this.tocObserver = undefined;
		this.toc.replaceChildren();
		this.toc.hidden = true;
	}

	private renderToc(body: HTMLElement): void {
		this.clearToc();
		const headings = [...body.querySelectorAll<HTMLElement>('h2[id], h3[id]')];
		if (headings.length < 2) {
			return;
		}

		const heading = el('h2', 'toc-heading', 'On this page');
		const list = el('ul', 'toc-list');
		const links = new Map<string, HTMLAnchorElement>();
		for (const target of headings) {
			const item = el('li', target.tagName === 'H3' ? 'toc-item toc-sub' : 'toc-item');
			const link = el('a', 'toc-link', target.textContent ?? '');
			link.href = `#${target.id}`;
			link.dataset.linkKind = 'anchor';
			item.append(link);
			list.append(item);
			links.set(target.id, link);
		}
		this.toc.append(heading, list);
		this.toc.hidden = false;

		if (typeof IntersectionObserver === 'undefined') {
			return;
		}
		// Each callback reports only the headings that changed, so visibility is tracked across calls and
		// the highlight goes to the first heading, in document order, inside the top of the page.
		const visible = new Set<string>();
		this.tocObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visible.add(entry.target.id);
					} else {
						visible.delete(entry.target.id);
					}
				}
				const active = headings.find((target) => visible.has(target.id));
				if (active) {
					links.forEach((link, id) => link.classList.toggle('active', id === active.id));
				}
			},
			{ root: this.main, rootMargin: '0px 0px -65% 0px' },
		);
		headings.forEach((target) => this.tocObserver?.observe(target));
	}

	private scrollToFragment(fragment: string): void {
		const target = document.getElementById(fragment) ?? document.getElementById(fragment.toLowerCase());
		if (target) {
			target.scrollIntoView({ block: 'start' });
			target.classList.add('target-flash');
			setTimeout(() => target.classList.remove('target-flash'), 1200);
		}
	}

	private renderLanding(): void {
		this.page = undefined;
		this.renderNav(undefined);
		this.clearToc();
		const name = this.site?.name ?? 'Workspace Wiki';
		this.setTitle(name);

		const landing = el('section', 'landing');
		landing.dataset.testid = 'landing';
		landing.append(el('h1', 'page-title', name));
		if (this.tree.length === 0) {
			landing.append(
				el(
					'p',
					'page-lede',
					'No documents match your Workspace Wiki settings yet. Add Markdown files, or widen “Supported Extensions” and “Include Globs” in settings.',
				),
			);
			this.main.replaceChildren(landing);
			return;
		}

		landing.append(
			el(
				'p',
				'page-lede',
				`${this.files.length} ${this.files.length === 1 ? 'page' : 'pages'} in this workspace.`,
			),
		);
		const list = el('ul', 'landing-list');
		for (const node of this.tree) {
			const item = el('li', 'landing-item');
			const target = node.type === 'file' ? node : flattenFiles(node.children ?? [])[0];
			const link = el('a', 'landing-link', node.title);
			link.href = '#';
			if (target) {
				link.dataset.uri = target.uri;
				link.dataset.vscodeContext = docContext(target.uri);
			}
			item.append(link);
			const count = node.type === 'folder' ? flattenFiles(node.children ?? []).length : 0;
			const detail =
				node.description ?? (node.type === 'folder' ? `${count} ${count === 1 ? 'page' : 'pages'}` : node.path);
			item.append(el('span', 'landing-detail', detail));
			list.append(item);
		}
		landing.append(list);
		this.main.replaceChildren(landing);
	}

	private renderResults(query: string, results: SearchResult[]): void {
		const section = el('section', 'results');
		section.dataset.testid = 'search-results';
		section.append(el('h1', 'page-title', `Results for “${query}”`));
		section.append(
			el(
				'p',
				'page-lede',
				results.length === 0
					? 'No pages match. Try fewer or different words.'
					: `${results.length} ${results.length === 1 ? 'page matches' : 'pages match'}.`,
			),
		);

		const list = el('ol', 'result-list');
		for (const result of results) {
			const item = el('li', 'result');
			item.dataset.testid = 'search-result';
			const link = el('a', 'result-title', result.title);
			link.href = '#';
			link.dataset.uri = result.uri;
			link.dataset.vscodeContext = docContext(result.uri);
			const path = el('p', 'result-path', result.path);
			const snippet = el('p', 'result-snippet');
			for (const run of splitByRanges(result.snippet, result.ranges)) {
				snippet.append(run.mark ? el('mark', undefined, run.text) : document.createTextNode(run.text));
			}
			item.append(link, path, snippet);
			list.append(item);
		}
		section.append(list);
		this.main.replaceChildren(section);
		this.main.scrollTop = 0;
	}

	private renderMessage(title: string, detail: string): void {
		this.main.removeAttribute('aria-busy');
		const section = el('section', 'notice');
		section.dataset.testid = 'page-error';
		section.append(el('h1', 'page-title', title), el('p', 'page-lede', detail));
		this.main.replaceChildren(section);
		this.clearToc();
	}

	private loadingNote(text: string): HTMLElement {
		const note = el('p', 'loading', text);
		note.setAttribute('role', 'status');
		return note;
	}
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
