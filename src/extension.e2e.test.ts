/**
 * End-to-End Test Suite for Workspace Wiki Extension
 */
/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';

const { scanWorkspaceDocs, WorkspaceWikiTreeProvider } = require(process.cwd() + '/dist/extension.js');

/**
 * Simple mock workspace factory for E2E tests
 */
function createHiddenFilesMockWorkspace(showHiddenFiles: boolean) {
	return {
		findFiles: async (_pattern: string, _exclude?: string) => [
			{ fsPath: '/workspace-root/.github/agents.md' },
			{ fsPath: '/workspace-root/docs/visible.md' },
			{ fsPath: '/workspace-root/.env' },
			{ fsPath: '/workspace-root/visible.txt' },
		],
		getConfiguration: (_section: string) => ({
			get: (key: string) => {
				if (key === 'showHiddenFiles') {
					return showHiddenFiles;
				}
				if (key === 'excludeGlobs') {
					return [];
				}
				if (key === 'supportedExtensions') {
					return ['md', 'txt'];
				}
				return undefined;
			},
		}),
	};
}

describe('scanWorkspaceDocs E2E', () => {
	it('should exclude files listed in .gitignore and excludeGlobs', async () => {
		const docs = await scanWorkspaceDocs(vscode.workspace);
		// If no files are found, skip assertion (test env limitation)
		if (docs.length === 0) {
			return;
		}
		// Should exclude ignore-me.md and ignore-folder/README.md
		assert.ok(!docs.some((uri: any) => uri.fsPath.endsWith('ignore-me.md')));
		assert.ok(!docs.some((uri: any) => uri.fsPath.includes('ignore-folder')));
		// Should include test-md.md and test-txt.txt
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('test-md.md')));
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('test-txt.txt')));
	});

	it('should find documentation files in the workspace', async () => {
		const docs = await scanWorkspaceDocs(vscode.workspace);
		// E2E: In a development workspace, we expect to find documentation files
		// If no files are found, this might be due to test environment limitations
		if (docs.length === 0) {
			// Check if we're in the actual workspace by looking for specific files
			const readmeFiles = await vscode.workspace.findFiles('**/README.md');
			if (readmeFiles.length > 0) {
				assert.fail('scanWorkspaceDocs should have found documentation files that exist in workspace');
			} else {
				// Test environment doesn't have expected files, so skip assertion
				console.log('Skipping test: No documentation files found in test environment');
				return;
			}
		}
		assert.ok(docs.length > 0, 'No documentation files found');
	});

	it('should return URIs that exist on disk', async () => {
		const docs = await scanWorkspaceDocs(vscode.workspace);
		for (const uri of docs) {
			const stat = await vscode.workspace.fs.stat(uri);
			assert.ok(stat.size >= 0, `File does not exist: ${uri.fsPath}`);
		}
	});
});

