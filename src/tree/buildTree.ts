import type { TreeNode } from '@types';
import { normalizeTitle } from '@utils';

/**
 * Sorts tree nodes based on directory sort setting
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
 * Processes tree nodes recursively, applying sorting to children
 */
export function processNode(
	node: TreeNode,
	directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first',
): void {
	if (node.type === 'folder' && node.children) {
		// Note: We keep the original folder name, index.md files are shown as children

		// Sort children based on directory sort setting
		sortNodes(node.children, directorySort);

		// Recursively process children
		node.children.forEach((child) => processNode(child, directorySort));
	}
}

/**
 * Build hierarchical tree structure from flat file list
 */
export function buildTree(
	uris: any[],
	directorySort: 'files-first' | 'folders-first' | 'alphabetical' = 'files-first',
	acronyms: string[] = [],
): TreeNode[] {
	if (uris.length === 0) {
		return [];
	}

	const tree: TreeNode[] = [];
	const folders = new Map<string, TreeNode>();

	// Normalize path separators for cross-platform compatibility
	const normalizedUris = uris.map((uri) => ({
		...uri,
		fsPath: uri.fsPath.replace(/\\/g, '/'),
	}));

	// Find common base path (directories only, not including filenames)
	const allPaths = normalizedUris.map((uri) => uri.fsPath.split('/').filter((part: string) => part));

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
		const normalizedUri = normalizedUris[i];
		const pathParts = normalizedUri.fsPath.split('/').filter((part: string) => part);

		// Make path relative to common base (but keep the directory structure)
		const relativeParts = pathParts.slice(commonBase.length);
		const relativeFileName = relativeParts[relativeParts.length - 1];

		// Skip if we don't have a valid filename
		if (!relativeFileName) {
			continue;
		}

		// Build folder path using relative parts
		let currentPath = '';
		for (let i = 0; i < relativeParts.length - 1; i++) {
			const folderName = relativeParts[i];
			const parentPath = currentPath;
			currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

			if (!folders.has(currentPath)) {
				const folderNode: TreeNode = {
					type: 'folder',
					name: folderName,
					title: normalizeTitle(folderName, acronyms),
					path: currentPath,
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

		// Add file to appropriate parent
		const fileNode: TreeNode = {
			type: 'file',
			name: relativeFileName,
			title: normalizeTitle(relativeFileName, acronyms),
			path: originalUri.fsPath,
			uri: originalUri,
			isIndex: relativeFileName.toLowerCase() === 'index.md',
			isReadme: relativeFileName.toLowerCase().startsWith('readme.'),
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
