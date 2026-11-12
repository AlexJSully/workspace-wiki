/**
 * Logic of the Wiki Site webview that needs no DOM, kept apart so Jest can test it directly.
 */
import type { SiteNode, SiteRoute } from '@site/protocol';

/** What clicking a link in a page does. */
export type HrefKind = 'anchor' | 'external' | 'internal' | 'blocked';

/** Schemes opened in a browser or mail client. */
const EXTERNAL_SCHEME = /^(https?|mailto|tel|ftp):/i;
/** Schemes that never navigate anywhere useful from a page. */
const BLOCKED_SCHEME = /^(javascript|data|vbscript|blob|about|command):/i;

/**
 * Classifies a link's `href`.
 *
 * @param href The `href` as written
 * @returns `anchor` for `#…`, `external` for web and mail links, `blocked` for script-bearing and
 * VS Code command schemes, and `internal` for everything else, which the host resolves
 */
export function classifyHref(href: string | null | undefined): HrefKind {
	const value = (href ?? '').trim();
	if (!value) {
		return 'blocked';
	}
	if (value.startsWith('#')) {
		return 'anchor';
	}
	if (EXTERNAL_SCHEME.test(value)) {
		return 'external';
	}
	if (BLOCKED_SCHEME.test(value)) {
		return 'blocked';
	}
	return 'internal';
}

/**
 * Turns heading text into an anchor id the way GitHub does: lowercase, punctuation removed, spaces
 * to hyphens. Links written for GitHub (`#getting-started`) therefore land here too.
 *
 * @param text The heading text
 * @returns The slug, or `section` when nothing usable is left
 */
export function slugify(text: string): string {
	const slug = text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.replace(/\s/g, '-');
	return slug || 'section';
}

/**
 * Creates a slugger that de-duplicates ids within one page, suffixing repeats `-1`, `-2`, as GitHub
 * does. Every id handed out is remembered, generated ones included, so a heading whose own text
 * matches an earlier suffix (`Usage`, `Usage`, `Usage-1`) still gets an id no other heading has.
 *
 * @returns A function from heading text to a slug unique within the page
 */
export function createSlugger(): (text: string) => string {
	const used = new Set<string>();
	const nextSuffix = new Map<string, number>();
	return (text) => {
		const base = slugify(text);
		let id = base;
		let suffix = nextSuffix.get(base) ?? 1;
		while (used.has(id)) {
			id = `${base}-${suffix}`;
			suffix++;
		}
		nextSuffix.set(base, suffix);
		used.add(id);
		return id;
	};
}

/**
 * Resolves an image or media `src` written in a page to a URL the webview can load.
 *
 * @param src The `src` as written
 * @param base The webview URL of the page's folder
 * @param rootBase The webview URL of the page's workspace folder, for `/`-rooted paths
 * @returns The resolved URL; absolute URLs, `data:` URIs, and protocol-relative URLs are unchanged
 */
export function rebaseResource(src: string, base: string, rootBase: string): string {
	const value = src.trim();
	if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('#')) {
		return value;
	}
	try {
		if (value.startsWith('/')) {
			return new URL(value.slice(1), `${rootBase.replace(/\/$/, '')}/`).toString();
		}
		return new URL(value, `${base.replace(/\/$/, '')}/`).toString();
	} catch {
		return value;
	}
}

/**
 * Splits a `srcset` into its candidates the way the HTML specification's parsing algorithm does: a
 * URL runs to the next white space, and a candidate ends at a comma after its descriptor or at
 * commas closing its URL. A comma inside a URL, as in a `data:` URL, stays part of it.
 *
 * @param srcset The `srcset` as written
 * @returns Each candidate's URL and descriptor (empty when it has none)
 */
function parseSrcset(srcset: string): { url: string; descriptor: string }[] {
	const candidates: { url: string; descriptor: string }[] = [];
	const isSpace = (char: string) => /\s/.test(char);
	let i = 0;
	while (i < srcset.length) {
		while (i < srcset.length && (isSpace(srcset[i]) || srcset[i] === ',')) {
			i++;
		}
		if (i >= srcset.length) {
			break;
		}

		const urlStart = i;
		while (i < srcset.length && !isSpace(srcset[i])) {
			i++;
		}
		let url = srcset.slice(urlStart, i);
		let descriptor = '';
		if (url.endsWith(',')) {
			url = url.replace(/,+$/, '');
		} else {
			const descriptorStart = i;
			while (i < srcset.length && srcset[i] !== ',') {
				i++;
			}
			descriptor = srcset.slice(descriptorStart, i).trim();
		}
		candidates.push({ url, descriptor });
	}
	return candidates;
}

