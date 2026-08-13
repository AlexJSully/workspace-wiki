import type { TreeNode } from '@types';
import { extractFrontMatter, isIndexFile, isReadmeFile, normalizeTitle } from '@utils';
import * as vscode from 'vscode';

/**
 * Sorts tree nodes in place based on the directory sort setting (README nodes always rank first).
 *
 * @param nodes The sibling nodes to sort
 * @param directorySort `'files-first'`, `'folders-first'`, or `'alphabetical'`; defaults to `'files-first'`
 */
export function sortNodes(
	nodes: TreeNode[],
	directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first',
): void {
	nodes.sort((a, b) => {
		// README always first
		if (a.isReadme) {
			return -1;
		}
		if (b.isReadme) {
			return 1;
		}

		// Apply directory sorting logic
		if (directorySort === 'alphabetical') {
			return a.title.localeCompare(b.title);
		} else if (directorySort === 'files-first') {
			if (a.type !== b.type) {
				return a.type === 'file' ? -1 : 1;
			}
		} else if (directorySort === 'folders-first') {
			if (a.type !== b.type) {
				return a.type === 'folder' ? -1 : 1;
			}
		}

		// Finally alphabetical within same type
		return a.title.localeCompare(b.title);
	});
}

/**
 * Recursively sorts a folder node's children (the folder keeps its own name; any `index.*` file stays a child).
 *
 * @param node The node to process
 * @param directorySort The sort mode to apply to descendants; defaults to `'files-first'`
 */
export function processNode(
	node: TreeNode,
	directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first',
): void {
	if (node.type === 'folder' && node.children) {
		// Sort children based on directory sort setting
		sortNodes(node.children, directorySort);

		// Recursively process children
		node.children.forEach((child) => processNode(child, directorySort));
	}
}

/**
 * Builds the hierarchical tree from a flat list of file URIs, reading YAML front matter for titles
 * and applying ordering. Folders are named after their own path segment; any `index.*` file is a child file.
 *
 * Path structure comes from `uri.path`, which is always forward-slash separated and carries no
 * scheme assumptions, so the tree is identical on local, remote, and virtual file systems.
 *
 * @param uris The file URIs to arrange
 * @param directorySort The sort mode for each level; defaults to `'files-first'`
 * @param acronyms Acronyms to preserve when normalizing titles; defaults to none
 * @returns Promise resolving to the root-level tree nodes
 */
export async function buildTree(
	uris: vscode.Uri[],
	directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first',
	acronyms: string[] = [],
): Promise<TreeNode[]> {
	if (uris.length === 0) {
		return [];
	}

	const tree: TreeNode[] = [];
	const folders = new Map<string, TreeNode>();

	// Extract front matter for all files in parallel for better performance
	const frontMatterPromises = uris.map((uri) => extractFrontMatter(uri));
	const frontMatters = await Promise.all(frontMatterPromises);

	// Find common base path (directories only, not including filenames)
	const allPaths = uris.map((uri) => uri.path.split('/').filter((part: string) => part));

	// Calculate common directory path only (exclude the filename)
	const allDirectoryPaths = allPaths.map((path) => path.slice(0, -1)); // Remove filename from each path

	let commonBase: string[] = [];
	if (allDirectoryPaths.length > 0 && allDirectoryPaths[0].length > 0) {
		commonBase = allDirectoryPaths.reduce((common, path) => {
			const minLength = Math.min(common.length, path.length);
			let i = 0;
			while (i < minLength && common[i] === path[i]) {
				i++;
			}
			return common.slice(0, i);
		}, allDirectoryPaths[0]);
	}

	// First pass: collect all files and create folder structure
	for (let i = 0; i < uris.length; i++) {
		const originalUri = uris[i];
		const pathParts = originalUri.path.split('/').filter((part: string) => part);

		// Make path relative to common base (but keep the directory structure)
		const relativeParts = pathParts.slice(commonBase.length);
		const relativeFileName = relativeParts[relativeParts.length - 1];

		// Skip if we don't have a valid filename
		if (!relativeFileName) {
			continue;
		}

		// Build folder path using relative parts
		let currentPath = '';
		for (let depth = 0; depth < relativeParts.length - 1; depth++) {
			const folderName = relativeParts[depth];
			const parentPath = currentPath;
			currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

			if (!folders.has(currentPath)) {
				const folderNode: TreeNode = {
					type: 'folder',
					name: folderName,
					// A folder name is whole: the text after a dot in `docs.v2` is not an extension.
					title: normalizeTitle(folderName, acronyms, false),
					path: currentPath,
					// Derive the folder URI from the file's own URI so scheme and authority survive.
					// The leading slash is restored explicitly: splitting on '/' dropped it, and a
					// relative path here would produce an invalid URI on any scheme.
					uri: originalUri.with({
						path: `/${pathParts.slice(0, commonBase.length + depth + 1).join('/')}`,
						query: '',
						fragment: '',
					}),
					children: [],
				};
				folders.set(currentPath, folderNode);

				// Add to parent folder or root
				if (parentPath && folders.has(parentPath)) {
					folders.get(parentPath)!.children!.push(folderNode);
				} else if (parentPath === '' || !parentPath) {
					// Add to root if no parent or parent is empty string
					tree.push(folderNode);
				}
			}
		}

		// Use pre-extracted front matter data (extracted in parallel before the loop)
		const frontMatter = frontMatters[i];
		const displayTitle = frontMatter.title || normalizeTitle(relativeFileName, acronyms);

		// Add file to appropriate parent
		const fileNode: TreeNode = {
			type: 'file',
			name: relativeFileName,
			title: displayTitle,
			// Display path, relative to the common base, so files and folders read consistently.
			// Identity lives on `uri`, never on this string.
			path: relativeParts.join('/'),
			uri: originalUri,
			isIndex: isIndexFile(relativeFileName),
			isReadme: isReadmeFile(relativeFileName),
			description: frontMatter.description || undefined,
		};

		const folderPath = relativeParts.slice(0, -1).join('/');
		if (folderPath && folders.has(folderPath)) {
			folders.get(folderPath)!.children!.push(fileNode);
		} else {
			tree.push(fileNode);
		}
	}

	// Sort root level
	sortNodes(tree, directorySort);

	tree.forEach((node) => processNode(node, directorySort));
	return tree;
}
