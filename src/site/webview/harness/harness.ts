/**
 * Runs the Wiki Site webview on a page of its own, with a fake extension host, for Cypress.
 *
 * URL parameters choose what the fake host serves:
 * - `fixture`: `default`, `noReadme`, or `empty`
 * - `theme`: a site theme (`vscode`, `paper`, `slate`, `lagoon`)
 * - `vscode`: the VS Code theme kind the page pretends to have (`light`, `dark`, `hc`)
 * - `customCss=1`: load the fixture user stylesheet
 * - `logo=0`: send no logo
 * - `page`: a workspace-relative path to open on, as "Open in Wiki Site" does
 */
import type { HostToView, SearchResult, SiteRoute, SiteTheme, ViewToHost } from '@site/protocol';
import { searchDocs } from '@site/searchDocs';
import { startApp } from '../app';
import type { HostBridge } from '../bridge';
import { TREES, pages } from './fixtures';

/** What specs reach through `window.__harness`. */
interface Harness {
	/** Delivers a message as the host would. */
	deliver(message: HostToView): void;
	/** Every message the webview has posted, oldest first. */
	getPosted(): ViewToHost[];
	/** Forgets the posted messages. */
	clearPosted(): void;
	/** The state the webview last saved. */
	getState(): unknown;
}

declare global {
	// eslint-disable-next-line no-unused-vars
	interface Window {
		__harness: Harness;
		__xss?: number;
	}
}

const params = new URLSearchParams(location.search);
const vscodeKind = params.get('vscode') ?? 'light';
document.body.classList.add(
	vscodeKind === 'dark' ? 'vscode-dark' : vscodeKind === 'hc' ? 'vscode-high-contrast' : 'vscode-light',
);

const tree = (TREES[params.get('fixture') ?? 'default'] ?? TREES.default)();
const pageData = pages(location.origin);
const ROOT = 'file:///workspace-root';

const posted: ViewToHost[] = [];
const listeners = new Set<(message: HostToView) => void>();
let state: unknown;

/** Hands a message to the webview asynchronously, as `postMessage` does. */
function deliver(message: HostToView): void {
	queueMicrotask(() => listeners.forEach((listener) => listener(message)));
}

/** Resolves a relative link the way the extension does, for the fixture's flat set of pages. */
function resolve(href: string, fromUri: string): { uri: string; fragment?: string } | undefined {
	const [pathPart, fragment] = href.split('#');
	const fromDir = fromUri.slice(ROOT.length, fromUri.lastIndexOf('/'));
	const segments: string[] = [];
	for (const segment of `${fromDir}/${pathPart}`.split('/')) {
		if (segment === '..') {
			segments.pop();
		} else if (segment && segment !== '.') {
			segments.push(segment);
		}
	}
	const uri = `${ROOT}/${segments.join('/')}`;
	if (pageData.has(uri)) {
		return { uri, fragment };
	}
	const landing = [...pageData.keys()].find((key) => key === `${uri}/README.md` || key === `${uri}/index.md`);
	return landing ? { uri: landing, fragment } : undefined;
}

/** Answers a search with the extension's own ranking over the fixture pages. */
function search(query: string): SearchResult[] {
	const docs = [...pageData.values()].map((page) => ({
		uri: page.uri,
		title: page.title,
		path: page.path,
		text: page.content ?? '',
	}));
	return searchDocs(docs, query);
}

/** Plays the extension host's part for one webview message. */
function handle(message: ViewToHost): void {
	switch (message.type) {
		case 'ready': {
			const theme = (params.get('theme') ?? 'vscode') as SiteTheme;
			const startPage = params.get('page');
			const route: SiteRoute | undefined = startPage ? { kind: 'page', uri: `${ROOT}/${startPage}` } : undefined;
			deliver({
				type: 'init',
				site: {
					name: 'Atlas',
					theme,
					customCss: params.get('customCss') === '1' ? [`${location.origin}/fixtures/custom.css`] : [],
					...(params.get('logo') !== '0' && { logoSrc: `${location.origin}/fixtures/logo.svg` }),
				},
				tree,
				route,
			});
			return;
		}
		case 'navigate': {
			const page = pageData.get(message.uri);
			deliver(
				page
					? { type: 'page', page, fragment: message.fragment }
					: { type: 'pageError', uri: message.uri, message: 'This page is not part of the wiki.' },
			);
			return;
		}
		case 'openLink': {
			const target = message.newTab ? undefined : resolve(message.href, message.fromUri);
			if (target) {
				deliver({ type: 'goto', ...target });
			}
			return;
		}
		case 'search':
			deliver({ type: 'searchResults', query: message.query, results: search(message.query) });
			return;
		default:
			return;
	}
}

const bridge: HostBridge = {
	post(message) {
		posted.push(message);
		handle(message);
	},
	subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	getState: () => state,
	setState(next) {
		state = next;
	},
};

window.__harness = {
	deliver,
	getPosted: () => [...posted],
	clearPosted: () => {
		posted.length = 0;
	},
	getState: () => state,
};

const root = document.getElementById('app');
if (root) {
	startApp(root, bridge, { mermaidSrc: root.dataset.mermaidSrc, pdfSrc: root.dataset.pdfSrc });
}