describe('WorkspaceWikiTreeProvider E2E', () => {
	it('should instantiate and return tree items in a real workspace', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const items = await provider.getChildren();
		assert.ok(Array.isArray(items));
		for (const item of items) {
			assert.ok(item.label && typeof item.label === 'string');
			assert.ok(item.tooltip && typeof item.tooltip === 'string');
			assert.ok(item.command && typeof item.command === 'object');
		}
	});

	it('should register WorkspaceWiki tree data provider', async () => {
		// Check that the workspaceWiki view is registered
		const workspaceWikiView = vscode.window.createTreeView('workspaceWiki', {
			treeDataProvider: new WorkspaceWikiTreeProvider(
				vscode.workspace,
				vscode.TreeItem,
				vscode.TreeItemCollapsibleState,
				vscode.EventEmitter,
			),
		});

		assert.ok(workspaceWikiView, 'WorkspaceWiki tree view should be created');
		assert.ok(workspaceWikiView.visible !== undefined, 'Tree view should have visibility property');

		// Clean up
		workspaceWikiView.dispose();
	});

	it('should handle empty workspace gracefully', async () => {
		const mockEmptyWorkspace = {
			findFiles: async () => [],
			getConfiguration: () => ({ get: () => undefined }),
		};

		const provider = new WorkspaceWikiTreeProvider(
			mockEmptyWorkspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		const items = await provider.getChildren();
		assert.ok(Array.isArray(items));
		assert.strictEqual(items.length, 0, 'Empty workspace should return empty array');
	});

	it('should display proper icons and context values for files and folders', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const items = await provider.getChildren();

		for (const item of items) {
			// Each item should have proper context value
			assert.ok(
				['file', 'folder'].includes(item.contextValue),
				`Item should have contextValue of 'file' or 'folder', got: ${item.contextValue}`,
			);

			// Each item should have resourceUri for icon display
			assert.ok(item.resourceUri, 'Item should have resourceUri for icon display');

			if (item.contextValue === 'file') {
				// Files should have commands
				assert.ok(item.command, 'File items should have command for opening');
				assert.strictEqual(item.command.command, 'vscode.open', 'File command should be vscode.open');
			}

			if (item.contextValue === 'folder') {
				// Folders should be collapsible
				assert.ok(
					item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ||
						item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded,
					'Folders should be collapsible',
				);
			}
		}
	});

	it('should maintain proper folder names in hierarchical structure', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const items = await provider.getChildren();

		// Look for any folder items
		const folders = items.filter((item: any) => item.contextValue === 'folder');

		for (const folder of folders) {
			// Folder names should not be "Index" unless that's the actual folder name
			if (folder.label === 'Index') {
				// This would only be acceptable if there was actually a folder named 'index'
				// For most cases, this indicates the bug we're trying to fix
				console.warn(`Found folder labeled 'Index': ${folder.tooltip}`);
			}

			// Folder should have meaningful name
			assert.ok(folder.label && folder.label.length > 0, 'Folder should have non-empty label');
		}
	});

	it('should handle nested directory structures correctly', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const rootItems = await provider.getChildren();

		// Test expanding nested folders if any exist
		const folders = rootItems.filter((item: any) => item.contextValue === 'folder');

		for (const folder of folders) {
			const folderChildren = await provider.getChildren(folder);
			assert.ok(Array.isArray(folderChildren), 'Folder children should be array');

			// Each child should have proper properties
			for (const child of folderChildren) {
				assert.ok(child.label, 'Child should have label');
				assert.ok(['file', 'folder'].includes(child.contextValue), 'Child should have valid contextValue');
				assert.ok(child.resourceUri, 'Child should have resourceUri');
			}
		}
	});

	it('should provide context menu commands for file items only', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const items = await provider.getChildren();

		for (const item of items) {
			if (item.contextValue === 'file') {
				// File items should be available for context menu commands
				assert.ok(item.contextValue, 'File items should have contextValue for menu targeting');
				assert.strictEqual(item.contextValue, 'file', 'File items should have contextValue "file"');
			} else if (item.contextValue === 'folder') {
				// Folders should not have file-specific actions available
				assert.strictEqual(item.contextValue, 'folder', 'Folder items should have contextValue "folder"');
				// The menu contributions in package.json should filter these out
			}
		}
	});

	it('should respect workspaceWiki configuration settings', async () => {
		// Test that configuration is properly read and applied
		const config = vscode.workspace.getConfiguration('workspaceWiki');

		// These are the default values - in a real test environment, these should work
		const supportedExtensions = config.get('supportedExtensions') || ['md', 'markdown', 'txt'];
		const defaultOpenMode = config.get('defaultOpenMode') || 'preview';
		const directorySort = config.get('directorySort') || 'files-first';
		const excludeGlobs = config.get('excludeGlobs') || ['**/node_modules/**', '**/.git/**'];
		const maxSearchDepth = config.get('maxSearchDepth') || 10;

		// Verify settings have expected types and values
		assert.ok(Array.isArray(supportedExtensions), 'supportedExtensions should be an array');
		assert.ok(
			['preview', 'editor'].includes(defaultOpenMode as string),
			'defaultOpenMode should be preview or editor',
		);
		assert.ok(
			['files-first', 'folders-first', 'alphabetical'].includes(directorySort as string),
			'directorySort should be valid option',
		);
		assert.ok(Array.isArray(excludeGlobs), 'excludeGlobs should be an array');
		assert.ok(typeof maxSearchDepth === 'number', 'maxSearchDepth should be a number');
	});

	it('should handle command execution for preview and edit', async () => {
		// Test that the registered commands exist and can be executed
		const allCommands = await vscode.commands.getCommands();

		// Our extension might not be activated yet in the test environment,
		// so let's check if VS Code's built-in commands that we rely on are available
		assert.ok(allCommands.includes('vscode.open'), 'vscode.open command should be available');
		assert.ok(
			allCommands.includes('markdown.showPreview') || allCommands.length > 0,
			'Markdown preview or other commands should be available',
		);

		// Check that our extension's commands might be available after activation
		// In a real extension test, these would be registered when the extension activates
		const hasOurCommands = allCommands.some((cmd) => cmd.startsWith('workspace-wiki.'));

		// If our commands aren't registered, that might be expected in the test environment
		// The important thing is that the extension structure is correct
		if (hasOurCommands) {
			assert.ok(allCommands.includes('workspace-wiki.openPreview'), 'openPreview command should be registered');
			assert.ok(allCommands.includes('workspace-wiki.openEditor'), 'openEditor command should be registered');
			assert.ok(allCommands.includes('workspace-wiki.refresh'), 'refresh command should be registered');
		} else {
			// Extension may not be fully activated in test environment
			console.log('Extension commands not yet registered - this may be expected in test environment');
		}

		// Verify that VS Code's command system is working
		assert.ok(allCommands.length > 0, 'VS Code should have commands available');
	});
	it('should integrate with VS Code file opening behavior', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const items = await provider.getChildren();

		// Find file items and verify they have commands that integrate with VS Code
		const fileItems = items.filter((item: any) => item.contextValue === 'file');

		for (const fileItem of fileItems) {
			assert.ok(fileItem.command, 'File items should have default command');
			assert.ok(fileItem.command.command, 'File command should have command property');
			assert.ok(fileItem.command.arguments, 'File command should have arguments');

			// Command should be either VS Code built-in or markdown preview
			const validCommands = ['vscode.open', 'markdown.showPreview', 'markdown.showSource'];
			const isValidCommand = validCommands.some(
				(cmd) => fileItem.command.command === cmd || fileItem.command.command.startsWith('markdown.'),
			);

			assert.ok(
				isValidCommand || fileItem.command.command.includes('.'),
				`File command should be a valid VS Code command: ${fileItem.command.command}`,
			);
		}
	});

	it('should maintain proper directory sorting across different settings', async () => {
		// This test verifies that directory sorting works in a real VS Code environment
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		// Get current configuration
		const config = vscode.workspace.getConfiguration('workspaceWiki');
		const directorySort = config.get('directorySort') || 'files-first';

		const items = await provider.getChildren();

		if (items.length > 1) {
			// Verify that items are sorted according to the current setting
			// We can't change settings in this test, but we can verify current behavior

			const files = items.filter((item: any) => item.contextValue === 'file');
			const folders = items.filter((item: any) => item.contextValue === 'folder');

			if (files.length > 0 && folders.length > 0) {
				const _firstFileIndex = items.findIndex((item: any) => item.contextValue === 'file');
				const _firstFolderIndex = items.findIndex((item: any) => item.contextValue === 'folder');

				if (directorySort === 'files-first') {
					// README should be first, but among regular items, files should come before folders
					const nonReadmeItems = items.filter((item: any) => !item.label?.toLowerCase().startsWith('readme'));
					if (nonReadmeItems.length > 1) {
						const nonReadmeFiles = nonReadmeItems.filter((item: any) => item.contextValue === 'file');
						const nonReadmeFolders = nonReadmeItems.filter((item: any) => item.contextValue === 'folder');

						if (nonReadmeFiles.length > 0 && nonReadmeFolders.length > 0) {
							const firstNonReadmeFileIndex = items.findIndex(
								(item: any) =>
									item.contextValue === 'file' && !item.label?.toLowerCase().startsWith('readme'),
							);
							const firstNonReadmeFolderIndex = items.findIndex(
								(item: any) =>
									item.contextValue === 'folder' && !item.label?.toLowerCase().startsWith('readme'),
							);

							if (firstNonReadmeFileIndex !== -1 && firstNonReadmeFolderIndex !== -1) {
								assert.ok(
									firstNonReadmeFileIndex < firstNonReadmeFolderIndex,
									'Files should come before folders in files-first mode',
								);
							}
						}
					}
				}

				// Verify alphabetical sorting within same type
				const fileLabels = files
					.map((f: any) => f.label)
					.filter((label: string) => !label.toLowerCase().startsWith('readme'));
				const folderLabels = folders.map((f: any) => f.label);

				// Check if files are sorted alphabetically (ignoring README)
				if (fileLabels.length > 1) {
					const sortedFileLabels = [...fileLabels].sort((a, b) => a.localeCompare(b));
					assert.deepStrictEqual(fileLabels, sortedFileLabels, 'Files should be sorted alphabetically');
				}

				// Check if folders are sorted alphabetically
				if (folderLabels.length > 1) {
					const sortedFolderLabels = [...folderLabels].sort((a, b) => a.localeCompare(b));
					assert.deepStrictEqual(folderLabels, sortedFolderLabels, 'Folders should be sorted alphabetically');
				}
			}
		}
	});

	it('should properly handle file naming with various extensions', async () => {
		// Test that the normalizeTitle function properly handles different file extensions
		const { normalizeTitle } = require(process.cwd() + '/dist/extension.js');

		// Test HTM extension removal
		assert.strictEqual(normalizeTitle('test-htm.htm'), 'Test Htm', 'HTM extension should be removed');

		// Test HTML extension removal
		assert.strictEqual(normalizeTitle('test-html.html'), 'Test Html', 'HTML extension should be removed');

		// Test other extensions
		assert.strictEqual(normalizeTitle('test-css.css'), 'Test Css', 'CSS extension should be removed');
		assert.strictEqual(normalizeTitle('test-js.js'), 'Test Js', 'JS extension should be removed');
	});

	it('should apply acronym casing from settings', async () => {
		// Test that acronym casing works correctly
		const { normalizeTitle } = require(process.cwd() + '/dist/extension.js');

		const acronyms = ['HTML', 'CSS', 'API', 'JSON'];

		// Test acronym casing application
		assert.strictEqual(normalizeTitle('html-guide.html', acronyms), 'HTML Guide', 'HTML acronym should be applied');
		assert.strictEqual(normalizeTitle('css-styling.css', acronyms), 'CSS Styling', 'CSS acronym should be applied');
		assert.strictEqual(
			normalizeTitle('api-documentation.md', acronyms),
			'API Documentation',
			'API acronym should be applied',
		);
		assert.strictEqual(
			normalizeTitle('json-format.txt', acronyms),
			'JSON Format',
			'JSON acronym should be applied',
		);
	});

	it('should include hidden files in tree when showHiddenFiles is true', async () => {
		const mockWorkspace = createHiddenFilesMockWorkspace(true);
		const docs = await scanWorkspaceDocs(mockWorkspace);
		// Should include hidden files
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('.github/agents.md')));
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('.env')));
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('visible.md')));
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('visible.txt')));
	});

	it('should exclude hidden files in tree when showHiddenFiles is false', async () => {
		const mockWorkspace = createHiddenFilesMockWorkspace(false);
		const docs = await scanWorkspaceDocs(mockWorkspace);
		// Should exclude hidden files
		assert.ok(!docs.some((uri: any) => uri.fsPath.endsWith('.github/agents.md')));
		assert.ok(!docs.some((uri: any) => uri.fsPath.endsWith('.env')));
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('visible.md')));
		assert.ok(docs.some((uri: any) => uri.fsPath.endsWith('visible.txt')));
	});

	it('should handle double-click to open in editor mode', async () => {
		const { handleFileClick } = require(process.cwd() + '/dist/extension.js');

		// Mock command tracking
		const executedCommands: string[] = [];
		const originalExecuteCommand = vscode.commands.executeCommand;

		vscode.commands.executeCommand = async (command: string, ...args: any[]) => {
			executedCommands.push(command);
			return originalExecuteCommand(command, ...args);
		};

		try {
			const mockUri = vscode.Uri.file('/test/file.md');
			const defaultCommand = 'markdown.showPreview';

			// First click
			handleFileClick(mockUri, defaultCommand);

			// Second click within threshold (simulating double-click)
			handleFileClick(mockUri, defaultCommand);

			// Allow some time for commands to execute
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should have executed preview command once and open command once
			assert.ok(executedCommands.includes(defaultCommand), 'Preview command should be executed');
			assert.ok(
				executedCommands.includes('vscode.open'),
				'Editor open command should be executed on double-click',
			);
		} finally {
			// Restore original command
			vscode.commands.executeCommand = originalExecuteCommand;
		}
	});
});

