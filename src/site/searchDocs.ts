/**
 * Search ranking and snippets, free of the `vscode` module so the Cypress harness runs the same code
 * the extension does.
 */
import type { SearchResult } from './protocol';

/** A document as search sees it: identity, labels, and plain text. */
export interface SearchDoc {
	/** `uri.toString()` of the document. */
	uri: string;
	/** The display title, searched and weighted highest. */
	title: string;
	/** Path relative to the tree's common base, searched. */
	path: string;
	/** The body as plain text; empty for images, binaries, and unreadable files. */
	text: string;
	/** The title, path, and text lowercased once, so a search does not lowercase every document again. */
	lower?: { title: string; path: string; text: string };
}

/**
 * Lowercases the fields search compares against.
 *
 * @param doc The document
 * @returns Its title, path, and text in lower case
 */
export function lowerCaseOf(doc: SearchDoc): { title: string; path: string; text: string } {
	return { title: doc.title.toLowerCase(), path: doc.path.toLowerCase(), text: doc.text.toLowerCase() };
}

/** Results returned when the caller gives no limit. */
const DEFAULT_LIMIT = 50;
/** Characters of context kept before the first match in a snippet. */
const SNIPPET_LEAD = 60;
/** Characters a snippet runs to at most. */
const SNIPPET_LENGTH = 220;

/**
 * Reduces Markdown or HTML to the text a reader sees, so snippets read as prose rather than syntax.
 *
 * @param text Markdown or HTML source
 * @returns The text with tags, comments, link targets, heading marks, and emphasis marks removed
 */
export function toPlainText(text: string): string {
	return text
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/[*_`~]+/g, '')
		.replace(/&nbsp;/g, ' ');
}

/**
 * Counts the occurrences of a term in a text.
 *
 * @param haystack Lowercased text to search
 * @param term Lowercased term
 * @param cap Count at which to stop, since past it the score no longer changes
 * @returns The number of occurrences, at most `cap`
 */
function countOccurrences(haystack: string, term: string, cap: number): number {
	let count = 0;
	let index = haystack.indexOf(term);
	while (index !== -1 && count < cap) {
		count++;
		index = haystack.indexOf(term, index + term.length);
	}
	return count;
}

/**
 * Finds every non-overlapping occurrence of each term in a text.
 *
 * @param text The text to mark
 * @param terms Lowercased terms
 * @returns Sorted, merged `[start, end)` ranges
 */
export function findRanges(text: string, terms: string[]): [number, number][] {
	const lower = text.toLowerCase();
	const ranges: [number, number][] = [];

	for (const term of terms) {
		let index = lower.indexOf(term);
		while (index !== -1) {
			ranges.push([index, index + term.length]);
			index = lower.indexOf(term, index + term.length);
		}
	}

	ranges.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [];
	for (const range of ranges) {
		const last = merged[merged.length - 1];
		if (last && range[0] <= last[1]) {
			last[1] = Math.max(last[1], range[1]);
		} else {
			merged.push([range[0], range[1]]);
		}
	}
	return merged;
}

/**
 * Cuts a window of text around the first match, collapsed to single spaces and marked with `…`
 * where it was cut.
 *
 * @param text The document's plain text
 * @param terms Lowercased terms
 * @param lower The text lowercased, when the caller already has it
 * @returns The snippet, opening at the start of the text when no term occurs in it
 */
export function buildSnippet(text: string, terms: string[], lower: string = text.toLowerCase()): string {
	const first = terms.map((term) => lower.indexOf(term)).filter((index) => index !== -1);
	const anchor = first.length > 0 ? Math.min(...first) : 0;

	let start = Math.max(0, anchor - SNIPPET_LEAD);
	if (start > 0) {
		// Start on a word boundary rather than mid-word.
		const space = text.indexOf(' ', start);
		if (space !== -1 && space < anchor) {
			start = space + 1;
		}
	}
	const end = Math.min(text.length, start + SNIPPET_LENGTH);

	const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
	return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}

/**
 * Searches documents for a query.
 *
 * Every whitespace-separated term must occur, case-insensitively, in the title, the path, or the
 * text. Each term scores 20 for a title hit, 20 more when the title is exactly the term, 5 for a path
 * hit, and 1 per body occurrence up to 10. Ties sort by title.
 *
 * @param docs The documents to search
 * @param query The user's query
 * @param limit Results returned at most
 * @returns Ranked results with a snippet and the ranges to highlight in it; empty for a blank query
 */
export function searchDocs(docs: SearchDoc[], query: string, limit: number = DEFAULT_LIMIT): SearchResult[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) {
		return [];
	}

	const scored: { doc: SearchDoc; score: number }[] = [];
	for (const doc of docs) {
		const { title, path, text } = doc.lower ?? lowerCaseOf(doc);

		let score = 0;
		let matchedAll = true;
		for (const term of terms) {
			const inTitle = title.includes(term);
			const inPath = path.includes(term);
			const inText = countOccurrences(text, term, 10);
			if (!inTitle && !inPath && inText === 0) {
				matchedAll = false;
				break;
			}
			score += (inTitle ? 20 : 0) + (title === term ? 20 : 0) + (inPath ? 5 : 0) + inText;
		}

		if (matchedAll) {
			scored.push({ doc, score });
		}
	}

	scored.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));

	return scored.slice(0, limit).map(({ doc }) => {
		const snippet = buildSnippet(doc.text, terms, doc.lower?.text);
		return { uri: doc.uri, title: doc.title, path: doc.path, snippet, ranges: findRanges(snippet, terms) };
	});
}
