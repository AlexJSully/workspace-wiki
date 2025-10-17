/**
 * Unit tests for preview controller
 */
import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import {
	clearClickTimes,
	getDoubleClickThreshold,
	getOpenCommand,
	handleFileClick,
	openInEditor,
	openInPreview,
} from './previewController';

// Create the mock object before using it
jest.mock(
	'vscode',
	() => ({
		workspace: {
			getConfiguration: jest.fn(() => ({
				get: jest.fn(),
			})),
		},
		commands: {
			executeCommand: jest.fn(),
		},
	}),
	{ virtual: true },
);

describe('previewController', () => {
	const mockVscode = require('vscode') as any;

	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
		clearClickTimes();
		mockVscode.commands.executeCommand.mockClear();
		mockVscode.workspace.getConfiguration().get.mockClear();
		mockVscode.workspace.getConfiguration.mockClear();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('openInPreview', () => {
		it('should execute markdown preview for .md files', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			openInPreview(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});

		it('should execute default command for unsupported extensions', () => {
			const mockUri = { fsPath: '/test/file.xyz' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			openInPreview(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});

		it('should handle missing configuration gracefully', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue(undefined);

			openInPreview(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});
	});

	describe('openInEditor', () => {
		it('should execute vscode.open command', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;

			openInEditor(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});
	});

	describe('handleFileClick', () => {
		const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;

		it('should handle single click by executing default command', () => {
			handleFileClick(mockUri, 'markdown.showPreview');

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});

		it('should handle double click by opening in editor', () => {
			// First click
			handleFileClick(mockUri, 'markdown.showPreview');
			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);

			// Second click within threshold
			jest.advanceTimersByTime(200);
			handleFileClick(mockUri, 'markdown.showPreview');

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});

		it('should treat clicks beyond threshold as separate single clicks', () => {
			// First click
			handleFileClick(mockUri, 'markdown.showPreview');
			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);

			// Second click after threshold
			jest.advanceTimersByTime(600);
			handleFileClick(mockUri, 'markdown.showPreview');

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledTimes(2);
		});

		it('should handle different files independently', () => {
			const mockUri1 = { fsPath: '/test/file1.md' } as vscode.Uri;
			const mockUri2 = { fsPath: '/test/file2.md' } as vscode.Uri;

			// Click on file1
			handleFileClick(mockUri1, 'markdown.showPreview');
			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri1);

			// Click on file2 within threshold
			jest.advanceTimersByTime(200);
			handleFileClick(mockUri2, 'markdown.showPreview');
			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri2);

			// Another click on file1 within threshold should trigger double-click
			jest.advanceTimersByTime(200);
			handleFileClick(mockUri1, 'markdown.showPreview');
			expect(mockVscode.commands.executeCommand).toHaveBeenLastCalledWith('vscode.open', mockUri1);
		});

		it('should clean up old click times', () => {
			handleFileClick(mockUri, 'markdown.showPreview');

			// Advance time beyond cleanup threshold
			jest.advanceTimersByTime(700);

			// Click again should be treated as new single click
			handleFileClick(mockUri, 'markdown.showPreview');

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledTimes(2);
		});
	});

	describe('getOpenCommand', () => {
		it('should return vscode.open for editor mode', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;

			const command = getOpenCommand(mockUri, 'editor');

			expect(command).toBe('vscode.open');
		});

		it('should return appropriate preview command for supported extensions', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe('markdown.showPreview');
		});

		it('should return default command for unsupported extensions', () => {
			const mockUri = { fsPath: '/test/file.xyz' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe('vscode.open');
		});

		it('should handle missing configuration', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue(undefined);

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe('markdown.showPreview');
		});

		it('should default to preview mode', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			const command = getOpenCommand(mockUri);

			expect(command).toBe('markdown.showPreview');
		});
	});

	describe('clearClickTimes', () => {
		it('should clear all stored click times', () => {
			const mockUri = { fsPath: '/test/file.md' } as vscode.Uri;

			// Create some click times
			handleFileClick(mockUri, 'markdown.showPreview');

			// Clear them
			clearClickTimes();

			// Next click should be treated as first click
			handleFileClick(mockUri, 'markdown.showPreview');

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledTimes(2);
		});
	});

	describe('getDoubleClickThreshold', () => {
		it('should return the correct threshold value', () => {
			expect(getDoubleClickThreshold()).toBe(500);
		});
	});
});
