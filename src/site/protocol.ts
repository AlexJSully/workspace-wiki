/**
 * Messages exchanged between the extension host and the Wiki Site webview, and the few constants
 * both sides apply to them.
 *
 * Free of runtime imports, so both the host bundle and the webview bundle import it without pulling
 * in the other side's code. Everything crossing the boundary is JSON: URIs travel as `uri.toString()`
 * strings.
 */

/** View type of the Wiki Site webview panel, also the `webviewId` its context menus match on. */
export const SITE_VIEW_TYPE = 'workspaceWiki.site';

/**
 * URI schemes a link opens outside VS Code, in the default browser or mail client. The webview
 * classifies links with it and the host refuses to open any other scheme externally.
 */
export const EXTERNAL_SCHEMES: readonly string[] = ['http', 'https', 'mailto', 'tel', 'ftp'];

/** Built-in look of the site. `vscode` follows the active colour theme; the others are fixed palettes. */
export type SiteTheme = 'vscode' | 'paper' | 'slate' | 'lagoon';

/** How a page's content is presented. */
export type PageKind = 'markdown' | 'html' | 'code' | 'image' | 'binary';

/** A wiki tree node in JSON form: `TreeNode` with its URI serialized. */
export interface SiteNode {
	/** Whether the node is a document or a folder. */
	type: 'file' | 'folder';
	/** The file or folder name on disk. */
	name: string;
	/** The display title, the same one the sidebar shows. */
	title: string;
	/** Path relative to the tree's common base. */
	path: string;
	/** `uri.toString()`, the node's identity. */
	uri: string;
	/** The front matter description, shown as the nav link's tooltip and on the landing page. */
	description?: string;
	/** Set when the file is an index file, which a folder link lands on when the folder has no README. */
	isIndex?: boolean;
	/** Set when the file is a README; a top-level README is the home page. */
	isReadme?: boolean;
	/** The folder's child nodes, in sidebar order; absent on files. */
	children?: SiteNode[];
}

/** Site-wide presentation settings. */
export interface SiteInfo {
	/** The workspace name shown in the header. */
	name: string;
	/** Webview-loadable URI of the workspace's logo, when one was found or configured. */
	logoSrc?: string;
	/** The built-in look to apply; `vscode` when the setting is unset or not a known theme. */
	theme: SiteTheme;
	/** Webview-loadable URIs of user stylesheets, applied after the theme. */
	customCss: string[];
}

/** Where the site is showing. */
export type SiteRoute =
	{ kind: 'home' } | { kind: 'page'; uri: string; fragment?: string } | { kind: 'search'; query: string };

/** One rendered document. */
export interface PageData {
	/** `uri.toString()` of the document, the page's identity. */
	uri: string;
	/** The display title, the same one the sidebar shows. */
	title: string;
	/** Path relative to the tree's common base, shown under the title. */
	path: string;
	/** How the webview presents the page. */
	kind: PageKind;
	/** Document text; absent for images and binaries. Front matter is already removed from Markdown. */
	content?: string;
	/** highlight.js language hint for code pages: the extension, or the bare file name (`makefile`). */
	language?: string;
	/** Webview URI of the document's folder, which relative image paths resolve against. */
	resourceBase: string;
	/** Webview URI of the document's workspace folder, which root-relative (`/…`) image paths resolve against. */
	rootBase: string;
	/** Webview URI of the file itself, for image pages, which the webview loads directly. */
	fileSrc?: string;
	/** Set when the file was larger than the render limit and only its start is shown. */
	truncated?: boolean;
	/** The front matter description, shown beneath the title. */
	description?: string;
}

/** One search hit. Plain text only: the webview builds the highlighting from `ranges`. */
export interface SearchResult {
	/** `uri.toString()` of the matching page. */
	uri: string;
	/** The page's display title. */
	title: string;
	/** The page's path relative to the tree's common base. */
	path: string;
	/** A plain-text excerpt around the first match, with `…` where it was cut. */
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
	/** `doc` for a wiki page or a link written in a page, `external` for a web or mail link; the `webview/context` menu entries in `package.json` match on it. */
	webviewSection?: 'doc' | 'external';
	/** `uri.toString()` of a wiki page, set on nav, suggestion, landing, and result links. */
	uri?: string;
	/** The link's `href` as written, set on links inside a page. */
	href?: string;
	/** `uri.toString()` of the page a link written inside a page sits on. */
	fromUri?: string;
	/** Set so the menu shows only the Wiki Site's commands, not the webview's default Cut, Copy, and Paste. */
	preventDefaultContextMenuItems?: boolean;
}
