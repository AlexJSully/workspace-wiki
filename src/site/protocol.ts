/**
 * Messages exchanged between the extension host and the Wiki Site webview.
 *
 * Type-only, so both the host bundle and the webview bundle import it without pulling in the other
 * side's runtime. Everything crossing the boundary is JSON: URIs travel as `uri.toString()` strings.
 */

/** View type of the Wiki Site webview panel, also the `webviewId` its context menus match on. */
export const SITE_VIEW_TYPE = 'workspaceWiki.site';

/** Built-in look of the site. `vscode` follows the active colour theme; the others are fixed palettes. */
export type SiteTheme = 'vscode' | 'paper' | 'slate' | 'lagoon';

/** How a page's content is presented. */
export type PageKind = 'markdown' | 'html' | 'code' | 'image' | 'pdf' | 'binary';

/** A wiki tree node in JSON form: `TreeNode` with its URI serialized. */
export interface SiteNode {
	type: 'file' | 'folder';
	/** The file or folder name on disk. */
	name: string;
	/** The display title, the same one the sidebar shows. */
	title: string;
	/** Path relative to the tree's common base. */
	path: string;
	/** `uri.toString()`, the node's identity. */
	uri: string;
	description?: string;
	isIndex?: boolean;
	isReadme?: boolean;
	children?: SiteNode[];
}

/** Site-wide presentation settings. */
export interface SiteInfo {
	/** The workspace name shown in the header. */
	name: string;
	/** Webview-loadable URI of the workspace's logo, when one was found or configured. */
	logoSrc?: string;
	theme: SiteTheme;
	/** Webview-loadable URIs of user stylesheets, applied after the theme. */
	customCss: string[];
}

/** Where the site is showing. */
export type SiteRoute =
	{ kind: 'home' } | { kind: 'page'; uri: string; fragment?: string } | { kind: 'search'; query: string };

/** One rendered document. */
export interface PageData {
	uri: string;
	title: string;
	path: string;
	kind: PageKind;
	/** Document text; absent for images, PDFs, and binaries. Front matter is already removed from Markdown. */
	content?: string;
	/** highlight.js language hint for code pages: the extension, or the bare file name (`makefile`). */
	language?: string;
	/** Webview URI of the document's folder, which relative image paths resolve against. */
	resourceBase: string;
	/** Webview URI of the document's workspace folder, which root-relative (`/…`) image paths resolve against. */
	rootBase: string;
	/** Webview URI of the file itself, for image and PDF pages, which the webview loads directly. */
	fileSrc?: string;
	/** Set when the file was larger than the render limit and only its start is shown. */
	truncated?: boolean;
	description?: string;
}

/** One search hit. Plain text only: the webview builds the highlighting from `ranges`. */
export interface SearchResult {
	uri: string;
	title: string;
	path: string;
	snippet: string;
	/** `[start, end)` offsets into `snippet` of each matched term. */
	ranges: [number, number][];
}

/** Messages the host sends to the webview. */
export type HostToView =
	| { type: 'init'; site: SiteInfo; tree: SiteNode[]; route?: SiteRoute }
	| { type: 'page'; page: PageData; fragment?: string }
	| { type: 'pageError'; uri: string; message: string }
	| { type: 'goto'; uri: string; fragment?: string }
	| { type: 'searchResults'; query: string; results: SearchResult[] };

/** Messages the webview sends to the host. */
export type ViewToHost =
	| { type: 'ready' }
	| { type: 'navigate'; uri: string; fragment?: string }
	| { type: 'title'; title: string }
	| { type: 'openLink'; href: string; fromUri: string; newTab: boolean }
	| { type: 'openExternal'; url: string; integrated: boolean }
	| { type: 'openOriginal'; uri: string; mode: 'preview' | 'editor' }
	| { type: 'openInNewTab'; uri: string }
	| { type: 'search'; query: string };

/**
 * Data a webview element carries in `data-vscode-context`, which VS Code hands to the
 * `webview/context` menu commands. A document link written in a page carries its raw `href` and the
 * page it sits on rather than a resolved URI, so the host resolves it exactly as a click would.
 */
export interface SiteContextData {
	webviewSection?: 'doc' | 'external';
	uri?: string;
	href?: string;
	fromUri?: string;
}
