/**
 * Unit tests for text utilities
 */
import { getFileExtension, isIndexFile, isReadmeFile, normalizeTitle } from './textUtils';

describe('textUtils', () => {
	describe('normalizeTitle', () => {
		it('should handle empty or invalid input', () => {
			expect(normalizeTitle('')).toBe('');
			expect(normalizeTitle(null as any)).toBe('');
			expect(normalizeTitle(undefined as any)).toBe('');
			expect(normalizeTitle(123 as any)).toBe('');
		});

		it('should remove various file extensions correctly', () => {
			expect(normalizeTitle('test.md')).toBe('Test');
			expect(normalizeTitle('test.markdown')).toBe('Test');
			expect(normalizeTitle('test.txt')).toBe('Test');
			expect(normalizeTitle('test.html')).toBe('Test');
			expect(normalizeTitle('test.htm')).toBe('Test');
			expect(normalizeTitle('test.pdf')).toBe('Test');
			expect(normalizeTitle('test.css')).toBe('Test');
			expect(normalizeTitle('test.js')).toBe('Test');
			expect(normalizeTitle('test.ts')).toBe('Test');
			expect(normalizeTitle('test.json')).toBe('Test');
			expect(normalizeTitle('test.xml')).toBe('Test');
		});

		it('should handle README files specially', () => {
			expect(normalizeTitle('readme.md')).toBe('README');
			expect(normalizeTitle('README.txt')).toBe('README');
			expect(normalizeTitle('ReadMe.markdown')).toBe('README');
		});

		it('should convert camelCase to Title Case', () => {
			expect(normalizeTitle('gettingStarted.md')).toBe('Getting Started');
			expect(normalizeTitle('myAwesomeDocument.txt')).toBe('My Awesome Document');
			expect(normalizeTitle('testCamelCase.html')).toBe('Test Camel Case');
		});

		it('should convert kebab-case to Title Case', () => {
			expect(normalizeTitle('my-awesome-document.md')).toBe('My Awesome Document');
			expect(normalizeTitle('getting-started.txt')).toBe('Getting Started');
			expect(normalizeTitle('test-kebab-case.html')).toBe('Test Kebab Case');
		});

		it('should convert snake_case to Title Case', () => {
			expect(normalizeTitle('my_awesome_document.md')).toBe('My Awesome Document');
			expect(normalizeTitle('getting_started.txt')).toBe('Getting Started');
			expect(normalizeTitle('test_snake_case.html')).toBe('Test Snake Case');
		});

		it('should apply acronym casing when provided', () => {
			const acronyms = ['API', 'HTTP', 'JSON', 'XML'];
			expect(normalizeTitle('api-guide.md', acronyms)).toBe('API Guide');
			expect(normalizeTitle('http_requests.txt', acronyms)).toBe('HTTP Requests');
			expect(normalizeTitle('jsonDataFormat.html', acronyms)).toBe('JSON Data Format');
		});

		it('should handle mixed case acronyms correctly', () => {
			const acronyms = ['JavaScript', 'TypeScript', 'CSS', 'HTML'];
			expect(normalizeTitle('javascript-tutorial.md', acronyms)).toBe('JavaScript Tutorial');
			expect(normalizeTitle('typescript_guide.txt', acronyms)).toBe('TypeScript Guide');
			expect(normalizeTitle('cssStyleGuide.html', acronyms)).toBe('CSS Style Guide');
		});

		it('should work without acronyms parameter', () => {
			expect(normalizeTitle('test-document.md')).toBe('Test Document');
			expect(normalizeTitle('myTestFile.txt')).toBe('My Test File');
		});

		it('should preserve single words correctly', () => {
			expect(normalizeTitle('introduction.md')).toBe('Introduction');
			expect(normalizeTitle('overview.txt')).toBe('Overview');
		});

		it('should handle multiple file extensions', () => {
			expect(normalizeTitle('file.backup.md')).toBe('File.Backup');
			expect(normalizeTitle('test.min.js')).toBe('Test.Min');
		});
	});

	describe('getFileExtension', () => {
		it('should extract file extensions correctly', () => {
			expect(getFileExtension('test.md')).toBe('md');
			expect(getFileExtension('document.txt')).toBe('txt');
			expect(getFileExtension('style.css')).toBe('css');
			expect(getFileExtension('script.js')).toBe('js');
		});

		it('should handle files without extensions', () => {
			expect(getFileExtension('README')).toBe('');
			expect(getFileExtension('Makefile')).toBe('');
		});

		it('should handle multiple dots', () => {
			expect(getFileExtension('file.backup.md')).toBe('md');
			expect(getFileExtension('test.min.js')).toBe('js');
		});

		it('should handle empty or invalid input', () => {
			expect(getFileExtension('')).toBe('');
			expect(getFileExtension(null as any)).toBe('');
			expect(getFileExtension(undefined as any)).toBe('');
		});

		it('should return lowercase extensions', () => {
			expect(getFileExtension('TEST.MD')).toBe('md');
			expect(getFileExtension('Document.TXT')).toBe('txt');
		});
	});

	describe('isIndexFile', () => {
		it('should identify index files correctly', () => {
			expect(isIndexFile('index.md')).toBe(true);
			expect(isIndexFile('index.html')).toBe(true);
			expect(isIndexFile('index.txt')).toBe(true);
			expect(isIndexFile('Index.md')).toBe(true);
			expect(isIndexFile('INDEX.HTML')).toBe(true);
		});

		it('should reject non-index files', () => {
			expect(isIndexFile('readme.md')).toBe(false);
			expect(isIndexFile('test.html')).toBe(false);
			expect(isIndexFile('myindex.txt')).toBe(false);
		});

		it('should handle empty or invalid input', () => {
			expect(isIndexFile('')).toBe(false);
			expect(isIndexFile(null as any)).toBe(false);
			expect(isIndexFile(undefined as any)).toBe(false);
		});
	});

	describe('isReadmeFile', () => {
		it('should identify README files correctly', () => {
			expect(isReadmeFile('README.md')).toBe(true);
			expect(isReadmeFile('readme.txt')).toBe(true);
			expect(isReadmeFile('Readme.html')).toBe(true);
			expect(isReadmeFile('ReadMe.rst')).toBe(true);
		});

		it('should reject non-README files', () => {
			expect(isReadmeFile('index.md')).toBe(false);
			expect(isReadmeFile('test.html')).toBe(false);
			expect(isReadmeFile('myreadme.txt')).toBe(false);
		});

		it('should handle empty or invalid input', () => {
			expect(isReadmeFile('')).toBe(false);
			expect(isReadmeFile(null as any)).toBe(false);
			expect(isReadmeFile(undefined as any)).toBe(false);
		});
	});
});
