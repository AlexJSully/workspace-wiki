/**
 * The Wiki Site's main-area views, built from data alone. Interactive elements carry data attributes
 * (`data-uri`, `data-open`, `data-home`) that the app's single click handler acts on.
 */
import type { PageData, SearchResult, SiteNode } from '@site/protocol';
import { el, pageCount, pageLink } from './dom';
import { flattenFiles, splitByRanges } from './helpers';
import { breadcrumbs } from './navTree';
import { highlightCode, renderDocument } from './render';

/**
 * Builds a page: breadcrumbs, title, description, source bar, and the body for its kind.
 *
 * @param page The page
 * @param tree The wiki tree, for the breadcrumbs
 * @returns The article, and its body, which holds the document's headings and diagrams
 */
export function pageView(page: PageData, tree: SiteNode[]): { article: HTMLElement; body: HTMLElement } {
	const article = el('article', `page page-${page.kind}`);
	article.dataset.testid = 'page';
	article.dataset.kind = page.kind;

	const body = el('div', 'page-body');
	body.dataset.testid = 'page-body';
	body.append(...pageBody(page));

	// A document opening with its own H1 keeps it as the page title rather than showing two.
	const first = body.firstElementChild;
	const title = first?.tagName === 'H1' ? (first as HTMLElement) : el('h1', undefined, page.title);
	title.classList.add('page-title');
	title.dataset.testid = 'page-title';

	const header = el('header', 'page-header');
	header.append(breadcrumbs(tree, page.uri), title);
	if (page.description) {
		header.append(el('p', 'page-lede', page.description));
	}
	header.append(sourceBar(page));

	if (page.truncated) {
		body.prepend(el('p', 'page-notice', 'This file is larger than 1 MB, so only its beginning is shown.'));
	}

	article.append(header, body);
	return { article, body };
}

/**
 * Builds the body of a page for its kind.
 *
 * @param page The page
 * @returns The body's contents
 */
function pageBody(page: PageData): Node[] {
	switch (page.kind) {
		case 'markdown':
		case 'html':
			return [renderDocument(page)];
		case 'code': {
			const pre = el('pre', 'code-block code-file');
			const code = el('code', `hljs language-${page.language ?? 'plaintext'}`);
			code.innerHTML = highlightCode(page.content ?? '', page.language);
			pre.append(code);
			return [pre];
		}
		case 'image': {
			const figure = el('figure', 'image-page');
			const image = el('img');
			image.src = page.fileSrc ?? '';
			image.alt = page.title;
			figure.append(image);
			return [figure];
		}
		case 'binary': {
			const note = el('div', 'binary-note');
			note.dataset.testid = 'binary-note';
			note.append(
				el('p', 'binary-title', 'This file can’t be shown here'),
				el(
					'p',
					undefined,
					'It is not a text, Markdown, HTML, or image file. Open it to view it in its own editor.',
				),
			);
			return [note];
		}
	}
}

/**
 * Builds the bar under a page's title: its path and the buttons that open the original file.
 *
 * @param page The page
 * @returns The bar
 */
function sourceBar(page: PageData): HTMLElement {
	const path = el('code', 'page-path', page.path);
	path.dataset.testid = 'page-path';

	const preview = el('button', 'button', 'Open preview');
	preview.type = 'button';
	preview.dataset.open = 'preview';
	preview.dataset.testid = 'open-preview';
	const edit = el('button', 'button button-quiet', 'Edit source');
	edit.type = 'button';
	edit.dataset.open = 'editor';
	edit.dataset.testid = 'edit-source';

	const actions = el('div', 'page-actions');
	actions.append(preview, edit);
	const bar = el('div', 'page-source');
	bar.append(path, actions);
	return bar;
}

/**
 * Builds the landing page shown when the wiki has no top-level README: the site name and one entry
 * per top-level section, each linking to its first page.
 *
 * @param name The site name
 * @param tree The wiki tree
 * @returns The landing page
 */
export function landingView(name: string, tree: SiteNode[]): HTMLElement {
	const landing = el('section', 'landing');
	landing.dataset.testid = 'landing';
	landing.append(el('h1', 'page-title', name));
	if (tree.length === 0) {
		landing.append(
			el(
				'p',
				'page-lede',
				'No documents match your Workspace Wiki settings yet. Add Markdown files, or widen “Supported Extensions” and “Include Globs” in settings.',
			),
		);
		return landing;
	}

	landing.append(el('p', 'page-lede', `${pageCount(flattenFiles(tree).length)} in this workspace.`));
	const list = el('ul', 'landing-list');
	for (const node of tree) {
		const files = node.type === 'folder' ? flattenFiles(node.children ?? []) : [node];
		const link = files[0]
			? pageLink('landing-link', files[0].uri, node.title)
			: el('a', 'landing-link', node.title);
		const detail = node.description ?? (node.type === 'folder' ? pageCount(files.length) : node.path);
		const item = el('li', 'landing-item');
		item.append(link, el('span', 'landing-detail', detail));
		list.append(item);
	}
	landing.append(list);
	return landing;
}

/**
 * Builds the search results page. Result text is set as text and highlighted with `<mark>`, so it
 * is never parsed as HTML.
 *
 * @param query The query
 * @param results The results
 * @returns The results page
 */
export function resultsView(query: string, results: SearchResult[]): HTMLElement {
	const section = el('section', 'results');
	section.dataset.testid = 'search-results';
	const summary =
		results.length === 0
			? 'No pages match. Try fewer or different words.'
			: `${results.length} ${results.length === 1 ? 'page matches' : 'pages match'}.`;
	section.append(el('h1', 'page-title', `Results for “${query}”`), el('p', 'page-lede', summary));

	const list = el('ol', 'result-list');
	for (const result of results) {
		const snippet = el('p', 'result-snippet');
		for (const run of splitByRanges(result.snippet, result.ranges)) {
			snippet.append(run.mark ? el('mark', undefined, run.text) : document.createTextNode(run.text));
		}
		const item = el('li', 'result');
		item.dataset.testid = 'search-result';
		item.append(pageLink('result-title', result.uri, result.title), el('p', 'result-path', result.path), snippet);
		list.append(item);
	}
	section.append(list);
	return section;
}

/**
 * Builds a notice that a page could not be shown.
 *
 * @param title The notice's title
 * @param detail What went wrong
 * @returns The notice
 */
export function messageView(title: string, detail: string): HTMLElement {
	const section = el('section', 'notice');
	section.dataset.testid = 'page-error';
	section.append(el('h1', 'page-title', title), el('p', 'page-lede', detail));
	return section;
}

/**
 * Builds a status line shown while something loads.
 *
 * @param text What is loading
 * @returns The status line
 */
export function loadingView(text: string): HTMLElement {
	const note = el('p', 'loading', text);
	note.setAttribute('role', 'status');
	return note;
}
