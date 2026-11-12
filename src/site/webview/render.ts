import type { PageData } from '@site/protocol';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { classifyHref, contextJson, createSlugger, languageFor, rebaseResource, rebaseSrcset } from './helpers';

/**
 * Tags removed from rendered documents on top of DOMPurify's defaults. A `<style>` would restyle the
 * whole site, and forms and frames have nowhere to go inside a webview.
 */
const FORBIDDEN_TAGS = ['style', 'form', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'link'];

/**
 * Highlights code as HTML. highlight.js escapes the source, so the result is safe to sanitize and insert.
 *
 * @param code The source
 * @param hint A language name or file-extension hint
 * @returns Highlighted HTML, or the escaped source when the language is unknown
 */
export function highlightCode(code: string, hint: string | undefined): string {
	const language = languageFor(hint);
	if (language !== 'plaintext' && hljs.getLanguage(language)) {
		return hljs.highlight(code, { language, ignoreIllegals: true }).value;
	}
	return escapeHtml(code);
}

/**
 * Escapes text for insertion as HTML.
 *
 * @param text The text
 * @returns The text with `&`, `<`, `>`, `"`, and `'` escaped
 */
function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * The markdown-it constructor.
 *
 * Loaded through `require` because markdown-it 15's CommonJS declarations (`markdown-it.d.cts`)
 * import its ESM declarations without the `resolution-mode` attribute TypeScript requires under
 * `module: Node16`, so a plain `import` fails to type-check. The type is taken from the ESM
 * declarations directly, which are correct; esbuild bundles the `require` like any import.
 */
const MarkdownIt = require('markdown-it') as typeof import('markdown-it', {
	with: { 'resolution-mode': 'import' },
}).default;

/** The Markdown renderer: CommonMark plus GitHub-style tables, strikethrough, and autolinks. */
const markdown = new MarkdownIt({ html: true, linkify: true, typographer: false });

// A ```mermaid fence becomes a block Mermaid draws; every other fence is highlighted by its info string.
markdown.renderer.rules.fence = (tokens, index) => {
	const token = tokens[index];
	const language = token.info.trim().split(/\s+/)[0] ?? '';
	if (language.toLowerCase() === 'mermaid') {
		return `<pre class="mermaid">${escapeHtml(token.content)}</pre>\n`;
	}
	const className = language ? ` class="hljs language-${escapeHtml(language)}"` : ' class="hljs"';
	return `<pre class="code-block"><code${className}>${highlightCode(token.content, language)}</code></pre>\n`;
};

/**
 * Sanitizes HTML into a fragment: no script, no event handlers, no `javascript:` URLs, none of
 * {@link FORBIDDEN_TAGS}, and no `data-*` attributes. The site's own click handling and right-click
 * menus read `data-*` attributes it sets after sanitizing, so a document must not be able to supply them.
 *
 * @param html Untrusted HTML
 * @returns The safe fragment
 */
export function sanitize(html: string): DocumentFragment {
	return DOMPurify.sanitize(html, {
		RETURN_DOM_FRAGMENT: true,
		FORBID_TAGS: FORBIDDEN_TAGS,
		ALLOW_DATA_ATTR: false,
		ADD_ATTR: ['target'],
	}) as DocumentFragment;
}

/**
 * Renders a document's text to a sanitized fragment.
 *
 * @param page The page
 * @returns The fragment, already rebased, slugged, and link-tagged by {@link finishContent}
 */
export function renderDocument(page: PageData): DocumentFragment {
	const html = page.kind === 'markdown' ? markdown.render(page.content ?? '') : (page.content ?? '');
	const fragment = sanitize(html);
	finishContent(fragment, page);
	return fragment;
}

/**
 * Prepares rendered content for the site: relative images and their `srcset` candidates load from the workspace, headings gain
 * anchor ids, wide tables scroll on their own, and every link carries the context its right-click
 * menu needs.
 *
 * @param root The rendered content
 * @param page The page it came from
 */
export function finishContent(root: DocumentFragment | HTMLElement, page: PageData): void {
	for (const element of root.querySelectorAll<HTMLElement>('img[src], video[src], audio[src], source[src]')) {
		element.setAttribute(
			'src',
			rebaseResource(element.getAttribute('src') ?? '', page.resourceBase, page.rootBase),
		);
	}
	// A browser picks among `srcset` candidates on its own, so each must point at the workspace too.
	for (const element of root.querySelectorAll<HTMLElement>('img[srcset], source[srcset]')) {
		element.setAttribute(
			'srcset',
			rebaseSrcset(element.getAttribute('srcset') ?? '', page.resourceBase, page.rootBase),
		);
	}

	const slug = createSlugger();
	for (const heading of root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')) {
		heading.id = heading.id || slug(heading.textContent ?? '');
	}

	for (const table of root.querySelectorAll('table')) {
		const wrapper = document.createElement('div');
		wrapper.className = 'table-scroll';
		table.replaceWith(wrapper);
		wrapper.appendChild(table);
	}

	for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		decorateLink(link, page.uri);
	}
}

/**
 * Tags a link in a page with its kind and its right-click menu context.
 *
 * @param link The link
 * @param fromUri The page it is on
 */
function decorateLink(link: HTMLAnchorElement, fromUri: string): void {
	const href = link.getAttribute('href') ?? '';
	const kind = classifyHref(href);
	link.dataset.linkKind = kind;
	link.removeAttribute('target');

	if (kind === 'external') {
		link.rel = 'noopener noreferrer';
		link.title = link.title || href;
		link.dataset.vscodeContext = contextJson({ webviewSection: 'external', href });
	} else if (kind === 'internal') {
		link.dataset.vscodeContext = contextJson({ webviewSection: 'doc', href, fromUri });
	}
}
