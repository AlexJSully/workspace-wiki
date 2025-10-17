import { handleFileClick, openInEditor, openInPreview } from '@controllers';
import { WorkspaceWikiTreeProvider } from '@tree';
import { syncOpenWithToSupportedExtensions } from '@utils';
import * as vscode from 'vscode';

// VS Code extension activation: register WorkspaceWikiTreeProvider for 'workspaceWiki' view

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

		const activeFilePath = activeEditor.document.uri.fsPath;

		// Check if this file is supported by our extension
		const supportedExtensions = config.get('supportedExtensions', ['md', 'markdown', 'txt']) as string[];
		const fileExt = activeFilePath.split('.').pop()?.toLowerCase();

		if (!fileExt || !supportedExtensions.includes(fileExt)) {
			return;
		}

		// Clear any existing timeout
		if (revealTimeout) {
			clearTimeout(revealTimeout);
		}

		const doReveal = () => {
			const node = treeProvider.findNodeByPath(activeFilePath);
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

export function deactivate() {
	// Clean up resources when extension is deactivated
}
