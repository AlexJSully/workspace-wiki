import type { SiteNode } from '@site/protocol';
import { el, pageLink } from './dom';
import { findAncestors } from './helpers';

/**
 * The left navigation: the wiki tree, mirroring the sidebar's order and titles.
 *
 * The tree's elements are built once per site load; moving between pages only moves the current-page
 * marker and opens the folders above it, so a large wiki is not rebuilt on every click.
 */
export class NavTree {
	private tree: SiteNode[] = [];
	private readonly links = new Map<string, HTMLAnchorElement>();
	private readonly folders = new Map<string, { button: HTMLButtonElement; group: HTMLElement }>();
	private active: HTMLAnchorElement | undefined;

	/**
	 * @param nav The `<nav>` element to fill
	 * @param expanded URIs of the open folders, shared with the app so it survives the tab being hidden
	 * @param onExpandedChange Called after a folder opens or closes, so the app can save its state
	 */
	constructor(
		private readonly nav: HTMLElement,
		readonly expanded: Set<string>,
		private readonly onExpandedChange: () => void,
	) {}

	/**
	 * Builds the tree's elements, replacing any built before.
	 *
	 * @param tree The wiki tree
	 */
	render(tree: SiteNode[]): void {
		this.tree = tree;
		this.links.clear();
		this.folders.clear();
		this.active = undefined;
		this.nav.replaceChildren(
			tree.length === 0 ? el('p', 'nav-empty', 'No documents found.') : this.renderList(tree, 0),
		);
	}

	/**
	 * Marks the page being shown, opening every folder above it.
	 *
	 * @param uri The page, or undefined when no page is shown (the landing page and search results)
	 */
	setActive(uri: string | undefined): void {
		this.active?.removeAttribute('aria-current');
		this.active = uri ? this.links.get(uri) : undefined;
		if (!uri || !this.active) {
			return;
		}

		let opened = false;
		for (const node of findAncestors(this.tree, uri).slice(0, -1)) {
			if (!this.expanded.has(node.uri)) {
				this.expanded.add(node.uri);
				opened = true;
			}
			this.showFolder(node.uri, true);
		}
		if (opened) {
			this.onExpandedChange();
		}

		this.active.setAttribute('aria-current', 'page');
		this.active.scrollIntoView({ block: 'nearest' });
	}

	/**
	 * Opens a closed folder or closes an open one.
	 *
	 * @param uri The folder
	 */
	toggle(uri: string): void {
		const open = !this.expanded.has(uri);
		if (open) {
			this.expanded.add(uri);
		} else {
			this.expanded.delete(uri);
		}
		this.showFolder(uri, open);
		this.onExpandedChange();
	}

	private showFolder(uri: string, open: boolean): void {
		const folder = this.folders.get(uri);
		if (folder) {
			folder.button.setAttribute('aria-expanded', String(open));
			folder.group.hidden = !open;
		}
	}

	private renderList(nodes: SiteNode[], depth: number): HTMLUListElement {
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

				const group = this.renderList(node.children ?? [], depth + 1);
				group.hidden = !open;
				this.folders.set(node.uri, { button, group });
				item.append(button, group);
			} else {
				const link = pageLink('nav-link', node.uri);
				link.dataset.testid = 'nav-link';
				link.title = node.description ?? node.path;
				link.append(el('span', 'nav-label', node.title));
				this.links.set(node.uri, link);
				item.append(link);
			}
			list.append(item);
		}
		return list;
	}
}

/**
 * Builds the breadcrumb trail for a page: Home, then each folder above it, then the page.
 *
 * @param tree The wiki tree
 * @param uri The page
 * @returns The `<nav>` holding the trail; its Home link carries `data-home` for the app's click handler
 */
export function breadcrumbs(tree: SiteNode[], uri: string): HTMLElement {
	const crumbs = el('nav', 'breadcrumbs');
	crumbs.setAttribute('aria-label', 'Breadcrumbs');
	crumbs.dataset.testid = 'breadcrumbs';
	const list = el('ol');

	const home = el('a', undefined, 'Home');
	home.href = '#';
	home.dataset.home = '';
	const homeItem = el('li');
	homeItem.append(home);
	list.append(homeItem);

	const chain = findAncestors(tree, uri);
	chain.forEach((node, index) => {
		const label = el('span', undefined, node.title);
		if (index === chain.length - 1) {
			label.setAttribute('aria-current', 'page');
		}
		const item = el('li');
		item.append(label);
		list.append(item);
	});

	crumbs.append(list);
	return crumbs;
}
