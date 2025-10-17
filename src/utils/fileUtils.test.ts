/**
 * Unit tests for file utilities
 */
import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import {
	getDirectoryName,
	getFileName,
	getPathDepth,
	getRelativePath,
	isHiddenPath,
	matchesGlobPattern,
	normalizePath,
} from './fileUtils';

// Mock vscode
jest.mock(
	'vscode',
	() => ({
		workspace: {
			getConfiguration: jest.fn(() => ({
				get: jest.fn(),
			})),
			getWorkspaceFolder: jest.fn(),
			asRelativePath: jest.fn(),
		},
		commands: {
			executeCommand: jest.fn(),
		},
		Uri: {
			file: jest.fn(),
		},
	}),
	{ virtual: true },
);

describe('fileUtils', () => {
	const mockVscode = require('vscode') as any;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getRelativePath', () => {
		it('should return relative path when workspace folder exists', () => {
			const mockUri = { fsPath: '/workspace/docs/file.md' } as vscode.Uri;
			const mockWorkspaceFolder = { uri: { fsPath: '/workspace' } };

			mockVscode.workspace.getWorkspaceFolder.mockReturnValue(mockWorkspaceFolder);
			mockVscode.workspace.asRelativePath.mockReturnValue('docs/file.md');

			const result = getRelativePath(mockUri);

			expect(result).toBe('docs/file.md');
			expect(mockVscode.workspace.asRelativePath).toHaveBeenCalledWith(mockUri, false);
		});

		it('should return fsPath when no workspace folder', () => {
			const mockUri = { fsPath: '/some/file.md' } as vscode.Uri;

			mockVscode.workspace.getWorkspaceFolder.mockReturnValue(null);

			const result = getRelativePath(mockUri);

			expect(result).toBe('/some/file.md');
		});
	});

	describe('isHiddenPath', () => {
		it('should identify hidden files and directories', () => {
			expect(isHiddenPath('.hidden')).toBe(true);
			expect(isHiddenPath('.gitignore')).toBe(true);
			expect(isHiddenPath('path/.hidden/file.txt')).toBe(true);
			expect(isHiddenPath('/root/.vscode/settings.json')).toBe(true);
		});

		it('should not consider non-hidden paths as hidden', () => {
			expect(isHiddenPath('visible.txt')).toBe(false);
			expect(isHiddenPath('path/to/file.md')).toBe(false);
			expect(isHiddenPath('file.')).toBe(false); // ends with dot
		});

		it('should handle edge cases', () => {
			expect(isHiddenPath('.')).toBe(false); // single dot
			expect(isHiddenPath('..')).toBe(false); // double dot
			expect(isHiddenPath('')).toBe(false);
			expect(isHiddenPath(null as any)).toBe(false);
		});
	});

	describe('normalizePath', () => {
		it('should convert backslashes to forward slashes', () => {
			expect(normalizePath('path\\to\\file.txt')).toBe('path/to/file.txt');
			expect(normalizePath('C:\\Users\\name\\Documents')).toBe('C:/Users/name/Documents');
		});

		it('should leave forward slashes unchanged', () => {
			expect(normalizePath('path/to/file.txt')).toBe('path/to/file.txt');
			expect(normalizePath('/root/docs/readme.md')).toBe('/root/docs/readme.md');
		});

		it('should handle empty or invalid input', () => {
			expect(normalizePath('')).toBe('');
			expect(normalizePath(null as any)).toBe('');
			expect(normalizePath(undefined as any)).toBe('');
		});
	});

	describe('getDirectoryName', () => {
		it('should extract directory name from path', () => {
			expect(getDirectoryName('/root/docs/file.md')).toBe('docs');
			expect(getDirectoryName('path/to/nested/file.txt')).toBe('nested');
			expect(getDirectoryName('C:\\Users\\name\\file.doc')).toBe('name');
		});

		it('should handle root level files', () => {
			expect(getDirectoryName('/file.txt')).toBe('');
			expect(getDirectoryName('file.md')).toBe('');
		});

		it('should handle empty or invalid input', () => {
			expect(getDirectoryName('')).toBe('');
			expect(getDirectoryName(null as any)).toBe('');
		});
	});

	describe('getFileName', () => {
		it('should extract file name from path', () => {
			expect(getFileName('/root/docs/file.md')).toBe('file.md');
			expect(getFileName('path/to/nested/document.txt')).toBe('document.txt');
			expect(getFileName('C:\\Users\\name\\file.doc')).toBe('file.doc');
		});

		it('should handle file names without paths', () => {
			expect(getFileName('file.txt')).toBe('file.txt');
			expect(getFileName('README.md')).toBe('README.md');
		});

		it('should handle empty or invalid input', () => {
			expect(getFileName('')).toBe('');
			expect(getFileName(null as any)).toBe('');
		});
	});

	describe('matchesGlobPattern', () => {
		it('should match simple glob patterns', () => {
			expect(matchesGlobPattern('/docs/file.md', ['**/*.md'])).toBe(true);
			expect(matchesGlobPattern('/src/index.js', ['**/*.js'])).toBe(true);
			expect(matchesGlobPattern('/test/spec.ts', ['**/*.ts'])).toBe(true);
		});

		it('should match directory patterns', () => {
			expect(matchesGlobPattern('/node_modules/pkg/file.js', ['**/node_modules/**'])).toBe(true);
			expect(matchesGlobPattern('/.git/config', ['**/.git/**'])).toBe(true);
		});

		it('should handle single asterisk patterns', () => {
			expect(matchesGlobPattern('/docs/file.md', ['*.md'])).toBe(false);
			expect(matchesGlobPattern('file.md', ['*.md'])).toBe(true);
		});

		it('should handle question mark patterns', () => {
			expect(matchesGlobPattern('/docs/a.md', ['**/?.md'])).toBe(true);
			expect(matchesGlobPattern('/docs/ab.md', ['**/?.md'])).toBe(false);
		});

		it('should be case insensitive', () => {
			expect(matchesGlobPattern('/DOCS/FILE.MD', ['**/*.md'])).toBe(true);
			expect(matchesGlobPattern('/SRC/INDEX.JS', ['**/*.js'])).toBe(true);
		});

		it('should handle invalid patterns gracefully', () => {
			expect(matchesGlobPattern('/docs/file.md', ['[invalid'])).toBe(false);
		});

		it('should handle empty or invalid input', () => {
			expect(matchesGlobPattern('', ['**/*.md'])).toBe(false);
			expect(matchesGlobPattern('/file.md', null as any)).toBe(false);
			expect(matchesGlobPattern('/file.md', [])).toBe(false);
		});
	});

	describe('getPathDepth', () => {
		it('should calculate path depth correctly', () => {
			expect(getPathDepth('/root')).toBe(1);
			expect(getPathDepth('/root/docs')).toBe(2);
			expect(getPathDepth('/root/docs/nested/file.md')).toBe(4);
			expect(getPathDepth('relative/path/file.txt')).toBe(3);
		});

		it('should handle Windows paths', () => {
			expect(getPathDepth('C:\\Users\\name\\Documents')).toBe(4);
			expect(getPathDepth('D:\\Projects\\myapp\\src\\index.js')).toBe(5);
		});

		it('should handle empty paths', () => {
			expect(getPathDepth('')).toBe(0);
			expect(getPathDepth('/')).toBe(0);
			expect(getPathDepth(null as any)).toBe(0);
		});

		it('should ignore trailing slashes', () => {
			expect(getPathDepth('/root/docs/')).toBe(2);
			expect(getPathDepth('/root/docs/nested/')).toBe(3);
		});
	});
});
