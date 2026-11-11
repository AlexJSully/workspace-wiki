/**
 * Unit tests for extension.ts - Main extension functionality
 * Tests only what is exported from extension.ts (activate, deactivate)
 */
import { activate, deactivate } from './extension';

// Mock the imported modules (vscode is already mocked in setupTests.ts)
// Only the four open handlers are replaced; the command id and default map stay real, so a test
// asserting a command id is asserting the one activate() actually registers rather than a copy.
jest.mock('./controllers/previewController', () => ({
	...jest.requireActual('./controllers/previewController'),
	handleFileClick: jest.fn(),
	openInEditor: jest.fn(),
	openInPreview: jest.fn(),
	openMarkdown: jest.fn(),
}));

// The site manager is replaced so these tests see which manager call each command and listener
// makes; the manager itself is covered by src/site/sitePanel.test.ts.
jest.mock('./site/sitePanel', () => ({
	WikiSiteManager: jest.fn().mockImplementation(() => ({
		open: jest.fn(),
		refresh: jest.fn(),
		handleSave: jest.fn(async () => undefined),
		resolveContextUri: jest.fn(async (context: any) => (context?.uri ? { path: context.uri } : undefined)),
		openExternal: jest.fn(async () => undefined),
		dispose: jest.fn(),
	})),
}));

jest.mock('./tree/treeProvider', () => ({
	WorkspaceWikiTreeProvider: jest.fn().mockImplementation(() => ({
		refresh: jest.fn(),
		findNodeByUri: jest.fn(),
		dispose: jest.fn(),
	})),
}));

