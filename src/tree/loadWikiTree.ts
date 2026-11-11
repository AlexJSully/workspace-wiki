import { scanWorkspaceDocs } from '@scanner';
import type { TreeNode, WorkspaceLike } from '@types';
import { buildTree } from './buildTree';

/**
 * Scans the workspace and builds the wiki tree using the `directorySort` and `acronymCasing` settings.
 *
 * The one route from settings to tree, so the sidebar and the wiki site cannot disagree on which
 * documents appear, their order, or their titles.
 *
 * @param workspace The workspace API used to discover and read documents
 * @returns Promise resolving to the root-level tree nodes
 */
export async function loadWikiTree(workspace: WorkspaceLike): Promise<TreeNode[]> {
	const uris = await scanWorkspaceDocs(workspace);

	let directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first';
	let acronyms: string[] = [];
	if (workspace.getConfiguration) {
		const config = workspace.getConfiguration('workspaceWiki');
		directorySort = config.get('directorySort') || 'files-first';
		acronyms = config.get('acronymCasing') || [];
	}

	return buildTree(uris, directorySort, acronyms);
}
