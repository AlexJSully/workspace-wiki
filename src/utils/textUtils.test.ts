import * as fs from 'fs';
import * as path from 'path';
import { createMockUri } from '../test/mocks';
import {
	extractFrontMatter,
	extractFrontMatterTitle,
	getFileExtension,
	isIndexFile,
	isReadmeFile,
	normalizeTitle,
} from './textUtils';

describe('textUtils', () => {
	describe('extractFrontMatter', () => {
		const testFilesDir = path.join(__dirname, '../../.test-temp');

		beforeAll(() => {
			// Create test directory if it doesn't exist
			if (!fs.existsSync(testFilesDir)) {
				fs.mkdirSync(testFilesDir, { recursive: true });
			}
		});

		afterAll(() => {
			// Clean up test directory
			if (fs.existsSync(testFilesDir)) {
				fs.rmSync(testFilesDir, { recursive: true, force: true });
			}
		});

		test.each([
			{
				description: 'extract both title and description from YAML front matter',
				fileName: 'test-full-frontmatter.md',
				content: `---
title: "Accessibility Best Practices"
description: "Guidelines for creating accessible software"
tags: ["accessibility", "a11y"]
---
This document provides accessibility guidance.`,
				expectedTitle: 'Accessibility Best Practices',
				expectedDescription: 'Guidelines for creating accessible software',
			},
			{
				description: 'extract only title when description is missing',
				fileName: 'test-title-only.md',
				content: `---
title: "Title Only"
tags: ["test"]
---
Content here.`,
				expectedTitle: 'Title Only',
				expectedDescription: null,
			},
			{
				description: 'extract only description when title is missing',
				fileName: 'test-description-only.md',
				content: `---
description: "Description without title"
author: "Test Author"
---
Content here.`,
				expectedTitle: null,
				expectedDescription: 'Description without title',
			},
			{
				description: 'return nulls for files without front matter',
				fileName: 'test-no-fm.md',
				content: `# Regular Markdown\n\nNo front matter here.`,
				expectedTitle: null,
				expectedDescription: null,
			},
			{
				description: 'handle non-markdown files by returning nulls',
				fileName: 'test.txt',
				content: `---
title: "Should Not Parse"
description: "This is a text file"
---
Text content.`,
				expectedTitle: null,
				expectedDescription: null,
			},
			{
				description: 'trim whitespace from title and description',
				fileName: 'test-whitespace-fm.md',
				content: `---
title: "  Whitespace Title  "
description: "  Whitespace Description  "
---
Content.`,
				expectedTitle: 'Whitespace Title',
				expectedDescription: 'Whitespace Description',
			},
			{
				description: 'parse front matter behind a UTF-8 byte order mark',
				fileName: 'test-bom-fm.md',
				content: '﻿---\ntitle: "BOM Title"\ndescription: "BOM Description"\n---\nContent.',
				expectedTitle: 'BOM Title',
				expectedDescription: 'BOM Description',
			},
			{
				description: 'parse front matter with CRLF line endings',
				fileName: 'test-crlf-fm.md',
				content: '---\r\ntitle: "CRLF Title"\r\ndescription: "CRLF Description"\r\n---\r\nContent.',
				expectedTitle: 'CRLF Title',
				expectedDescription: 'CRLF Description',
			},
			{
				description: 'return nulls for an empty front matter block',
				fileName: 'test-empty-fm.md',
				content: '---\n\n---\nContent.',
				expectedTitle: null,
				expectedDescription: null,
			},
			{
				description: 'extract front matter from an MDX file',
				fileName: 'test-mdx-frontmatter.mdx',
				content: `---
title: "MDX Guide"
description: "Front matter in an MDX document"
---
import { Note } from './Note';

<Note>MDX body.</Note>`,
				expectedTitle: 'MDX Guide',
				expectedDescription: 'Front matter in an MDX document',
			},
			{
				description: 'read only the leading block when the body also contains a delimiter',
				fileName: 'test-delimiter-in-body.md',
				content: '---\ntitle: "Real Title"\n---\nContent.\n---\nNot front matter.',
				expectedTitle: 'Real Title',
				expectedDescription: null,
			},
		])('should $description', async ({ fileName, content, expectedTitle, expectedDescription }) => {
			const testFile = path.join(testFilesDir, fileName);
			fs.writeFileSync(testFile, content);
			const uri = createMockUri(testFile);

			const result = await extractFrontMatter(uri);
			expect(result.title).toBe(expectedTitle);
			expect(result.description).toBe(expectedDescription);

			fs.unlinkSync(testFile);
		});

		it('should read through the VS Code file system API rather than Node fs', async () => {
			// A Node fs read would produce the same title here, so the parsed value proves nothing.
			// Asserting the seam is what catches a reintroduced Node dependency.
			const vscode = require('vscode');
			const testFile = path.join(testFilesDir, 'test-vscode-fs-read.md');
			fs.writeFileSync(testFile, '---\ntitle: "Read Via Workspace Fs"\n---\nContent.');
			const uri = createMockUri(testFile);

			const result = await extractFrontMatter(uri);

			expect(result.title).toBe('Read Via Workspace Fs');
			expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(uri);

			fs.unlinkSync(testFile);
		});

		it('should not read a file it will not parse', async () => {
			const vscode = require('vscode');
			const testFile = path.join(testFilesDir, 'test-skip-read.txt');
			fs.writeFileSync(testFile, '---\ntitle: "Should Not Parse"\n---\nText.');

			const result = await extractFrontMatter(createMockUri(testFile));

			expect(result).toEqual({ title: null, description: null });
			expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();

			fs.unlinkSync(testFile);
		});

		it('should handle empty or invalid file paths', async () => {
			const result1 = await extractFrontMatter('' as any);
			const result2 = await extractFrontMatter(null as any);
			const result3 = await extractFrontMatter(undefined as any);

			expect(result1).toEqual({ title: null, description: null });
			expect(result2).toEqual({ title: null, description: null });
			expect(result3).toEqual({ title: null, description: null });
		});

		it('should handle non-existent files gracefully', async () => {
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			const nonExistentFile = path.join(testFilesDir, 'does-not-exist.md');
			const result = await extractFrontMatter(createMockUri(nonExistentFile));
			expect(result).toEqual({ title: null, description: null });
			expect(consoleErrorSpy).not.toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});

		it('should report unparseable front matter and fall back to nulls', async () => {
			// YAML forbids tab characters in indentation, so this block does not parse. The file
			// keeps working and falls back to its filename-derived title, and the parse failure is
			// reported rather than swallowed.
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			const testFile = path.join(testFilesDir, 'test-tab-indent-fm.md');
			fs.writeFileSync(testFile, '---\ntitle: A\n\tbad: B\n---\nContent.');

			const result = await extractFrontMatter(createMockUri(testFile));

			expect(result).toEqual({ title: null, description: null });
			expect(consoleErrorSpy).toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
			fs.unlinkSync(testFile);
		});
	});

	describe('extractFrontMatterTitle', () => {
		const testFilesDir = path.join(__dirname, '../../.test-temp');

		beforeAll(() => {
			// Create test directory if it doesn't exist
			if (!fs.existsSync(testFilesDir)) {
				fs.mkdirSync(testFilesDir, { recursive: true });
			}
		});

		afterAll(() => {
			// Clean up test directory
			if (fs.existsSync(testFilesDir)) {
				fs.rmSync(testFilesDir, { recursive: true, force: true });
			}
		});

		it('should extract title from YAML front matter', async () => {
			const testFile = path.join(testFilesDir, 'test-frontmatter.md');
			const content = `---
title: "Introduction to Accessibility"
description: "Guidance for creating more accessible code"
---
# Accessibility

This document provides guidance on creating accessible software.`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(createMockUri(testFile));
			expect(title).toBe('Introduction to Accessibility');

			fs.unlinkSync(testFile);
		});

		it('should return null for files without front matter', async () => {
			const testFile = path.join(testFilesDir, 'test-no-frontmatter.md');
			const content = `# Regular Markdown

This is just regular markdown without front matter.`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(createMockUri(testFile));
			expect(title).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should return null for files with front matter but no title', async () => {
			const testFile = path.join(testFilesDir, 'test-no-title.md');
			const content = `---
description: "A file without title"
tags: ["test"]
---
# Content`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(createMockUri(testFile));
			expect(title).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should handle non-markdown files by returning null', async () => {
			const testFile = path.join(testFilesDir, 'test.txt');
			const content = `---
title: "Should Not Parse"
---
This is a text file`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(createMockUri(testFile));
			expect(title).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should handle empty or invalid file paths', async () => {
			expect(await extractFrontMatterTitle('' as any)).toBeNull();
			expect(await extractFrontMatterTitle(null as any)).toBeNull();
			expect(await extractFrontMatterTitle(undefined as any)).toBeNull();
		});

		it('should handle non-existent files gracefully', async () => {
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			const nonExistentFile = path.join(testFilesDir, 'does-not-exist.md');
			const title = await extractFrontMatterTitle(createMockUri(nonExistentFile));
			expect(title).toBeNull();
			expect(consoleErrorSpy).not.toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});

		it('should trim whitespace from title', async () => {
			const testFile = path.join(testFilesDir, 'test-whitespace.md');
			const content = `---
title: "  Whitespace Title  "
---
# Content`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(createMockUri(testFile));
			expect(title).toBe('Whitespace Title');

			fs.unlinkSync(testFile);
		});
	});

	describe('normalizeTitle', () => {
		// Test table for invalid/edge case inputs
		test.each([
			{ input: '', expected: '', description: 'empty string' },
			{ input: null, expected: '', description: 'null' },
			{ input: undefined, expected: '', description: 'undefined' },
			{ input: 123, expected: '', description: 'number' },
		])('should handle $description input', ({ input, expected }: { input: any; expected: string }) => {
			expect(normalizeTitle(input as any)).toBe(expected);
		});

		// Test table for file extension removal
		test.each([
			{ input: 'test.md', expected: 'Test' },
			{ input: 'test.markdown', expected: 'Test' },
			{ input: 'test.txt', expected: 'Test' },
			{ input: 'test.html', expected: 'Test' },
			{ input: 'test.htm', expected: 'Test' },
			{ input: 'test.pdf', expected: 'Test' },
			{ input: 'test.css', expected: 'Test' },
			{ input: 'test.js', expected: 'Test' },
			{ input: 'test.ts', expected: 'Test' },
			{ input: 'test.json', expected: 'Test' },
			{ input: 'test.xml', expected: 'Test' },
			{ input: 'test.mdx', expected: 'Test' },
			{ input: 'test.go', expected: 'Test' },
			{ input: 'test.rst', expected: 'Test' },
			{ input: 'test.adoc', expected: 'Test' },
		])('should remove $input extension correctly', ({ input, expected }: { input: string; expected: string }) => {
			expect(normalizeTitle(input)).toBe(expected);
		});

		// A name with no extension to remove keeps every character it has.
		test.each([
			{ input: 'doc.go', expected: 'Doc', description: 'included source file' },
			{ input: 'api.guide.ts', expected: 'Api.Guide', description: 'compound name' },
			{ input: 'CHANGELOG', expected: 'CHANGELOG', description: 'extensionless name' },
			{ input: '.env', expected: '.Env', description: 'dotfile with nothing before the dot' },
		])('should title $description: $input', ({ input, expected }: { input: string; expected: string }) => {
			expect(normalizeTitle(input)).toBe(expected);
		});

		// Folder names are not file names: `docs.v2` is the whole name, not a name plus an extension.
		test.each([
			{ input: 'docs.v2', expected: 'Docs.V2', description: 'versioned folder' },
			{ input: 'example.com', expected: 'Example.Com', description: 'domain-like folder' },
			{ input: 'getting-started', expected: 'Getting Started', description: 'kebab-case folder' },
		])(
			'should keep a folder name whole: $description',
			({ input, expected }: { input: string; expected: string }) => {
				expect(normalizeTitle(input, [], false)).toBe(expected);
			},
		);

		// Test table for README file handling
		test.each([
			{ input: 'readme.md', expected: 'README' },
			{ input: 'README.txt', expected: 'README' },
			{ input: 'ReadMe.markdown', expected: 'README' },
		])('should handle README file: $input', ({ input, expected }: { input: string; expected: string }) => {
			expect(normalizeTitle(input)).toBe(expected);
		});

		// Test table for case conversion
		test.each([
			{ input: 'gettingStarted.md', expected: 'Getting Started', caseType: 'camelCase' },
			{ input: 'myAwesomeDocument.txt', expected: 'My Awesome Document', caseType: 'camelCase' },
			{ input: 'testCamelCase.html', expected: 'Test Camel Case', caseType: 'camelCase' },
			{ input: 'my-awesome-document.md', expected: 'My Awesome Document', caseType: 'kebab-case' },
			{ input: 'getting-started.txt', expected: 'Getting Started', caseType: 'kebab-case' },
			{ input: 'test-kebab-case.html', expected: 'Test Kebab Case', caseType: 'kebab-case' },
			{ input: 'my_awesome_document.md', expected: 'My Awesome Document', caseType: 'snake_case' },
			{ input: 'getting_started.txt', expected: 'Getting Started', caseType: 'snake_case' },
			{ input: 'test_snake_case.html', expected: 'Test Snake Case', caseType: 'snake_case' },
		])(
			'should convert $caseType to Title Case: $input',
			({ input, expected }: { input: string; expected: string }) => {
				expect(normalizeTitle(input)).toBe(expected);
			},
		);

		// Test table for acronym casing
		test.each([
			{
				input: 'api-guide.md',
				expected: 'API Guide',
				acronyms: ['API', 'HTTP', 'JSON', 'XML'],
			},
			{
				input: 'http_requests.txt',
				expected: 'HTTP Requests',
				acronyms: ['API', 'HTTP', 'JSON', 'XML'],
			},
			{
				input: 'jsonDataFormat.html',
				expected: 'JSON Data Format',
				acronyms: ['API', 'HTTP', 'JSON', 'XML'],
			},
			{
				input: 'javascript-tutorial.md',
				expected: 'JavaScript Tutorial',
				acronyms: ['JavaScript', 'TypeScript', 'CSS', 'HTML'],
			},
			{
				input: 'typescript_guide.txt',
				expected: 'TypeScript Guide',
				acronyms: ['JavaScript', 'TypeScript', 'CSS', 'HTML'],
			},
			{
				input: 'cssStyleGuide.html',
				expected: 'CSS Style Guide',
				acronyms: ['JavaScript', 'TypeScript', 'CSS', 'HTML'],
			},
		])(
			'should apply acronym casing: $input',
			({ input, expected, acronyms }: { input: string; expected: string; acronyms: string[] }) => {
				expect(normalizeTitle(input, acronyms)).toBe(expected);
			},
		);

		// Test table for miscellaneous cases
		test.each([
			{ input: 'test-document.md', expected: 'Test Document', description: 'without acronyms' },
			{ input: 'myTestFile.txt', expected: 'My Test File', description: 'without acronyms' },
			{ input: 'introduction.md', expected: 'Introduction', description: 'single word' },
			{ input: 'overview.txt', expected: 'Overview', description: 'single word' },
			{ input: 'file.backup.md', expected: 'File.Backup', description: 'multiple extensions' },
			{ input: 'test.min.js', expected: 'Test.Min', description: 'multiple extensions' },
		])('should handle $description: $input', ({ input, expected }: { input: string; expected: string }) => {
			expect(normalizeTitle(input)).toBe(expected);
		});
	});

	describe('getFileExtension', () => {
		// Test table for various file extensions and edge cases
		test.each([
			{ input: 'test.md', expected: 'md', description: 'markdown file' },
			{ input: 'document.txt', expected: 'txt', description: 'text file' },
			{ input: 'style.css', expected: 'css', description: 'CSS file' },
			{ input: 'script.js', expected: 'js', description: 'JavaScript file' },
			{ input: 'README', expected: '', description: 'file without extension' },
			{ input: 'Makefile', expected: '', description: 'Makefile without extension' },
			{ input: 'file.backup.md', expected: 'md', description: 'multiple dots' },
			{ input: 'test.min.js', expected: 'js', description: 'minified file' },
			{ input: '', expected: '', description: 'empty string' },
			{ input: null, expected: '', description: 'null' },
			{ input: undefined, expected: '', description: 'undefined' },
			{ input: 'TEST.MD', expected: 'md', description: 'uppercase extension' },
			{ input: 'Document.TXT', expected: 'txt', description: 'mixed case extension' },
		])('should handle $description: $input', ({ input, expected }: { input: any; expected: string }) => {
			expect(getFileExtension(input as any)).toBe(expected);
		});
	});

	describe('isIndexFile', () => {
		// Test table for index file identification
		test.each([
			{ input: 'index.md', expected: true, description: 'lowercase .md' },
			{ input: 'index.html', expected: true, description: 'lowercase .html' },
			{ input: 'index.txt', expected: true, description: 'lowercase .txt' },
			{ input: 'Index.md', expected: true, description: 'capitalized' },
			{ input: 'INDEX.HTML', expected: true, description: 'uppercase' },
			{ input: 'readme.md', expected: false, description: 'readme file' },
			{ input: 'test.html', expected: false, description: 'regular file' },
			{ input: 'myindex.txt', expected: false, description: 'contains index' },
			{ input: '', expected: false, description: 'empty string' },
			{ input: null, expected: false, description: 'null' },
			{ input: undefined, expected: false, description: 'undefined' },
		])(
			'should return $expected for $description: $input',
			({ input, expected }: { input: any; expected: boolean }) => {
				expect(isIndexFile(input as any)).toBe(expected);
			},
		);
	});

	describe('isReadmeFile', () => {
		// Test table for README file identification
		test.each([
			{ input: 'README.md', expected: true, description: 'uppercase .md' },
			{ input: 'readme.txt', expected: true, description: 'lowercase .txt' },
			{ input: 'Readme.html', expected: true, description: 'capitalized .html' },
			{ input: 'ReadMe.rst', expected: true, description: 'mixed case .rst' },
			// The scanner discovers extensionless README files, and they rank first like any other.
			{ input: 'README', expected: true, description: 'uppercase, no extension' },
			{ input: 'readme', expected: true, description: 'lowercase, no extension' },
			{ input: 'ReadMe', expected: true, description: 'mixed case, no extension' },
			{ input: 'index.md', expected: false, description: 'index file' },
			{ input: 'test.html', expected: false, description: 'regular file' },
			{ input: 'myreadme.txt', expected: false, description: 'contains readme' },
			{ input: 'myreadme', expected: false, description: 'contains readme, no extension' },
			{ input: 'readme-old.md', expected: false, description: 'readme prefix without a dot' },
			{ input: '', expected: false, description: 'empty string' },
			{ input: null, expected: false, description: 'null' },
			{ input: undefined, expected: false, description: 'undefined' },
		])(
			'should return $expected for $description: $input',
			({ input, expected }: { input: any; expected: boolean }) => {
				expect(isReadmeFile(input as any)).toBe(expected);
			},
		);
	});
});
