/**
 * Checks what the Wiki Site webview sends the host, and converts what the host sends it.
 */
import type { TreeNode } from '@types';
import type { SiteContextData, SiteNode, ViewToHost } from './protocol';

/**
 * Reads the string fields of an untrusted object.
 *
 * @param raw The value received
 * @returns A reader returning a field when it is a string, or undefined when the value is not an object
 */
function stringFields(raw: unknown): ((key: string) => string | undefined) | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const record = raw as Record<string, unknown>;
	return (key) => {
		const value = record[key];
		return typeof value === 'string' ? value : undefined;
	};
}

/**
 * Checks a message from the webview against the protocol.
 *
 * The webview renders workspace content, which is sanitized but still not trusted, so every field
 * is type-checked before the host acts on it.
 *
 * @param raw The posted value
 * @returns The message, or undefined when it does not match any message shape
 */
export function parseViewMessage(raw: unknown): ViewToHost | undefined {
	const text = stringFields(raw);
	if (!text) {
		return undefined;
	}
	const message = raw as Record<string, unknown>;
	const uri = text('uri');

	switch (message.type) {
		case 'ready':
			return { type: 'ready' };
		case 'navigate': {
			const fragment = text('fragment');
			if (uri === undefined || (message.fragment !== undefined && fragment === undefined)) {
				return undefined;
			}
			return { type: 'navigate', uri, fragment };
		}
		case 'title': {
			const title = text('title');
			return title === undefined ? undefined : { type: 'title', title };
		}
		case 'openLink': {
			const href = text('href');
			const fromUri = text('fromUri');
			const newTab = message.newTab;
			if (href === undefined || fromUri === undefined || typeof newTab !== 'boolean') {
				return undefined;
			}
			return { type: 'openLink', href, fromUri, newTab };
		}
		case 'openExternal': {
			const url = text('url');
			const integrated = message.integrated;
			return url === undefined || typeof integrated !== 'boolean'
				? undefined
				: { type: 'openExternal', url, integrated };
		}
		case 'openOriginal': {
			const mode = message.mode;
			return uri === undefined || (mode !== 'preview' && mode !== 'editor')
				? undefined
				: { type: 'openOriginal', uri, mode };
		}
		case 'openInNewTab':
			return uri === undefined ? undefined : { type: 'openInNewTab', uri };
		case 'search': {
			const query = text('query');
			return query === undefined ? undefined : { type: 'search', query };
		}
		default:
			return undefined;
	}
}

/**
 * Checks the context VS Code hands a Wiki Site right-click command: the merged `data-vscode-context`
 * of the element clicked and its ancestors.
 *
 * @param raw The command's argument
 * @returns The string fields the site sets, or undefined when the argument is not an object
 */
export function parseSiteContext(raw: unknown): SiteContextData | undefined {
	const text = stringFields(raw);
	if (!text) {
		return undefined;
	}
	const section = text('webviewSection');
	return {
		webviewSection: section === 'doc' || section === 'external' ? section : undefined,
		uri: text('uri'),
		href: text('href'),
		fromUri: text('fromUri'),
	};
}

/**
 * Converts a tree node to its JSON form for the webview.
 *
 * @param node The node
 * @returns The node with its URI serialized and children converted
 */
export function toSiteNode(node: TreeNode): SiteNode {
	return {
		type: node.type,
		name: node.name,
		title: node.title,
		path: node.path,
		uri: node.uri.toString(),
		...(node.description && { description: node.description }),
		...(node.isIndex && { isIndex: true }),
		...(node.isReadme && { isReadme: true }),
		...(node.children && { children: node.children.map(toSiteNode) }),
	};
}
