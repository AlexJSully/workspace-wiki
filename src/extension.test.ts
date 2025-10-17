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
		findNodeByPath: jest.fn(),
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