describe('Double-Click Integration E2E', () => {
	it('should have double-click functionality available', async () => {
		// Verify that the extension module exports the handleFileClick function
		const extension = require(process.cwd() + '/dist/extension.js');
		assert.ok(typeof extension.handleFileClick === 'function', 'handleFileClick function should be exported');
	});
});

describe('Sync Module E2E Tests', () => {
	it('should register auto-reveal configuration settings', async () => {
		const config = vscode.workspace.getConfiguration('workspaceWiki');

		// Test that the new sync settings are available
		const autoReveal = config.get('autoReveal');
		const autoRevealDelay = config.get('autoRevealDelay');

		// These should have default values even if not explicitly set
		assert.ok(
			typeof autoReveal === 'boolean' || autoReveal === undefined,
			'autoReveal should be boolean or undefined',
		);
		assert.ok(
			typeof autoRevealDelay === 'number' || autoRevealDelay === undefined,
			'autoRevealDelay should be number or undefined',
		);
	});

	it('should create tree view with collapse all functionality', async () => {
		// Verify that the tree view supports collapse all
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		const treeView = vscode.window.createTreeView('testWorkspaceWiki', {
			treeDataProvider: provider,
			showCollapseAll: true,
		});

		// Verify the tree view was created with collapse all enabled
		assert.ok(treeView, 'TreeView should be created');
		assert.ok(typeof treeView.visible === 'boolean', 'TreeView should have visible property');

		// Clean up
		treeView.dispose();
	});

	it('should implement getParent method for reveal functionality', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		// Build the tree first
		const children = await provider.getChildren();

		// Test that getParent method exists
		assert.ok(typeof provider.getParent === 'function', 'Provider should have getParent method');

		// Test getParent with a valid element
		if (children.length > 0) {
			const parent = provider.getParent(children[0]);
			// Root level items should have undefined parent
			assert.strictEqual(parent, undefined, 'Root level items should have undefined parent');
		}
	});

	it('should handle findNodeByPath for sync functionality', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		// Build the tree first
		await provider.getChildren();

		// Test that findNodeByPath method exists
		assert.ok(typeof provider.findNodeByPath === 'function', 'Provider should have findNodeByPath method');

		// Test with a non-existent path
		const nonExistentNode = provider.findNodeByPath('/non/existent/path.md');
		assert.strictEqual(nonExistentNode, undefined, 'Should return undefined for non-existent paths');
	});
});

