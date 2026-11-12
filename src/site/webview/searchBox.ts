import type { SiteNode, SiteRoute } from '@site/protocol';
import { el, pageLink } from './dom';
import { suggestPages } from './helpers';

/**
 * Id of the suggestion list, and prefix of each suggestion's id. Upper case, so no heading id
 * (always lower case, from `slugify`) can collide with them.
 */
const LIST_ID = 'WikiSuggestions';
const OPTION_ID = 'WikiSuggestion-';

/**
 * The header's search field: suggests pages by title and path while typing, and searches every
 * page on Enter.
 */
export class SearchBox {
	/** The element to place in the header. */
	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly list: HTMLUListElement;
	private files: SiteNode[] = [];
	private suggestions: SiteNode[] = [];
	private activeIndex = -1;

	/**
	 * @param onChoose Called with the route the user chose: a suggested page, or a search
	 */
	constructor(private readonly onChoose: (route: SiteRoute) => void) {
		this.element = el('div', 'search');
		this.element.setAttribute('role', 'search');

		this.input = el('input', 'search-input');
		this.input.type = 'search';
		this.input.placeholder = 'Search the docs';
		this.input.setAttribute('aria-label', 'Search the docs');
		this.input.setAttribute('role', 'combobox');
		this.input.setAttribute('aria-autocomplete', 'list');
		this.input.setAttribute('aria-expanded', 'false');
		this.input.setAttribute('aria-controls', LIST_ID);
		this.input.autocomplete = 'off';
		this.input.spellcheck = false;
		this.input.dataset.testid = 'search-input';

		const shortcut = el('kbd', 'search-shortcut', '/');
		shortcut.setAttribute('aria-hidden', 'true');

		this.list = el('ul', 'suggestions');
		this.list.id = LIST_ID;
		this.list.setAttribute('role', 'listbox');
		this.list.setAttribute('aria-label', 'Matching pages');
		this.list.dataset.testid = 'search-suggestions';
		this.list.hidden = true;

		this.element.append(this.input, shortcut, this.list);

		this.input.addEventListener('input', () => this.update());
		this.input.addEventListener('keydown', (event) => this.onKey(event));
		// Wait so a click on a suggestion lands before the list goes.
		this.input.addEventListener('blur', () => setTimeout(() => this.close(), 150));
		// A suggestion is a page link the app's own click handler follows; the list only has to close.
		this.list.addEventListener('click', () => this.close());
	}

	/**
	 * Replaces the pages suggestions are drawn from.
	 *
	 * @param files The wiki's files
	 */
	setFiles(files: SiteNode[]): void {
		this.files = files;
	}

	/**
	 * Shows a query in the field, as when the search results page is shown.
	 *
	 * @param query The query
	 */
	setQuery(query: string): void {
		this.input.value = query;
	}

	/** Moves focus to the field and selects its text. */
	focus(): void {
		this.input.focus();
		this.input.select();
	}

	private onKey(event: KeyboardEvent): void {
		const count = this.suggestions.length;
		if (event.key === 'ArrowDown' && count > 0) {
			event.preventDefault();
			this.setActive((this.activeIndex + 1) % count);
		} else if (event.key === 'ArrowUp' && count > 0) {
			event.preventDefault();
			this.setActive((this.activeIndex - 1 + count) % count);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const chosen = this.suggestions[this.activeIndex];
			const query = this.input.value.trim();
			this.close();
			if (chosen) {
				this.onChoose({ kind: 'page', uri: chosen.uri });
			} else if (query) {
				this.onChoose({ kind: 'search', query });
			}
		} else if (event.key === 'Escape') {
			if (this.list.hidden) {
				this.input.blur();
			}
			this.close();
		}
	}

	private update(): void {
		const query = this.input.value.trim();
		this.suggestions = suggestPages(this.files, query);
		this.activeIndex = -1;
		this.list.replaceChildren();

		this.suggestions.forEach((node, index) => {
			const item = el('li', 'suggestion');
			item.id = `${OPTION_ID}${index}`;
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', 'false');
			const link = pageLink('suggestion-link', node.uri);
			link.tabIndex = -1;
			link.append(el('span', 'suggestion-title', node.title), el('span', 'suggestion-path', node.path));
			item.append(link);
			this.list.append(item);
		});

		if (query) {
			const item = el('li', 'suggestion suggestion-all', `Search all pages for “${query}”`);
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', 'false');
			item.addEventListener('mousedown', (event) => {
				event.preventDefault();
				this.close();
				this.onChoose({ kind: 'search', query });
			});
			this.list.append(item);
		}

		const open = this.list.childElementCount > 0;
		this.list.hidden = !open;
		this.input.setAttribute('aria-expanded', String(open));
		this.input.removeAttribute('aria-activedescendant');
	}

	private setActive(index: number): void {
		this.activeIndex = index;
		this.list.querySelectorAll('[role="option"]').forEach((option, i) => {
			option.setAttribute('aria-selected', String(i === index));
		});
		this.input.setAttribute('aria-activedescendant', `${OPTION_ID}${index}`);
	}

	private close(): void {
		this.list.hidden = true;
		this.suggestions = [];
		this.activeIndex = -1;
		this.input.setAttribute('aria-expanded', 'false');
		this.input.removeAttribute('aria-activedescendant');
	}
}
