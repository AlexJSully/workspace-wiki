/**
 * Unit tests for extension.ts - Main extension functionality
 * Tests only what is exported from extension.ts (activate, deactivate)
 */
import { activate, deactivate } from './extension';

// Mock the imported modules (vscode is already mocked in setupTests.ts)
jest.mock('./controllers/previewController', () => ({
	handleFileClick: jest.fn(),
	openInEditor: jest.fn(),
	openInPreview: jest.fn(),
}));

jest.mock('./tree/treeProvider', () => ({
	WorkspaceWikiTreeProvider: jest.fn().mockImplementation(() => ({
		refresh: jest.fn(),
		findNodeByUri: jest.fn(),
		dispose: jest.fn(),
	})),
}));

jest.mock('./utils/configUtils', () => ({
	syncOpenWithToSupportedExtensions: jest.fn(),
}));

describe('extension', () => {
	const mockContext = {
		subscriptions: [] as any[],
	};

	beforeEach(() => {
		// Reset context and mocks before each test
		mockContext.subscriptions = [];
		jest.clearAllMocks();
	});

	describe('activate', () => {
		it('should set extension context to enabled', () => {
			const vscode = require('vscode');

			activate(mockContext as any);

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'workspaceWiki:enabled', true);
		});

		it('should create tree view with correct configuration', () => {
			const vscode = require('vscode');

			activate(mockContext as any);

			expect(vscode.window.createTreeView).toHaveBeenCalledWith('workspaceWiki', {
				treeDataProvider: expect.any(Object),
				showCollapseAll: true,
			});
		});

		it('should register all required commands', () => {
			const vscode = require('vscode');

			activate(mockContext as any);

			const registeredCommands = vscode.commands.registerCommand.mock.calls.map((call: any) => call[0]);

			expect(registeredCommands).toContain('workspace-wiki.handleClick');
			expect(registeredCommands).toContain('workspace-wiki.openPreview');
			expect(registeredCommands).toContain('workspace-wiki.openEditor');
			expect(registeredCommands).toContain('workspace-wiki.refresh');
		});

		it('should register event listeners for editor changes and configuration changes', () => {
			const vscode = require('vscode');

			activate(mockContext as any);

			expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
			expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
		});

		it('should add all disposables to context subscriptions', () => {
			activate(mockContext as any);

			// Should have added multiple disposables (tree provider, tree view, commands, listeners, etc.)
			expect(mockContext.subscriptions.length).toBeGreaterThan(5);
		});

		describe('auto-reveal', () => {
			/**
			 * Activates the extension and returns the registered active-editor callback along with the
			 * tree provider and view it was wired to.
			 *
			 * @param settings Configuration values the handler should read
			 * @returns The callback plus the provider and view doubles
			 */
			function activateAndCaptureRevealHandler(settings: Record<string, unknown>) {
				const vscode = require('vscode');
				const { WorkspaceWikiTreeProvider } = require('./tree/treeProvider');

				vscode.workspace.getConfiguration.mockReturnValue({
					get: (key: string, defaultValue?: unknown) => (key in settings ? settings[key] : defaultValue),
				});

				const treeView = { visible: true, reveal: jest.fn(), onDidChangeVisibility: jest.fn() };
				vscode.window.createTreeView.mockReturnValue(treeView);

				activate(mockContext as any);

				const provider = WorkspaceWikiTreeProvider.mock.results[0].value;
				const handler = vscode.window.onDidChangeActiveTextEditor.mock.calls[0][0];

				return { handler, provider, treeView };
			}

			it('reveals the active file when its extension is supported', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				const activeUri = createMockUri('/workspace-root/docs/guide.md');
				vscode.window.activeTextEditor = { document: { uri: activeUri } };

				const { handler, provider, treeView } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
				});
				provider.findNodeByUri.mockReturnValue({ label: 'Guide' });

				handler();

				// Looked up by URI, not by a path string.
				expect(provider.findNodeByUri).toHaveBeenCalledWith(activeUri);
				expect(treeView.reveal).toHaveBeenCalled();
			});

			it('ignores an active file whose extension is not supported', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				vscode.window.activeTextEditor = { document: { uri: createMockUri('/workspace-root/image.png') } };

				const { handler, provider } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
				});

				handler();

				expect(provider.findNodeByUri).not.toHaveBeenCalled();
			});

			it('reveals the active file when an include glob matches it', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				const activeUri = createMockUri('/workspace-root/pkg/doc.go');
				vscode.window.activeTextEditor = { document: { uri: activeUri } };

				const { handler, provider, treeView } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
					includeGlobs: ['doc.go'],
				});
				provider.findNodeByUri.mockReturnValue({ label: 'Doc' });

				handler();

				expect(provider.findNodeByUri).toHaveBeenCalledWith(activeUri);
				expect(treeView.reveal).toHaveBeenCalled();
			});

			it('ignores a file sharing an extension with an include glob but not its name', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				vscode.window.activeTextEditor = {
					document: { uri: createMockUri('/workspace-root/pkg/other.go') },
				};

				const { handler, provider } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
					includeGlobs: ['doc.go'],
				});

				handler();

				expect(provider.findNodeByUri).not.toHaveBeenCalled();
			});

			it('does nothing when autoReveal is disabled', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				vscode.window.activeTextEditor = { document: { uri: createMockUri('/workspace-root/docs/guide.md') } };

				const { handler, provider } = activateAndCaptureRevealHandler({
					autoReveal: false,
					supportedExtensions: ['md', 'markdown', 'txt'],
				});

				handler();

				expect(provider.findNodeByUri).not.toHaveBeenCalled();
			});
		});

		it('should sync extensions on activation', () => {
			const { syncOpenWithToSupportedExtensions } = require('./utils/configUtils');

			activate(mockContext as any);

			expect(syncOpenWithToSupportedExtensions).toHaveBeenCalled();
		});

		it('should create WorkspaceWikiTreeProvider with correct parameters', () => {
			const vscode = require('vscode');
			const { WorkspaceWikiTreeProvider } = require('./tree/treeProvider');

			activate(mockContext as any);

			expect(WorkspaceWikiTreeProvider).toHaveBeenCalledWith(
				vscode.workspace,
				vscode.TreeItem,
				vscode.TreeItemCollapsibleState,
				vscode.EventEmitter,
			);
		});
	});

	describe('deactivate', () => {
		it('should execute without errors', () => {
			expect(() => deactivate()).not.toThrow();
		});

		it('should be a function that can be called', () => {
			expect(typeof deactivate).toBe('function');

			// Should not throw when called
			const result = deactivate();
			expect(result).toBeUndefined();
		});
	});
});
