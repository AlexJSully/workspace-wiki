import { EXTERNAL_SCHEMES } from '@site/protocol';
import { decodeSafely } from '@site/webview/helpers';
import type { TreeNode } from '@types';
import * as vscode from 'vscode';

/** Where a link in a page leads. */
export type LinkTarget =
	| { kind: 'external'; url: string }
	| { kind: 'anchor'; fragment: string }
	| { kind: 'doc'; node: TreeNode; fragment?: string }
	| { kind: 'file'; uri: vscode.Uri };

/** Schemes opened outside the editor. Any other scheme is a workspace URI. */
const EXTERNAL = new Set(EXTERNAL_SCHEMES);

/**
 * Finds the workspace folder holding a URI: the deepest one whose URI prefixes it.
 *
 * @param uri The URI to place
 * @param folders The workspace roots
 * @returns The folder's URI, or undefined when the URI is outside every root
 */
export function containingFolder(uri: vscode.Uri, folders: readonly { uri: vscode.Uri }[]): vscode.Uri | undefined {
	const target = uri.toString();
	let best: vscode.Uri | undefined;
	for (const { uri: folder } of folders) {
		const root = folder.toString().replace(/\/$/, '');
		if ((target === root || target.startsWith(`${root}/`)) && (!best || root.length > best.toString().length)) {
			best = folder;
		}
	}
	return best;
}

/**
 * Resolves a link written in a wiki page.
 *
 * Relative paths resolve against the page's folder and a leading `/` against its workspace folder,
 * as GitHub does for repository links. A link to a folder lands on its README or index page. Only
 * `uri.path` is rewritten, so the scheme and authority of a virtual workspace survive.
 *
 * @param href The `href` as written
 * @param from The page the link is on
 * @param docs The wiki's files keyed by `uri.toString()`
 * @param folders The workspace roots
 * @returns Where the link leads: an external URL, an anchor on the same page, a wiki page, or a
 * workspace file outside the wiki (which may not exist)
 */
export function resolveDocLink(
	href: string,
	from: vscode.Uri,
	docs: ReadonlyMap<string, TreeNode>,
	folders: readonly { uri: vscode.Uri }[] = [],
): LinkTarget {
	const trimmed = href.trim();
	if (trimmed.startsWith('#')) {
		return { kind: 'anchor', fragment: decodeSafely(trimmed.slice(1)) };
	}

	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)?.[1]?.toLowerCase();
	if (scheme && EXTERNAL.has(scheme)) {
		return { kind: 'external', url: trimmed };
	}

	let target: vscode.Uri;
	let fragment: string | undefined;
	if (scheme) {
		const parsed = vscode.Uri.parse(trimmed);
		fragment = parsed.fragment || undefined;
		// Rejoined from the root so `.` and `..` segments resolve before anything compares the path.
		target = vscode.Uri.joinPath(parsed.with({ path: '/', query: '', fragment: '' }), parsed.path);
	} else {
		const hashIndex = trimmed.indexOf('#');
		const beforeHash = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
		fragment = hashIndex === -1 ? undefined : decodeSafely(trimmed.slice(hashIndex + 1)) || undefined;
		const pathPart = decodeSafely(beforeHash.split('?')[0]);

		const page = from.with({ query: '', fragment: '' });
		const base = pathPart.startsWith('/')
			? (containingFolder(from, folders) ?? page.with({ path: '/' }))
			: vscode.Uri.joinPath(page, '..');
		target = vscode.Uri.joinPath(base, pathPart);
	}

	const exact = docs.get(target.toString());
	if (exact) {
		return { kind: 'doc', node: exact, fragment };
	}

	const landing = findFolderLanding(target, docs);
	if (landing) {
		return { kind: 'doc', node: landing, fragment };
	}

	return { kind: 'file', uri: target };
}

/**
 * Finds the page a folder link should land on: its README, else its index file.
 *
 * @param folder The linked folder
 * @param docs The wiki's files keyed by `uri.toString()`
 * @returns The landing page, or undefined when the folder has neither
 */
function findFolderLanding(folder: vscode.Uri, docs: ReadonlyMap<string, TreeNode>): TreeNode | undefined {
	const prefix = `${folder.toString().replace(/\/$/, '')}/`;
	let index: TreeNode | undefined;
	for (const [key, node] of docs) {
		if (!key.startsWith(prefix) || key.slice(prefix.length).includes('/')) {
			continue;
		}
		if (node.isReadme) {
			return node;
		}
		if (node.isIndex && !index) {
			index = node;
		}
	}
	return index;
}
