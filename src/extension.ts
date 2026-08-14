import { handleFileClick, openInEditor, openInPreview } from '@controllers';
import { WorkspaceWikiTreeProvider } from '@tree';
import { getFileExtension, getIncludeGlobs, syncOpenWithToSupportedExtensions } from '@utils';
import * as vscode from 'vscode';

/**
 * Starts the extension.
 *
 * Registers the Workspace Wiki view and its four commands, then wires the listeners that keep the
 * tree current: active-editor changes drive auto-reveal, and any `workspaceWiki` setting change
 * re-syncs `openWith` and refreshes the tree. Every disposable is pushed onto the context.
 *
 * @param context The extension context whose subscriptions receive each disposable
 */
export function activate(context: vscode.ExtensionContext) {
	// Set context for when the extension is active
	vscode.commands.executeCommand('setContext', 'workspaceWiki:enabled', true);

	// Sync on activation
	syncOpenWithToSupportedExtensions();

	const treeProvider = new WorkspaceWikiTreeProvider(
		vscode.workspace,
		vscode.TreeItem,
		vscode.TreeItemCollapsibleState,
		vscode.EventEmitter,
	);

	const treeView = vscode.window.createTreeView('workspaceWiki', {
		treeDataProvider: treeProvider,
		showCollapseAll: true,
	});

	// Sync functionality: reveal active file in tree
	let revealTimeout: ReturnType<typeof setTimeout> | undefined;

	const revealActiveFile = () => {
		const config = vscode.workspace.getConfiguration('workspaceWiki');
		const autoReveal = config.get('autoReveal', true);
		const autoRevealDelay = config.get('autoRevealDelay', 500);

		if (!autoReveal) {
			return;
		}

		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}

		const activeUri = activeEditor.document.uri;

		// Check if this file is supported by our extension, by extension or by include pattern
		const supportedExtensions = config.get('supportedExtensions', ['md', 'markdown', 'mdx', 'txt']) as string[];
		const fileExt = getFileExtension(activeUri.path);

		const isSupportedExtension = !!fileExt && supportedExtensions.includes(fileExt);
		// An include pattern is not re-matched here. `matchesGlobPattern` is stricter than the glob
		// `findFiles` gives the scanner — `**` matches zero path segments there and one or more here —
		// so testing the pattern again would reject files the scan did put in the tree. Membership is
		// settled by `doReveal` below, against the tree itself, which cannot disagree with the scan.
		const mayBeIncludedByGlob = getIncludeGlobs(config).length > 0;

		if (!isSupportedExtension && !mayBeIncludedByGlob) {
			return;
		}

		// Clear any existing timeout
		if (revealTimeout) {
			clearTimeout(revealTimeout);
		}

		const doReveal = () => {
			const node = treeProvider.findNodeByUri(activeUri);
			if (node && treeView.visible) {
				Promise.resolve(
					treeView.reveal(node, {
						select: true,
						focus: false,
						expand: true,
					}),
				).catch(() => {
					// Ignore errors - might happen if tree not ready yet
				});
			}
		};

		if (autoRevealDelay > 0) {
			revealTimeout = setTimeout(doReveal, autoRevealDelay);
		} else {
			doReveal();
		}
	};

	const handleClickCommand = vscode.commands.registerCommand('workspace-wiki.handleClick', (uri, defaultCommand) => {
		handleFileClick(uri, defaultCommand);
	});

	const openPreviewCommand = vscode.commands.registerCommand('workspace-wiki.openPreview', (item) => {
		if (item && item.treeNode && item.treeNode.uri) {
			openInPreview(item.treeNode.uri);
		}
	});

	const openEditorCommand = vscode.commands.registerCommand('workspace-wiki.openEditor', (item) => {
		if (item && item.treeNode && item.treeNode.uri) {
			openInEditor(item.treeNode.uri);
		}
	});

	const refreshCommand = vscode.commands.registerCommand('workspace-wiki.refresh', () => {
		treeProvider.refresh();
	});

	// Listen for active editor changes
	const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
		revealActiveFile();
	});

	// Listen for configuration changes to auto-refresh tree and sync extensions
	const configurationChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
		// Refresh tree and sync extensions on any workspaceWiki.* setting change
		if (event.affectsConfiguration('workspaceWiki')) {
			syncOpenWithToSupportedExtensions();
			treeProvider.refresh();
		}
	});

	// Reveal the currently active file when the tree becomes visible
	const treeVisibilityListener = treeView.onDidChangeVisibility((e) => {
		if (e.visible) {
			revealActiveFile();
		}
	});

	// Initial reveal of active file
	const initialRevealTimeout = setTimeout(() => {
		revealActiveFile();
	}, 1000); // Give time for the tree to be built

	// Create disposable for initial timeout cleanup
	const initialTimeoutDisposable = {
		dispose: () => {
			if (initialRevealTimeout) {
				clearTimeout(initialRevealTimeout);
			}
		},
	};

	context.subscriptions.push(treeProvider);
	context.subscriptions.push(treeView);
	context.subscriptions.push(handleClickCommand);
	context.subscriptions.push(openPreviewCommand);
	context.subscriptions.push(openEditorCommand);
	context.subscriptions.push(refreshCommand);
	context.subscriptions.push(editorChangeListener);
	context.subscriptions.push(configurationChangeListener);
	context.subscriptions.push(treeVisibilityListener);
	context.subscriptions.push(initialTimeoutDisposable);
}

/**
 * Shuts the extension down.
 *
 * Nothing to do: every disposable was registered on the context, which VS Code disposes itself.
 */
export function deactivate() {}