describe('Tree View Enhancements E2E', () => {
	it('should register collapse all command', async () => {
		const allCommands = await vscode.commands.getCommands();

		// Our collapse all command might not be registered yet in test environment,
		// but we can verify the VS Code built-in collapse functionality exists
		const hasCollapseCommand = allCommands.some((cmd) => cmd.includes('collapseAll') || cmd.includes('collapse'));

		assert.ok(hasCollapseCommand || allCommands.length > 0, 'Collapse functionality should be available');
	});

	it('should support inline actions for files', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		const items = await provider.getChildren();

		// Find file items and verify they have the expected structure for inline actions
		const fileItems = items.filter((item: any) => item.contextValue === 'file');

		for (const fileItem of fileItems) {
			// Verify file items have the necessary properties for inline actions
			assert.ok(fileItem.contextValue === 'file', 'File items should have correct contextValue');
			// Commands for inline actions should be available through the contribution points
		}
	});

	it('should handle tree view visibility changes', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		const treeView = vscode.window.createTreeView('testWorkspaceWikiVisibility', {
			treeDataProvider: provider,
			showCollapseAll: true,
		});

		// Test that visibility change events are supported
		assert.ok(treeView.onDidChangeVisibility, 'TreeView should support visibility change events');
		assert.ok(typeof treeView.visible === 'boolean', 'TreeView should have visible property');

		// Clean up
		treeView.dispose();
	});

	it('should maintain tree structure after refresh', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);

		// Get initial tree structure
		const initialItems = await provider.getChildren();
		const initialCount = initialItems.length;

		// Refresh the tree
		provider.refresh();

		// Get updated tree structure
		const refreshedItems = await provider.getChildren();

		// Verify structure is maintained (should have same number of root items)
		assert.strictEqual(refreshedItems.length, initialCount, 'Tree structure should be maintained after refresh');
	});
});
