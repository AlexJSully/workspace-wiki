import * as fs from 'fs';
import * as path from 'path';
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

		it('should extract both title and description from YAML front matter', async () => {
			const testFile = path.join(testFilesDir, 'test-full-frontmatter.md');
			const content = `---
title: "Accessibility Best Practices"
description: "Guidelines for creating accessible software"
tags: ["accessibility", "a11y"]
---
This document provides accessibility guidance.`;
			fs.writeFileSync(testFile, content);

			const result = await extractFrontMatter(testFile);
			expect(result.title).toBe('Accessibility Best Practices');
			expect(result.description).toBe('Guidelines for creating accessible software');

			fs.unlinkSync(testFile);
		});

		it('should extract only title when description is missing', async () => {
			const testFile = path.join(testFilesDir, 'test-title-only.md');
			const content = `---
title: "Title Only"
tags: ["test"]
---
Content here.`;
			fs.writeFileSync(testFile, content);

			const result = await extractFrontMatter(testFile);
			expect(result.title).toBe('Title Only');
			expect(result.description).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should extract only description when title is missing', async () => {
			const testFile = path.join(testFilesDir, 'test-description-only.md');
			const content = `---
description: "Description without title"
author: "Test Author"
---
Content here.`;
			fs.writeFileSync(testFile, content);

			const result = await extractFrontMatter(testFile);
			expect(result.title).toBeNull();
			expect(result.description).toBe('Description without title');

			fs.unlinkSync(testFile);
		});

		it('should return nulls for files without front matter', async () => {
			const testFile = path.join(testFilesDir, 'test-no-fm.md');
			const content = `# Regular Markdown\n\nNo front matter here.`;
			fs.writeFileSync(testFile, content);

			const result = await extractFrontMatter(testFile);
			expect(result.title).toBeNull();
			expect(result.description).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should handle non-markdown files by returning nulls', async () => {
			const testFile = path.join(testFilesDir, 'test.txt');
			const content = `---
title: "Should Not Parse"
description: "This is a text file"
---
Text content.`;
			fs.writeFileSync(testFile, content);

			const result = await extractFrontMatter(testFile);
			expect(result.title).toBeNull();
			expect(result.description).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should trim whitespace from title and description', async () => {
			const testFile = path.join(testFilesDir, 'test-whitespace-fm.md');
			const content = `---
title: "  Whitespace Title  "
description: "  Whitespace Description  "
---
Content.`;
			fs.writeFileSync(testFile, content);

			const result = await extractFrontMatter(testFile);
			expect(result.title).toBe('Whitespace Title');
			expect(result.description).toBe('Whitespace Description');

			fs.unlinkSync(testFile);
		});

		it('should handle empty or invalid file paths', async () => {
			const result1 = await extractFrontMatter('');
			const result2 = await extractFrontMatter(null as any);
			const result3 = await extractFrontMatter(undefined as any);

			expect(result1).toEqual({ title: null, description: null });
			expect(result2).toEqual({ title: null, description: null });
			expect(result3).toEqual({ title: null, description: null });
		});

		it('should handle non-existent files gracefully', async () => {
			const nonExistentFile = path.join(testFilesDir, 'does-not-exist.md');
			const result = await extractFrontMatter(nonExistentFile);
			expect(result).toEqual({ title: null, description: null });
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

			const title = await extractFrontMatterTitle(testFile);
			expect(title).toBe('Introduction to Accessibility');

			fs.unlinkSync(testFile);
		});

		it('should return null for files without front matter', async () => {
			const testFile = path.join(testFilesDir, 'test-no-frontmatter.md');
			const content = `# Regular Markdown

This is just regular markdown without front matter.`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(testFile);
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

			const title = await extractFrontMatterTitle(testFile);
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

			const title = await extractFrontMatterTitle(testFile);
			expect(title).toBeNull();

			fs.unlinkSync(testFile);
		});

		it('should handle empty or invalid file paths', async () => {
			expect(await extractFrontMatterTitle('')).toBeNull();
			expect(await extractFrontMatterTitle(null as any)).toBeNull();
			expect(await extractFrontMatterTitle(undefined as any)).toBeNull();
		});

		it('should handle non-existent files gracefully', async () => {
			const nonExistentFile = path.join(testFilesDir, 'does-not-exist.md');
			const title = await extractFrontMatterTitle(nonExistentFile);
			expect(title).toBeNull();
		});

		it('should trim whitespace from title', async () => {
			const testFile = path.join(testFilesDir, 'test-whitespace.md');
			const content = `---
title: "  Whitespace Title  "
---
# Content`;
			fs.writeFileSync(testFile, content);

			const title = await extractFrontMatterTitle(testFile);
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
		])('should remove $input extension correctly', ({ input, expected }: { input: string; expected: string }) => {
			expect(normalizeTitle(input)).toBe(expected);
		});

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
			{ input: 'index.md', expected: false, description: 'index file' },
			{ input: 'test.html', expected: false, description: 'regular file' },
			{ input: 'myreadme.txt', expected: false, description: 'contains readme' },
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