/**
 * Resolves every candidate of a `srcset` the way {@link rebaseResource} resolves a `src`, so the
 * browser loads a responsive image from the workspace whichever candidate it picks.
 *
 * @param srcset The `srcset` as written
 * @param base The webview URL of the page's folder
 * @param rootBase The webview URL of the page's workspace folder, for `/`-rooted paths
 * @returns The `srcset` with each URL resolved and its descriptor kept
 */
export function rebaseSrcset(srcset: string, base: string, rootBase: string): string {
	return parseSrcset(srcset)
		.map(({ url, descriptor }) => [rebaseResource(url, base, rootBase), descriptor].filter(Boolean).join(' '))
		.join(', ');
}

/**
 * Lists every file in a tree, depth first.
 *
 * @param nodes The tree's roots
 * @returns The file nodes
 */
export function flattenFiles(nodes: SiteNode[]): SiteNode[] {
	const files: SiteNode[] = [];
	const visit = (list: SiteNode[]) => {
		for (const node of list) {
			if (node.type === 'file') {
				files.push(node);
			}
			if (node.children) {
				visit(node.children);
			}
		}
	};
	visit(nodes);
	return files;
}

/**
 * Finds the chain of nodes from a root down to the node with a URI.
 *
 * @param nodes The tree's roots
 * @param uri The node's URI
 * @returns The ancestors and the node itself, outermost first; empty when the URI is not in the tree
 */
export function findAncestors(nodes: SiteNode[], uri: string): SiteNode[] {
	for (const node of nodes) {
		if (node.uri === uri) {
			return [node];
		}
		if (node.children) {
			const below = findAncestors(node.children, uri);
			if (below.length > 0) {
				return [node, ...below];
			}
		}
	}
	return [];
}

/**
 * Picks the page the home route shows: a README at the top level of the tree.
 *
 * @param nodes The tree's roots
 * @returns The README, or undefined when the top level has none
 */
export function findHomePage(nodes: SiteNode[]): SiteNode | undefined {
	return nodes.find((node) => node.type === 'file' && node.isReadme);
}

/**
 * Suggests pages for a partly typed query by title, then by path.
 *
 * @param files The wiki's files
 * @param query The text typed so far
 * @param limit Suggestions returned at most
 * @returns Pages whose title starts with the query, then whose title contains it, then whose path does
 */
export function suggestPages(files: SiteNode[], query: string, limit = 8): SiteNode[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return [];
	}

	const rank = (node: SiteNode) => {
		const title = node.title.toLowerCase();
		if (title.startsWith(needle)) {
			return 0;
		}
		if (title.includes(needle)) {
			return 1;
		}
		return node.path.toLowerCase().includes(needle) ? 2 : -1;
	};

	return files
		.map((node) => ({ node, rank: rank(node) }))
		.filter((entry) => entry.rank !== -1)
		.sort((a, b) => a.rank - b.rank || a.node.title.localeCompare(b.node.title))
		.slice(0, limit)
		.map((entry) => entry.node);
}

/**
 * Splits text into runs that are or are not highlighted.
 *
 * @param text The text
 * @param ranges Sorted, non-overlapping `[start, end)` ranges to highlight
 * @returns The runs in order, covering the whole text
 */
export function splitByRanges(text: string, ranges: [number, number][]): { text: string; mark: boolean }[] {
	const runs: { text: string; mark: boolean }[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		const from = Math.max(start, cursor);
		const to = Math.min(end, text.length);
		if (from >= to) {
			continue;
		}
		if (from > cursor) {
			runs.push({ text: text.slice(cursor, from), mark: false });
		}
		runs.push({ text: text.slice(from, to), mark: true });
		cursor = to;
	}
	if (cursor < text.length) {
		runs.push({ text: text.slice(cursor), mark: false });
	}
	return runs;
}

/** highlight.js language names for hints that are not already highlight.js names or aliases. */
const LANGUAGE_ALIASES: Record<string, string> = {
	cjs: 'javascript',
	mjs: 'javascript',
	jsonc: 'json',
	ipynb: 'json',
	txt: 'plaintext',
	text: 'plaintext',
	license: 'plaintext',
	cgi: 'python',
	gd: 'python',
	tf: 'ini',
	conf: 'ini',
	properties: 'properties',
	csproj: 'xml',
	svg: 'xml',
	sbml: 'xml',
	drawio: 'xml',
	dtd: 'xml',
	puml: 'plaintext',
	mmd: 'plaintext',
	gnumakefile: 'makefile',
};

