/**
 * Small element builders the Wiki Site's views share.
 */
import { contextJson } from './helpers';

/**
 * Creates an element with a class and text in one step.
 *
 * @param tag The tag name
 * @param className The class attribute, if any
 * @param text The text content, if any
 * @returns The element
 */
export function el<K extends keyof HTMLElementTagNameMap>(
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
 * Creates a link to a wiki page. The app's single click handler reads `data-uri` to move to the
 * page, and the right-click menu reads `data-vscode-context` to name it.
 *
 * @param className The class attribute
 * @param uri `uri.toString()` of the page
 * @param text The link text, if any
 * @returns The link
 */
export function pageLink(className: string, uri: string, text?: string): HTMLAnchorElement {
	const link = el('a', className, text);
	link.href = '#';
	link.dataset.uri = uri;
	link.dataset.vscodeContext = contextJson({ webviewSection: 'doc', uri });
	return link;
}

/**
 * Formats a count of pages.
 *
 * @param count How many
 * @returns `1 page` or `N pages`
 */
export function pageCount(count: number): string {
	return `${count} ${count === 1 ? 'page' : 'pages'}`;
}
