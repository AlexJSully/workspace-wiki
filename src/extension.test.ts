/**
 * Unit tests for extension.ts - Main extension functionality
 * Tests only what is exported from extension.ts (activate, deactivate)
 */
import { WikiSiteManager } from '@site/sitePanel';
import { activate, deactivate } from './extension';
import { createMockUri } from './test/mocks';

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
		extensionUri: createMockUri('/extension'),
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
		afterEach(() => {
			jest.restoreAllMocks();
		});

		/**
		 * Activates the extension and returns the site manager it created, with spies on the manager calls
		 * the commands and listeners make, and the handler a command id was registered with.
		 */
		function activateSite() {
			const vscode = require('vscode');
			const open = jest.spyOn(WikiSiteManager.prototype, 'open');
			const refresh = jest.spyOn(WikiSiteManager.prototype, 'refresh');
			const handleSave = jest.spyOn(WikiSiteManager.prototype, 'handleSave');

			activate(mockContext as any);

			const managers = mockContext.subscriptions.filter((item) => item instanceof WikiSiteManager);
			const handler = (id: string) =>
				vscode.commands.registerCommand.mock.calls.find((call: any) => call[0] === id)[1];
			return { vscode, managers, open, refresh, handleSave, handler };
		}

		it('creates one site manager for the extension and disposes it with the context', () => {
			const { managers } = activateSite();

			expect(managers).toHaveLength(1);
		});

		it('opens the site home page', () => {
			const { open, handler } = activateSite();

			handler('workspace-wiki.openSite')();

			expect(open).toHaveBeenCalledWith();
		});

		const PAGE = createMockUri('/workspace-root/docs/a.md');

		it.each([
			{ description: 'a sidebar tree item', argument: { treeNode: { uri: PAGE } }, expected: PAGE },
			{ description: 'a URI', argument: PAGE, expected: PAGE },
			{ description: 'nothing', argument: undefined, expected: undefined },
			{ description: 'something else', argument: { path: '/a.md' }, expected: undefined },
		])('opens the site on the page named by $description', ({ argument, expected }) => {
			const { open, handler } = activateSite();

			handler('workspace-wiki.openInSite')(argument);

			expect(open).toHaveBeenCalledWith(expected);
		});

		it('refreshes the site with the tree', () => {
			const { refresh, handler } = activateSite();

			handler('workspace-wiki.refresh')();

			expect(refresh).toHaveBeenCalledTimes(1);
		});

		it('refreshes the site when a workspaceWiki setting changes, and not for other settings', () => {
			const { vscode, refresh } = activateSite();
			const onChange = vscode.workspace.onDidChangeConfiguration.mock.calls[0][0];

			onChange({ affectsConfiguration: (section: string) => section === 'editor' });
			expect(refresh).not.toHaveBeenCalled();

			onChange({ affectsConfiguration: (section: string) => section === 'workspaceWiki' });
			expect(refresh).toHaveBeenCalledTimes(1);
		});

		it('passes saved documents to the site', () => {
			const { vscode, handleSave } = activateSite();
			const onSave = vscode.workspace.onDidSaveTextDocument.mock.calls[0][0];

			onSave({ uri: PAGE });

			expect(handleSave).toHaveBeenCalledWith(PAGE);
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
