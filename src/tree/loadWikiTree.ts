import { scanWorkspaceDocs } from '@scanner';
import { flattenFiles } from '@site/webview/helpers';
import type { TreeNode, WorkspaceLike } from '@types';
import * as vscode from 'vscode';
import { buildTree } from './buildTree';

/**
 * Context key naming every file in the wiki, as an object keyed by `uri.toString()`. The Explorer and
 * editor-tab menus in `package.json` test `resource in workspaceWiki.indexedFiles` to offer
 * **Open in Wiki Site** only for those files.
 */
export const INDEXED_FILES_CONTEXT = 'workspaceWiki.indexedFiles';

// The sidebar and the site each call `loadWikiTree`, so two loads can overlap; only the most
// recently started one publishes, so a slower, older scan cannot overwrite a newer file list.
let latestLoad = 0;

/**
 * Scans the workspace and builds the wiki tree using the `directorySort` and `acronymCasing` settings,
 * then publishes its files as the {@link INDEXED_FILES_CONTEXT} context key when no newer call has
 * started.
 *
 * The one route from settings to tree, so the sidebar and the wiki site cannot disagree on which
 * documents appear, their order, or their titles.
 *
 * @param workspace The workspace API used to discover and read documents
 * @returns Promise resolving to the root-level tree nodes
 */
export async function loadWikiTree(workspace: WorkspaceLike): Promise<TreeNode[]> {
	const load = ++latestLoad;
	const uris = await scanWorkspaceDocs(workspace);

	let directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first';
	let acronyms: string[] = [];
	if (workspace.getConfiguration) {
		const config = workspace.getConfiguration('workspaceWiki');
		directorySort = config.get('directorySort') || 'files-first';
		acronyms = config.get('acronymCasing') || [];
	}

	const tree = await buildTree(uris, directorySort, acronyms);

	if (load === latestLoad) {
		const indexedFiles = Object.fromEntries(flattenFiles(tree).map((node) => [node.uri.toString(), true]));
		void vscode.commands.executeCommand('setContext', INDEXED_FILES_CONTEXT, indexedFiles);
	}

	return tree;
}
