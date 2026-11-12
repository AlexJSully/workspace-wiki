import type { TreeNode } from '@types';
import type * as vscode from 'vscode';
import { loadPageContent } from './pageContent';
import type { SearchResult } from './protocol';
import { type SearchDoc, lowerCaseOf, searchDocs, toPlainText } from './searchDocs';

/** Files read at once while building the index, so a large wiki does not open hundreds of reads. */
const READ_CONCURRENCY = 8;

/**
 * The text of every wiki document, read on the first search and kept until the file list changes.
 *
 * Reading waits for a search because most visits never search, and a large wiki is a lot of reads.
 */
export class SearchIndex {
	private files: TreeNode[] = [];
	/** The index, built or being built; undefined until the first search after the files change. */
	private docs: Promise<Map<string, SearchDoc>> | undefined;

	/** @param readFile Reads a file's bytes; `workspace.fs.readFile` in the extension */
	constructor(private readonly readFile: (uri: vscode.Uri) => Thenable<Uint8Array>) {}

	/**
	 * Replaces the documents to index and drops any text already read.
	 *
	 * @param files The wiki's file nodes
	 */
	setFiles(files: TreeNode[]): void {
		this.files = files;
		this.docs = undefined;
	}

	/**
	 * Re-reads one document after it was saved. When the index is still being built, this waits for
	 * the build and then reads the document again, so the saved text is what the index keeps.
	 *
	 * @param node The saved document
	 */
	async update(node: TreeNode): Promise<void> {
		if (!this.docs) {
			return;
		}
		const docs = await this.docs;
		docs.set(node.uri.toString(), await this.readDoc(node));
	}

	/**
	 * Searches the indexed documents, reading them first if this is the first search.
	 *
	 * @param query The user's query
	 * @returns Ranked results
	 */
	async search(query: string): Promise<SearchResult[]> {
		this.docs ??= this.readAll(this.files);
		return searchDocs([...(await this.docs).values()], query);
	}

	private async readAll(files: TreeNode[]): Promise<Map<string, SearchDoc>> {
		const docs: SearchDoc[] = new Array(files.length);
		let next = 0;
		const worker = async () => {
			while (next < files.length) {
				const index = next++;
				docs[index] = await this.readDoc(files[index]);
			}
		};
		await Promise.all(Array.from({ length: READ_CONCURRENCY }, worker));
		// Filled by position, so the map keeps tree order however the reads interleaved.
		return new Map(docs.map((doc) => [doc.uri, doc]));
	}

	private async readDoc(node: TreeNode): Promise<SearchDoc> {
		const doc: SearchDoc = { uri: node.uri.toString(), title: node.title, path: node.path, text: '' };
		try {
			// The whole file, not the first megabyte a page renders: a term near the end must still match.
			const page = await loadPageContent(node.uri, this.readFile, { maxBytes: Infinity });
			const raw = page.content ?? '';
			doc.text = page.kind === 'markdown' || page.kind === 'html' ? toPlainText(raw) : raw;
		} catch {
			// An unreadable file stays findable by title and path.
		}
		return { ...doc, lower: lowerCaseOf(doc) };
	}
}