// Only the settings writer is replaced; the rest of the module stays real so that the accessors
// activate() reads settings through are the ones under test.
jest.mock('./utils/configUtils', () => ({
	...jest.requireActual('./utils/configUtils'),
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

			// The whole set, not one `toContain` per id: a command registered under an undefined id
			// satisfies every individual containment check while registering nothing usable.
			expect([...registeredCommands].sort()).toEqual([
				'workspace-wiki.handleClick',
				'workspace-wiki.openEditor',
				'workspace-wiki.openInSite',
				'workspace-wiki.openMarkdown',
				'workspace-wiki.openPreview',
				'workspace-wiki.openSite',
				'workspace-wiki.refresh',
				'workspace-wiki.site.copyLink',
				'workspace-wiki.site.copyPath',
				'workspace-wiki.site.editSource',
				'workspace-wiki.site.openInNewTab',
				'workspace-wiki.site.openLinkExternal',
				'workspace-wiki.site.openLinkIntegrated',
				'workspace-wiki.site.openOriginal',
				'workspace-wiki.site.openToSide',
			]);
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

				const { handler, provider, treeView } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
					includeGlobs: ['doc.go'],
				});
				// The scan never matched this file, so it has no node. The lookup is what establishes
				// that, which is why the assertion is on the reveal rather than on the lookup.
				provider.findNodeByUri.mockReturnValue(undefined);

				handler();

				expect(treeView.reveal).not.toHaveBeenCalled();
			});

			it('reveals a file an include glob reaches through a zero-segment double star', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				// `findFiles` expands `**` to zero or more segments, so `docs/**/*.adoc` scans this file
				// even though nothing sits between `docs` and it.
				const activeUri = createMockUri('/workspace-root/docs/notes.adoc');
				vscode.window.activeTextEditor = { document: { uri: activeUri } };

				const { handler, provider, treeView } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
					includeGlobs: ['docs/**/*.adoc'],
				});
				provider.findNodeByUri.mockReturnValue({ label: 'Notes' });

				handler();

				expect(provider.findNodeByUri).toHaveBeenCalledWith(activeUri);
				expect(treeView.reveal).toHaveBeenCalled();
			});

			it('ignores a file with no include globs configured and an unsupported extension', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				vscode.window.activeTextEditor = {
					document: { uri: createMockUri('/workspace-root/pkg/doc.go') },
				};

				const { handler, provider } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
					includeGlobs: [],
				});

				handler();

				expect(provider.findNodeByUri).not.toHaveBeenCalled();
			});

			it('ignores a file when includeGlobs is not an array of strings', () => {
				const vscode = require('vscode');
				const { createMockUri } = require('./test/mocks');
				vscode.window.activeTextEditor = {
					document: { uri: createMockUri('/workspace-root/pkg/doc.go') },
				};

				const { handler, provider } = activateAndCaptureRevealHandler({
					autoReveal: true,
					autoRevealDelay: 0,
					supportedExtensions: ['md', 'markdown', 'txt'],
					includeGlobs: 'doc.go',
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

	describe('Wiki Site', () => {
		/**
		 * Activates the extension and returns the site manager it created with the handler a command id
		 * was registered with.
		 */
		function activateSite() {
			const vscode = require('vscode');
			const { WikiSiteManager } = require('./site/sitePanel');

			activate(mockContext as any);

			const manager = WikiSiteManager.mock.results[0].value;
			const handler = (id: string) =>
				vscode.commands.registerCommand.mock.calls.find((call: any) => call[0] === id)[1];
			return { vscode, manager, handler };
		}

		it('creates one site manager for the extension and disposes it with the context', () => {
			const { WikiSiteManager } = require('./site/sitePanel');

			activate(mockContext as any);

			expect(WikiSiteManager).toHaveBeenCalledTimes(1);
			expect(mockContext.subscriptions).toContain(WikiSiteManager.mock.results[0].value);
		});

		it('opens the site home page', () => {
			const { manager, handler } = activateSite();

			handler('workspace-wiki.openSite')();

			expect(manager.open).toHaveBeenCalledWith();
		});

		it.each([
			{ description: 'a sidebar tree item', argument: { treeNode: { uri: 'tree-uri' } }, expected: 'tree-uri' },
			{
				description: 'a URI',
				argument: { scheme: 'file', path: '/a.md' },
				expected: { scheme: 'file', path: '/a.md' },
			},
			{ description: 'nothing', argument: undefined, expected: undefined },
		])('opens the site on the page named by $description', ({ argument, expected }) => {
			const { manager, handler } = activateSite();

			handler('workspace-wiki.openInSite')(argument);

			expect(manager.open).toHaveBeenCalledWith(expected);
		});

		it('opens a right-clicked page in a new tab, and to the side', async () => {
			const { vscode, manager, handler } = activateSite();

			await handler('workspace-wiki.site.openInNewTab')({ webviewSection: 'doc', uri: '/workspace-root/a.md' });
			await handler('workspace-wiki.site.openToSide')({ webviewSection: 'doc', uri: '/workspace-root/a.md' });

			expect(manager.open).toHaveBeenNthCalledWith(1, { path: '/workspace-root/a.md' }, { newTab: true });
			expect(manager.open).toHaveBeenNthCalledWith(
				2,
				{ path: '/workspace-root/a.md' },
				{ newTab: true, viewColumn: vscode.ViewColumn.Beside },
			);
		});

		it('opens a right-clicked page as its original file, in preview or the editor', async () => {
			const { openInPreview, openInEditor } = require('./controllers/previewController');
			const { handler } = activateSite();

			await handler('workspace-wiki.site.openOriginal')({ webviewSection: 'doc', uri: '/workspace-root/a.md' });
			await handler('workspace-wiki.site.editSource')({ webviewSection: 'doc', uri: '/workspace-root/a.md' });

			expect(openInPreview).toHaveBeenCalledWith({ path: '/workspace-root/a.md' });
			expect(openInEditor).toHaveBeenCalledWith({ path: '/workspace-root/a.md' });
		});

		it('does nothing for a page command whose context names no page', async () => {
			const { openInPreview } = require('./controllers/previewController');
			const { manager, handler } = activateSite();

			await handler('workspace-wiki.site.openInNewTab')(undefined);
			await handler('workspace-wiki.site.openOriginal')({
				webviewSection: 'external',
				href: 'https://example.com',
			});

			expect(manager.open).not.toHaveBeenCalled();
			expect(openInPreview).not.toHaveBeenCalled();
		});

		it('opens a right-clicked external link in the default or integrated browser, and copies it', async () => {
			const { vscode, manager, handler } = activateSite();
			const context = { webviewSection: 'external', href: 'https://example.com/docs' };

			await handler('workspace-wiki.site.openLinkExternal')(context);
			await handler('workspace-wiki.site.openLinkIntegrated')(context);
			await handler('workspace-wiki.site.copyLink')(context);

			expect(manager.openExternal).toHaveBeenNthCalledWith(1, 'https://example.com/docs', false);
			expect(manager.openExternal).toHaveBeenNthCalledWith(2, 'https://example.com/docs', true);
			expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('https://example.com/docs');
		});

		it('copies the relative path of a right-clicked page', async () => {
			const { vscode, handler } = activateSite();

			await handler('workspace-wiki.site.copyPath')({ webviewSection: 'doc', uri: '/workspace-root/docs/a.md' });

			expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('docs/a.md');
		});

		it('refreshes the site with the tree', () => {
			const { manager, handler } = activateSite();

			handler('workspace-wiki.refresh')();

			expect(manager.refresh).toHaveBeenCalledTimes(1);
		});

		it('refreshes the site when a workspaceWiki setting changes, and not for other settings', () => {
			const { vscode, manager } = activateSite();
			const onChange = vscode.workspace.onDidChangeConfiguration.mock.calls[0][0];

			onChange({ affectsConfiguration: (section: string) => section === 'editor' });
			expect(manager.refresh).not.toHaveBeenCalled();

			onChange({ affectsConfiguration: (section: string) => section === 'workspaceWiki' });
			expect(manager.refresh).toHaveBeenCalledTimes(1);
		});

		it('passes saved documents to the site', () => {
			const { vscode, manager } = activateSite();
			const onSave = vscode.workspace.onDidSaveTextDocument.mock.calls[0][0];

			onSave({ uri: 'saved-uri' });

			expect(manager.handleSave).toHaveBeenCalledWith('saved-uri');
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
