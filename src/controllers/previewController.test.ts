import { createMockMarkdownExtension, createMockUri, setMockExtensions } from '../test/mocks';
import {
	DEFAULT_OPEN_WITH,
	OPEN_MARKDOWN_COMMAND,
	clearClickTimes,
	getDoubleClickThreshold,
	getOpenCommand,
	handleFileClick,
	openInEditor,
	openInPreview,
	openMarkdown,
	validateOpenWith,
} from './previewController';

describe('previewController', () => {
	const mockVscode = require('vscode') as any;

	beforeEach(() => {
		// Reset all mocks before each test
		jest.clearAllMocks();
		clearClickTimes();
		mockVscode.commands.executeCommand.mockClear();
		mockVscode.workspace.getConfiguration().get.mockClear();
		mockVscode.workspace.getConfiguration.mockClear();
		// A VS Code with no extensions at all, so every test installs the contributions it depends on.
		setMockExtensions([]);
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('openInPreview', () => {
		it('should execute markdown preview for .md files', () => {
			const mockUri = createMockUri('/test/file.md');
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			openInPreview(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});

		it('should execute default command for unsupported extensions', () => {
			const mockUri = createMockUri('/test/file.xyz');
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			openInPreview(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});

		it('should route to the capability chain when configuration is missing', () => {
			const mockUri = createMockUri('/test/file.md');
			mockVscode.workspace.getConfiguration().get.mockReturnValue(undefined);

			openInPreview(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(OPEN_MARKDOWN_COMMAND, mockUri);
		});
	});

	describe('openMarkdown', () => {
		it('should open a .md file in the Markdown Editor when VS Code contributes it', () => {
			const mockUri = createMockUri('/test/file.md');
			setMockExtensions([createMockMarkdownExtension()]);

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
				'vscode.openWith',
				mockUri,
				'vscode.markdown.editor',
			);
		});

		it('should fall back to the preview for .mdx, which the Markdown Editor does not claim', () => {
			const mockUri = createMockUri('/test/guide.mdx');
			setMockExtensions([createMockMarkdownExtension()]);

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});

		it('should fall back to the preview for an extensionless README', () => {
			const mockUri = createMockUri('/test/README');
			setMockExtensions([createMockMarkdownExtension()]);

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});

		it('should follow a widened selector rather than assuming .md', () => {
			const mockUri = createMockUri('/test/guide.mdx');
			setMockExtensions([createMockMarkdownExtension({ selectorPatterns: ['*.md', '*.mdx'] })]);

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
				'vscode.openWith',
				mockUri,
				'vscode.markdown.editor',
			);
		});

		it('should fall back to the preview when VS Code predates the Markdown Editor', () => {
			const mockUri = createMockUri('/test/file.md');
			setMockExtensions([createMockMarkdownExtension({ markdownEditor: false })]);

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('markdown.showPreview', mockUri);
		});

		it('should fall back to a plain open when no markdown extension is present', () => {
			const mockUri = createMockUri('/test/file.md');

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});

		it('should not dispatch its own command when openWith maps md back to it', () => {
			const mockUri = createMockUri('/test/file.md');
			mockVscode.workspace.getConfiguration().get.mockReturnValue({ md: OPEN_MARKDOWN_COMMAND });
			setMockExtensions([createMockMarkdownExtension()]);

			openMarkdown(mockUri);

			expect(mockVscode.commands.executeCommand).not.toHaveBeenCalledWith(OPEN_MARKDOWN_COMMAND, mockUri);
			expect(mockVscode.commands.executeCommand).toHaveBeenCalledTimes(1);
		});
	});

	describe('openInEditor', () => {
		it('should force the text editor for a file the Markdown Editor would claim', () => {
			const mockUri = createMockUri('/test/file.md');
			setMockExtensions([createMockMarkdownExtension()]);

			openInEditor(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openWith', mockUri, 'default');
		});

		it('should leave every other file to the default opener', () => {
			const mockUri = createMockUri('/test/handbook.pdf');
			setMockExtensions([createMockMarkdownExtension()]);

			openInEditor(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});

		it('should execute vscode.open when the Markdown Editor is unavailable', () => {
			const mockUri = createMockUri('/test/file.md');

			openInEditor(mockUri);

			expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', mockUri);
		});
	});

	describe('handleFileClick', () => {
		const mockUri = createMockUri('/test/file.md');

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
			const mockUri1 = createMockUri('/test/file1.md');
			const mockUri2 = createMockUri('/test/file2.md');

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
			const mockUri = createMockUri('/test/file.md');

			const command = getOpenCommand(mockUri, 'editor');

			expect(command).toBe('vscode.open');
		});

		it('should return appropriate preview command for supported extensions', () => {
			const mockUri = createMockUri('/test/file.md');
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe('markdown.showPreview');
		});

		it('should return default command for unsupported extensions', () => {
			const mockUri = createMockUri('/test/file.xyz');
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe('vscode.open');
		});

		it('should handle missing configuration', () => {
			const mockUri = createMockUri('/test/file.md');
			mockVscode.workspace.getConfiguration().get.mockReturnValue(undefined);

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe(OPEN_MARKDOWN_COMMAND);
		});

		it('should route MDX files through the capability chain by default', () => {
			const mockUri = createMockUri('/test/guide.mdx');
			mockVscode.workspace.getConfiguration().get.mockReturnValue(undefined);

			const command = getOpenCommand(mockUri, 'preview');

			expect(command).toBe(OPEN_MARKDOWN_COMMAND);
		});

		it('should default to preview mode', () => {
			const mockUri = createMockUri('/test/file.md');
			mockVscode.workspace.getConfiguration().get.mockReturnValue({
				md: 'markdown.showPreview',
			});

			const command = getOpenCommand(mockUri);

			expect(command).toBe('markdown.showPreview');
		});
	});

	describe('clearClickTimes', () => {
		it('should clear all stored click times', () => {
			const mockUri = createMockUri('/test/file.md');

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

	describe('validateOpenWith', () => {
		it('should pass through a map of string values', () => {
			const configured = { md: 'markdown.showPreview', pdf: 'vscode.open' };

			expect(validateOpenWith(configured)).toBe(configured);
		});

		it.each([
			['undefined', undefined],
			['null', null],
			['an array', ['markdown.showPreview']],
			['a bare string', 'markdown.showPreview'],
			['a map with a non-string value', { md: 42 }],
			['a map with a nested object', { md: { command: 'markdown.showPreview' } }],
		])('should fall back to the defaults for %s', (_label, value) => {
			expect(validateOpenWith(value)).toBe(DEFAULT_OPEN_WITH);
		});
	});
});
