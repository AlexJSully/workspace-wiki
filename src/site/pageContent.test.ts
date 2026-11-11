import { createMockUri } from '../test/mocks';
import { MAX_RENDER_BYTES, classifyFile, loadPageContent, looksBinary } from './pageContent';

describe('classifyFile', () => {
	test.each([
		{ name: 'guide.md', expected: 'markdown' },
		{ name: 'GUIDE.MARKDOWN', expected: 'markdown' },
		{ name: 'page.mdx', expected: 'markdown' },
		{ name: 'report.qmd', expected: 'markdown' },
		{ name: 'analysis.Rmd', expected: 'markdown' },
		{ name: 'README', expected: 'markdown' },
		{ name: '/docs.v2/readme', expected: 'markdown' },
		{ name: 'index.html', expected: 'html' },
		{ name: 'old.htm', expected: 'html' },
		{ name: 'logo.svg', expected: 'image' },
		{ name: 'photo.JPG', expected: 'image' },
		{ name: 'manual.pdf', expected: 'pdf' },
		{ name: 'MANUAL.PDF', expected: 'pdf' },
		{ name: 'sheet.xlsx', expected: 'binary' },
		{ name: 'doc.go', expected: 'code' },
		{ name: 'notes.txt', expected: 'code' },
		{ name: 'Makefile', expected: 'code' },
		{ name: 'notebook.ipynb', expected: 'code' },
	])('classifies $name as $expected', ({ name, expected }) => {
		expect(classifyFile(name)).toBe(expected);
	});
});

describe('looksBinary', () => {
	test.each([
		{ description: 'plain text', bytes: new TextEncoder().encode('hello'), expected: false },
		{ description: 'empty', bytes: new Uint8Array(0), expected: false },
		{ description: 'a NUL in the first bytes', bytes: new Uint8Array([104, 0, 105]), expected: true },
		{
			description: 'a NUL only past the sniffed window',
			bytes: Uint8Array.from({ length: 8001 }, (_, i) => (i === 8000 ? 0 : 97)),
			expected: false,
		},
	])('reports $expected for $description', ({ bytes, expected }) => {
		expect(looksBinary(bytes)).toBe(expected);
	});
});

describe('loadPageContent', () => {
	/** A reader serving one file's bytes, counting reads. */
	function reader(bytes: Uint8Array) {
		const readFile = jest.fn(async () => bytes);
		return readFile;
	}

	it('strips front matter from Markdown', async () => {
		const readFile = reader(new TextEncoder().encode('---\ntitle: Guide\n---\n# Guide\n'));

		const page = await loadPageContent(createMockUri('/workspace-root/guide.md'), readFile);

		expect(page).toEqual({ kind: 'markdown', content: '# Guide\n' });
	});

	it('keeps HTML whole', async () => {
		const readFile = reader(new TextEncoder().encode('<h1>API</h1>'));

		const page = await loadPageContent(createMockUri('/workspace-root/api.html'), readFile);

		expect(page).toEqual({ kind: 'html', content: '<h1>API</h1>' });
	});

	test.each([
		{ path: '/workspace-root/doc.go', language: 'go' },
		{ path: '/workspace-root/Makefile', language: 'makefile' },
	])('gives code from $path the language hint $language', async ({ path, language }) => {
		const page = await loadPageContent(createMockUri(path), reader(new TextEncoder().encode('x')));

		expect(page).toEqual({ kind: 'code', content: 'x', language });
	});

	test.each([
		{ path: '/workspace-root/logo.png' },
		{ path: '/workspace-root/manual.pdf' },
		{ path: '/workspace-root/sheet.xlsx' },
	])('does not read $path', async ({ path }) => {
		const readFile = reader(new Uint8Array([0]));

		await loadPageContent(createMockUri(path), readFile);

		expect(readFile).not.toHaveBeenCalled();
	});

	it('reports a text-named file holding binary bytes as binary', async () => {
		const page = await loadPageContent(
			createMockUri('/workspace-root/data.txt'),
			reader(new Uint8Array([1, 0, 2])),
		);

		expect(page).toEqual({ kind: 'binary' });
	});

	it('cuts a file larger than the render limit and says so', async () => {
		const bytes = new Uint8Array(MAX_RENDER_BYTES + 10).fill(97);

		const page = await loadPageContent(createMockUri('/workspace-root/big.txt'), reader(bytes));

		expect(page.truncated).toBe(true);
		expect(page.content).toHaveLength(MAX_RENDER_BYTES);
	});

	it('passes a read failure to the caller', async () => {
		const readFile = jest.fn(async () => {
			throw new Error('gone');
		});

		await expect(loadPageContent(createMockUri('/workspace-root/a.md'), readFile)).rejects.toThrow('gone');
	});
});