/**
 * Maps a page's language hint to the name to ask highlight.js for.
 *
 * @param hint The file extension, or the bare file name for extensionless files
 * @returns The language name; the caller still checks highlight.js knows it
 */
export function languageFor(hint: string | undefined): string {
	const key = (hint ?? '').toLowerCase();
	return LANGUAGE_ALIASES[key] ?? (key || 'plaintext');
}

/**
 * Compares two routes.
 *
 * @param a A route
 * @param b Another route
 * @returns `true` when both show the same thing (fragments are ignored)
 */
export function sameRoute(a: SiteRoute | undefined, b: SiteRoute | undefined): boolean {
	if (!a || !b || a.kind !== b.kind) {
		return false;
	}
	if (a.kind === 'page' && b.kind === 'page') {
		return a.uri === b.uri;
	}
	if (a.kind === 'search' && b.kind === 'search') {
		return a.query === b.query;
	}
	return true;
}

/** Routes a tab's saved state keeps at most. */
const SAVED_ROUTES = 50;

/** Back and forward through the routes a tab has shown, like a browser's history. */
export class RouteHistory {
	private entries: SiteRoute[];
	private index: number;

	/**
	 * @param entries Routes to restore, oldest first
	 * @param index The position of the current route among them
	 */
	constructor(entries: SiteRoute[] = [], index = entries.length - 1) {
		this.entries = [...entries];
		this.index = Math.min(Math.max(index, -1), this.entries.length - 1);
	}

	/** The route showing, if any. */
	get current(): SiteRoute | undefined {
		return this.entries[this.index];
	}

	/** Whether there is a route to go back to. */
	get canGoBack(): boolean {
		return this.index > 0;
	}

	/** Whether there is a route to go forward to. */
	get canGoForward(): boolean {
		return this.index < this.entries.length - 1;
	}

	/**
	 * Moves to a new route, dropping anything ahead of the current one. Pushing the route already
	 * showing replaces it, so a page reached twice in a row is one step back, not two.
	 *
	 * @param route The new route
	 */
	push(route: SiteRoute): void {
		if (sameRoute(this.current, route)) {
			this.entries[this.index] = route;
			return;
		}
		this.entries = this.entries.slice(0, this.index + 1);
		this.entries.push(route);
		this.index = this.entries.length - 1;
	}

	/**
	 * Steps back.
	 *
	 * @returns The route now showing, or undefined when already at the start
	 */
	back(): SiteRoute | undefined {
		if (!this.canGoBack) {
			return undefined;
		}
		this.index--;
		return this.current;
	}

	/**
	 * Steps forward.
	 *
	 * @returns The route now showing, or undefined when already at the end
	 */
	forward(): SiteRoute | undefined {
		if (!this.canGoForward) {
			return undefined;
		}
		this.index++;
		return this.current;
	}

	/**
	 * Captures the history for `setState`, which survives the tab being hidden.
	 *
	 * At most {@link SAVED_ROUTES} routes are kept, always including the current one: normally the
	 * most recent ones, but after going back past them, the window starts at the current route.
	 *
	 * @returns The entries and the position of the current route among them
	 */
	toJSON(): { entries: SiteRoute[]; index: number } {
		const start = Math.max(0, Math.min(this.entries.length - SAVED_ROUTES, this.index));
		return { entries: this.entries.slice(start, start + SAVED_ROUTES), index: this.index - start };
	}

	/**
	 * Restores a history captured by {@link toJSON}, ignoring anything malformed.
	 *
	 * @param state The value read back from `getState`
	 * @returns The restored history, or an empty one
	 */
	static fromJSON(state: unknown): RouteHistory {
		const value = state as { entries?: unknown; index?: unknown } | undefined;
		if (!value || !Array.isArray(value.entries) || typeof value.index !== 'number') {
			return new RouteHistory();
		}
		const entries = value.entries.filter(isRoute);
		return new RouteHistory(entries, Math.min(value.index, entries.length - 1));
	}
}

/**
 * Checks a value is a well-formed route.
 *
 * @param value The value
 * @returns `true` for a home, page, or search route with the fields it needs
 */
function isRoute(value: unknown): value is SiteRoute {
	const route = value as Record<string, unknown> | undefined;
	if (!route || typeof route !== 'object') {
		return false;
	}
	switch (route.kind) {
		case 'home':
			return true;
		case 'page':
			return typeof route.uri === 'string';
		case 'search':
			return typeof route.query === 'string';
		default:
			return false;
	}
}
