import { type SearchDoc, buildSnippet, findRanges, lowerCaseOf, searchDocs, toPlainText } from './searchDocs';

const doc = (title: string, text: string, path = `${title.toLowerCase()}.md`): SearchDoc => ({
	uri: `file:///workspace-root/${path}`,
	title,
	path,
	text,
});

describe('searchDocs', () => {
	const docs = [
		doc('Setup', 'Install the scanner with npm. The scanner scans.'),
		doc('Scanner', 'How discovery works.'),
		doc('Renderer', 'Draws pages. Mentions scanner once.'),
		doc('Unrelated', 'Nothing to see.', 'misc/scanner-notes.md'),
	];

	test.each([
		{ description: 'a blank query', query: '   ', expected: [] },
		{ description: 'no match', query: 'zebra', expected: [] },
		{
			description: 'a title hit before body hits',
			query: 'scanner',
			expected: ['Scanner', 'Unrelated', 'Setup', 'Renderer'],
		},
		{ description: 'any case', query: 'SCANNER', expected: ['Scanner', 'Unrelated', 'Setup', 'Renderer'] },
		{ description: 'every term', query: 'scanner npm', expected: ['Setup'] },
		{ description: 'a path hit', query: 'misc', expected: ['Unrelated'] },
	])('ranks $description', ({ query, expected }) => {
		expect(searchDocs(docs, query).map((result) => result.title)).toEqual(expected);
	});

	it('uses the lowercased fields a document carries', () => {
		const plain = doc('Setup', 'Install the scanner.');
		const withLower = { ...plain, lower: lowerCaseOf(plain) };

		expect(searchDocs([withLower], 'SCANNER')).toEqual(searchDocs([plain], 'SCANNER'));
	});

	it('returns at most the limit', () => {
		expect(searchDocs(docs, 'scanner', 2)).toHaveLength(2);
	});

	it('marks every term in the snippet', () => {
		const [result] = searchDocs([doc('Setup', 'Install the scanner with npm.')], 'scanner npm');

		expect(result.snippet).toBe('Install the scanner with npm.');
		expect(result.ranges.map(([start, end]) => result.snippet.slice(start, end))).toEqual(['scanner', 'npm']);
	});
});

describe('lowerCaseOf', () => {
	it('lowercases the title, path, and text', () => {
		expect(lowerCaseOf(doc('Setup', 'Use NPM.', 'Docs/Setup.md'))).toEqual({
			title: 'setup',
			path: 'docs/setup.md',
			text: 'use npm.',
		});
	});
});

describe('buildSnippet', () => {
	it('starts on a word boundary near a late match and marks the cuts', () => {
		// The 60-character lead before `target` falls inside a word: `ab` shifts every word by two.
		const text = `ab${'lorem ipsum '.repeat(20)}target ${'tail '.repeat(80)}`;

		const snippet = buildSnippet(text, ['target']);

		expect(snippet.startsWith('…ipsum ')).toBe(true);
		expect(snippet.endsWith('…')).toBe(true);
		expect(snippet).toContain('target');
	});

	it('searches the lowercased text it is given', () => {
		expect(buildSnippet('Find ME here', ['me'], 'find me here')).toBe('Find ME here');
	});

	it('opens at the start of the text when no term occurs in it', () => {
		expect(buildSnippet('Short text.', ['title-only'])).toBe('Short text.');
	});

	it('collapses whitespace', () => {
		expect(buildSnippet('a\n\n\tb', ['b'])).toBe('a b');
	});
});

describe('findRanges', () => {
	test.each([
		{
			description: 'separate terms',
			text: 'one two one',
			terms: ['one'],
			expected: [
				[0, 3],
				[8, 11],
			],
		},
		{ description: 'overlapping terms merged', text: 'scanner', terms: ['scan', 'canner'], expected: [[0, 7]] },
		{ description: 'no match', text: 'abc', terms: ['z'], expected: [] },
	])('finds $description', ({ text, terms, expected }) => {
		expect(findRanges(text, terms)).toEqual(expected);
	});
});

describe('toPlainText', () => {
	test.each([
		{ description: 'heading marks', input: '## Title', expected: 'Title' },
		{ description: 'link targets', input: 'see [the guide](guide.md)', expected: 'see the guide' },
		{ description: 'images', input: '![alt text](a.png)', expected: 'alt text' },
		{ description: 'emphasis and code marks', input: '**bold** `code` _it_', expected: 'bold code it' },
		{ description: 'tags and comments', input: '<p>Hi<!-- note --></p>', expected: ' Hi  ' },
		{ description: 'script bodies', input: 'a<script>evil()</script>b', expected: 'a b' },
	])('removes $description', ({ input, expected }) => {
		expect(toPlainText(input)).toBe(expected);
	});
});
