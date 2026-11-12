import { el } from './dom';

/**
 * The "On this page" outline: the page's second- and third-level headings, with the one at the top
 * of the reading area highlighted as the page scrolls.
 */
export class Toc {
	private observer: IntersectionObserver | undefined;

	/**
	 * @param aside The `<aside>` element to fill
	 * @param scrollRoot The element the page scrolls in, which decides which heading is at the top
	 */
	constructor(
		private readonly aside: HTMLElement,
		private readonly scrollRoot: HTMLElement,
	) {}

	/** Empties and hides the outline, and stops watching the previous page's headings. */
	clear(): void {
		this.observer?.disconnect();
		this.observer = undefined;
		this.aside.replaceChildren();
		this.aside.hidden = true;
	}

	/**
	 * Builds the outline for a page; a page with fewer than two headings gets none.
	 *
	 * @param body The rendered page, whose headings already carry ids
	 */
	render(body: HTMLElement): void {
		this.clear();
		const headings = [...body.querySelectorAll<HTMLElement>('h2[id], h3[id]')];
		if (headings.length < 2) {
			return;
		}

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
		this.aside.append(el('h2', 'toc-heading', 'On this page'), list);
		this.aside.hidden = false;

		if (typeof IntersectionObserver === 'undefined') {
			return;
		}
		// Each callback reports only the headings that changed, so visibility is tracked across calls and
		// the highlight goes to the first heading, in document order, inside the top of the page.
		const visible = new Set<string>();
		let highlighted: HTMLAnchorElement | undefined;
		this.observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visible.add(entry.target.id);
					} else {
						visible.delete(entry.target.id);
					}
				}
				const active = headings.find((target) => visible.has(target.id));
				const link = active && links.get(active.id);
				if (link && link !== highlighted) {
					highlighted?.classList.remove('active');
					link.classList.add('active');
					highlighted = link;
				}
			},
			{ root: this.scrollRoot, rootMargin: '0px 0px -65% 0px' },
		);
		headings.forEach((target) => this.observer?.observe(target));
	}
}
