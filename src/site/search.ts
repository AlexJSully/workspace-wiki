import type { TreeNode } from '@types';
import type * as vscode from 'vscode';
import { classifyFile, loadPageContent } from './pageContent';
import type { SearchResult } from './protocol';
import { type SearchDoc, searchDocs, toPlainText } from './searchDocs';

/** Files read at once while building the index, so a large wiki does not open hundreds of reads. */
const READ_CONCURRENCY = 8;

/**
 * Lists the file nodes of a tree, depth first.
 *
 * @param nodes The tree's roots
 * @returns Every file node
 */
export function flattenFiles(nodes: TreeNode[]): TreeNode[] {
	const files: TreeNode[] = [];
	const visit = (list: TreeNode[]) => {
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
 * The text of every wiki document, read on the first search and kept until invalidated.
 *
 * Reading waits for a search because most visits never search, and a large wiki is a lot of reads.
 */
export class SearchIndex {
	private files: TreeNode[] = [];
	private docs: Map<string, SearchDoc> | undefined;
	private loading: Promise<Map<string, SearchDoc>> | undefined;

	/** @param readFile Reads a file's bytes; `workspace.fs.readFile` in the extension */
	constructor(private readonly readFile: (uri: vscode.Uri) => Thenable<Uint8Array>) {}

	/**
	 * Replaces the documents to index and drops any text already read.
	 *
	 * @param files The wiki's file nodes
	 */
	setFiles(files: TreeNode[]): void {
		this.files = files;
		this.invalidate();
	}

	/** Drops the read text, so the next search reads every document again. */
	invalidate(): void {
		this.docs = undefined;
		this.loading = undefined;
	}

	/**
	 * Re-reads one document after it changed, if the index has been built and holds it.
	 *
	 * @param uri The changed document
	 */
	async update(uri: vscode.Uri): Promise<void> {
		const node = this.files.find((file) => file.uri.toString() === uri.toString());
		if (!node || !this.docs) {
			return;
		}
		const doc = await this.readDoc(node);
		this.docs?.set(doc.uri, doc);
	}

	/**
	 * Searches the indexed documents, reading them first if this is the first search.
	 *
	 * @param query The user's query
	 * @returns Ranked results
	 */
	async search(query: string): Promise<SearchResult[]> {
		const docs = await this.load();
		return searchDocs([...docs.values()], query);
	}

	private load(): Promise<Map<string, SearchDoc>> {
		if (this.docs) {
			return Promise.resolve(this.docs);
		}
		if (!this.loading) {
			const loading = this.readAll().then((docs) => {
				// A refresh during the read replaced `loading`; its result is stale and is not kept.
				if (this.loading === loading) {
					this.docs = docs;
				}
				return docs;
			});
			this.loading = loading;
		}
		return this.loading;
	}

	private async readAll(): Promise<Map<string, SearchDoc>> {
		const docs = new Map<string, SearchDoc>();
		const queue = [...this.files];
		const worker = async () => {
			for (let node = queue.shift(); node; node = queue.shift()) {
				const doc = await this.readDoc(node);
				docs.set(doc.uri, doc);
			}
		};
		await Promise.all(Array.from({ length: READ_CONCURRENCY }, worker));

		// Keep tree order, which the worker pool scrambled.
		const ordered = new Map<string, SearchDoc>();
		for (const node of this.files) {
			const doc = docs.get(node.uri.toString());
			if (doc) {
				ordered.set(doc.uri, doc);
			}
		}
		return ordered;
	}

	private async readDoc(node: TreeNode): Promise<SearchDoc> {
		const doc: SearchDoc = { uri: node.uri.toString(), title: node.title, path: node.path, text: '' };
		const kind = classifyFile(node.uri.path);
		if (kind === 'image' || kind === 'pdf' || kind === 'binary') {
			return doc;
		}

		try {
			// The whole file, not the first megabyte a page renders: a term near the end must still match.
			const page = await loadPageContent(node.uri, this.readFile, { maxBytes: Infinity });
			const raw = page.content ?? '';
			doc.text = page.kind === 'markdown' || page.kind === 'html' ? toPlainText(raw) : raw;
		} catch {
			// An unreadable file stays findable by title and path.
		}
		return doc;
	}
}
