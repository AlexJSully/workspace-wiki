import type { PageKind } from '@site/protocol';
import { getFileExtension, getFileName, stripFrontMatter } from '@utils';
import type * as vscode from 'vscode';

/** Extensions rendered as Markdown. Quarto and R Markdown are Markdown with executable chunks. */
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx', 'qmd', 'rmd']);
/** Extensions rendered as sanitized HTML. */
const HTML_EXTENSIONS = new Set(['html', 'htm', 'xhtml']);
/** Extensions a webview can show in an `<img>`. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif']);
/**
 * Extensions known to be binary, so they are never read. Anything else is read and sniffed, which
 * catches the binaries this list does not name.
 */
const BINARY_EXTENSIONS = new Set([
	'doc',
	'docx',
	'xls',
	'xlsx',
	'ppt',
	'pptx',
	'odt',
	'ods',
	'odp',
	'epub',
	'zip',
	'gz',
	'tgz',
	'tar',
	'7z',
	'rar',
	'jar',
	'bam',
	'exe',
	'dll',
	'so',
	'dylib',
	'class',
	'pyc',
	'woff',
	'woff2',
	'ttf',
	'otf',
	'mp3',
	'mp4',
	'mov',
	'wav',
	'sqlite',
	'db',
]);

/** Bytes rendered at most. A larger file shows its first megabyte and says so. */
export const MAX_RENDER_BYTES = 1024 * 1024;
/** Bytes inspected for a NUL, the same window Git uses to decide a file is binary. */
const BINARY_SNIFF_BYTES = 8000;

/** What {@link loadPageContent} produced for a file. */
export interface PageContent {
	kind: PageKind;
	content?: string;
	language?: string;
	truncated?: boolean;
}

/**
 * Decides how a file is presented from its name alone.
 *
 * @param fileName The file name or path
 * @returns `markdown`, `html`, `image`, `pdf`, `binary`, or `code` for everything else, which is read and
 * shown as text. An extensionless `README` is Markdown, as the scanner treats it.
 */
export function classifyFile(fileName: string): PageKind {
	const extension = getFileExtension(fileName);

	if (!extension) {
		return getFileName(fileName).toLowerCase() === 'readme' ? 'markdown' : 'code';
	}
	if (MARKDOWN_EXTENSIONS.has(extension)) {
		return 'markdown';
	}
	if (HTML_EXTENSIONS.has(extension)) {
		return 'html';
	}
	if (IMAGE_EXTENSIONS.has(extension)) {
		return 'image';
	}
	if (extension === 'pdf') {
		return 'pdf';
	}
	if (BINARY_EXTENSIONS.has(extension)) {
		return 'binary';
	}
	return 'code';
}

/**
 * Reports whether bytes look binary: a NUL within the first {@link BINARY_SNIFF_BYTES}.
 *
 * @param bytes The file's bytes
 * @returns `true` when a NUL byte is present in the sniffed window
 */
export function looksBinary(bytes: Uint8Array): boolean {
	const limit = Math.min(bytes.length, BINARY_SNIFF_BYTES);
	for (let i = 0; i < limit; i++) {
		if (bytes[i] === 0) {
			return true;
		}
	}
	return false;
}

/**
 * Reads a document and prepares it for the webview.
 *
 * Images, PDFs, and known binaries are not read at all: the webview loads the first two itself. Everything else is read through the injected
 * `readFile`, which on VS Code for the Web is the virtual file system, and decoded as UTF-8.
 *
 * @param uri The document
 * @param readFile Reads a file's bytes; `workspace.fs.readFile` in the extension
 * @param options `maxBytes` caps the text decoded, {@link MAX_RENDER_BYTES} by default; search
 * passes `Infinity`, since a term past the render limit must still be found
 * @returns The page kind, and for text kinds the text (front matter removed from Markdown), the
 * language hint, and whether it was cut at `maxBytes`
 */
export async function loadPageContent(
	uri: vscode.Uri,
	readFile: (uri: vscode.Uri) => Thenable<Uint8Array>,
	options: { maxBytes?: number } = {},
): Promise<PageContent> {
	const maxBytes = options.maxBytes ?? MAX_RENDER_BYTES;
	const kind = classifyFile(uri.path);
	if (kind === 'image' || kind === 'pdf' || kind === 'binary') {
		return { kind };
	}

	const bytes = await readFile(uri);
	if (looksBinary(bytes)) {
		return { kind: 'binary' };
	}

	const truncated = bytes.length > maxBytes;
	// A cut can split a multi-byte character; the decoder turns the stray tail into U+FFFD.
	const text = new TextDecoder().decode(truncated ? bytes.subarray(0, maxBytes) : bytes);
	const content = kind === 'markdown' ? stripFrontMatter(text) : text;

	const result: PageContent = { kind, content };
	if (kind === 'code') {
		result.language = getFileExtension(uri.path) || getFileName(uri.path).toLowerCase();
	}
	if (truncated) {
		result.truncated = true;
	}
	return result;
}
