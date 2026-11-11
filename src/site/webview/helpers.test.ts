import type { SiteNode } from '@site/protocol';
import {
	RouteHistory,
	classifyHref,
	createSlugger,
	findAncestors,
	findHomePage,
	flattenFiles,
	languageFor,
	rebaseResource,
	sameRoute,
	slugify,
	splitByRanges,
	suggestPages,
} from './helpers';

const file = (path: string, title: string, extra: Partial<SiteNode> = {}): SiteNode => ({
	type: 'file',
	name: path.split('/').pop() ?? path,
	title,
	path,
	uri: `file:///root/${path}`,
	...extra,
});

const tree: SiteNode[] = [
	file('README.md', 'README', { isReadme: true }),
	{
		type: 'folder',
		name: 'docs',
		title: 'Docs',
		path: 'docs',
		uri: 'file:///root/docs',
		children: [file('docs/setup.md', 'Setup'), file('docs/api-reference.md', 'API Reference')],
	},
];

describe('classifyHref', () => {
	test.each([
		{ href: '#install', expected: 'anchor' },
		{ href: 'https://example.com', expected: 'external' },
		{ href: 'HTTP://EXAMPLE.COM', expected: 'external' },
		{ href: 'mailto:a@b.c', expected: 'external' },
		{ href: 'guide.md', expected: 'internal' },
		{ href: '../a/b.md#x', expected: 'internal' },
		{ href: 'file:///root/a.md', expected: 'internal' },
		{ href: 'javascript:alert(1)', expected: 'blocked' },
		{ href: ' JavaScript:alert(1)', expected: 'blocked' },
		{ href: 'data:text/html,x', expected: 'blocked' },
		{ href: 'command:workbench.action.quit', expected: 'blocked' },
		{ href: '', expected: 'blocked' },
		{ href: null, expected: 'blocked' },
	])('classifies $href as $expected', ({ href, expected }) => {
		expect(classifyHref(href)).toBe(expected);
	});
});

describe('slugify', () => {
	test.each([
		{ text: 'Getting Started', expected: 'getting-started' },
		{ text: 'What is a `webhook`?', expected: 'what-is-a-webhook' },
		{ text: 'Café & crème', expected: 'café--crème' },
		{ text: 'snake_case-and-kebab', expected: 'snake_case-and-kebab' },
		{ text: '!!!', expected: 'section' },
	])('slugs "$text" as GitHub does', ({ text, expected }) => {
		expect(slugify(text)).toBe(expected);
	});

	it('suffixes repeated headings', () => {
		const slug = createSlugger();

		expect(['Usage', 'Usage', 'Usage', 'Other'].map(slug)).toEqual(['usage', 'usage-1', 'usage-2', 'other']);
	});
});

describe('rebaseResource', () => {
	// As `asWebviewUri(...).toString()` encodes them. The URL parser normalizes the host to `file+`,
	// the name the browser requests either way.
	const base = 'https://file%2B.vscode-resource.vscode-cdn.net/root/docs';
	const root = 'https://file%2B.vscode-resource.vscode-cdn.net/root';
	const resolvedBase = 'https://file+.vscode-resource.vscode-cdn.net/root/docs';
	const resolvedRoot = 'https://file+.vscode-resource.vscode-cdn.net/root';

	test.each([
		{ src: 'images/a.png', expected: `${resolvedBase}/images/a.png` },
		{ src: './a.png', expected: `${resolvedBase}/a.png` },
		{ src: '../media/a.png', expected: `${resolvedRoot}/media/a.png` },
		{ src: '/media/a.png', expected: `${resolvedRoot}/media/a.png` },
		{ src: 'my image.png', expected: `${resolvedBase}/my%20image.png` },
		{ src: 'https://img.shields.io/badge.svg', expected: 'https://img.shields.io/badge.svg' },
		{ src: 'data:image/png;base64,AAAA', expected: 'data:image/png;base64,AAAA' },
		{ src: '//cdn.example.com/a.png', expected: '//cdn.example.com/a.png' },
		{ src: '', expected: '' },
	])('resolves $src', ({ src, expected }) => {
		expect(rebaseResource(src, base, root)).toBe(expected);
	});
});

describe('tree helpers', () => {
	it('lists files depth first', () => {
		expect(flattenFiles(tree).map((node) => node.title)).toEqual(['README', 'Setup', 'API Reference']);
	});

	test.each([
		{ uri: 'file:///root/docs/setup.md', expected: ['Docs', 'Setup'] },
		{ uri: 'file:///root/README.md', expected: ['README'] },
		{ uri: 'file:///root/missing.md', expected: [] },
	])('finds the ancestors of $uri', ({ uri, expected }) => {
		expect(findAncestors(tree, uri).map((node) => node.title)).toEqual(expected);
	});

	it('takes a top-level README as the home page', () => {
		expect(findHomePage(tree)?.title).toBe('README');
		expect(findHomePage(tree.slice(1))).toBeUndefined();
	});
});

describe('suggestPages', () => {
	const files = flattenFiles(tree);

	test.each([
		{ query: '', expected: [] },
		{ query: 'set', expected: ['Setup'] },
		{ query: 'REF', expected: ['API Reference'] },
		{ query: 'docs/', expected: ['API Reference', 'Setup'] },
		{ query: 'e', expected: ['API Reference', 'README', 'Setup'] },
	])('suggests for "$query"', ({ query, expected }) => {
		expect(suggestPages(files, query).map((node) => node.title)).toEqual(expected);
	});

	it('returns at most the limit', () => {
		expect(suggestPages(files, 'e', 1)).toHaveLength(1);
	});
});

describe('splitByRanges', () => {
	test.each([
		{ text: 'abcdef', ranges: [], expected: [{ text: 'abcdef', mark: false }] },
		{
			text: 'abcdef',
			ranges: [[1, 3]] as [number, number][],
			expected: [
				{ text: 'a', mark: false },
				{ text: 'bc', mark: true },
				{ text: 'def', mark: false },
			],
		},
		{
			text: 'abc',
			ranges: [
				[0, 1],
				[0, 2],
				[2, 9],
			] as [number, number][],
			expected: [
				{ text: 'a', mark: true },
				{ text: 'b', mark: true },
				{ text: 'c', mark: true },
			],
		},
	])('splits $text by $ranges', ({ text, ranges, expected }) => {
		expect(splitByRanges(text, ranges)).toEqual(expected);
	});
});

describe('languageFor', () => {
	test.each([
		{ hint: 'go', expected: 'go' },
		{ hint: 'MJS', expected: 'javascript' },
		{ hint: 'txt', expected: 'plaintext' },
		{ hint: 'ipynb', expected: 'json' },
		{ hint: '', expected: 'plaintext' },
		{ hint: undefined, expected: 'plaintext' },
	])('maps $hint to $expected', ({ hint, expected }) => {
		expect(languageFor(hint)).toBe(expected);
	});
});

describe('RouteHistory', () => {
	const a = { kind: 'page' as const, uri: 'a' };
	const b = { kind: 'page' as const, uri: 'b' };
	const search = { kind: 'search' as const, query: 'x' };

	it('goes back and forward, and drops the forward entries on a new visit', () => {
		const history = new RouteHistory();
		history.push(a);
		history.push(b);

		expect(history.back()).toEqual(a);
		expect(history.canGoForward).toBe(true);
		history.push(search);
		expect(history.canGoForward).toBe(false);
		expect(history.back()).toEqual(a);
		expect(history.back()).toBeUndefined();
	});

	it('replaces rather than repeats the route already showing', () => {
		const history = new RouteHistory();
		history.push(a);
		history.push({ ...a, fragment: 'usage' });

		expect(history.canGoBack).toBe(false);
		expect(history.current).toEqual({ ...a, fragment: 'usage' });
	});

	it('survives a round trip through saved state, keeping the fifty most recent routes', () => {
		const history = new RouteHistory();
		for (let i = 0; i < 60; i++) {
			history.push({ kind: 'page', uri: String(i) });
		}

		const restored = RouteHistory.fromJSON(JSON.parse(JSON.stringify(history.toJSON())));

		expect(restored.current).toEqual({ kind: 'page', uri: '59' });
		let steps = 0;
		while (restored.back()) {
			steps++;
		}
		expect(steps).toBe(49);
	});

	test.each([
		{ description: 'nothing', state: undefined },
		{ description: 'a string', state: 'x' },
		{ description: 'bad entries', state: { entries: [{ kind: 'page' }, { kind: 'nope' }], index: 0 } },
	])('starts empty from $description', ({ state }) => {
		expect(RouteHistory.fromJSON(state).current).toBeUndefined();
	});
});

describe('sameRoute', () => {
	test.each([
		{ a: { kind: 'home' as const }, b: { kind: 'home' as const }, expected: true },
		{
			a: { kind: 'page' as const, uri: 'x', fragment: '1' },
			b: { kind: 'page' as const, uri: 'x' },
			expected: true,
		},
		{ a: { kind: 'page' as const, uri: 'x' }, b: { kind: 'page' as const, uri: 'y' }, expected: false },
		{ a: { kind: 'search' as const, query: 'q' }, b: { kind: 'search' as const, query: 'q' }, expected: true },
		{ a: { kind: 'home' as const }, b: undefined, expected: false },
	])('compares $a with $b', ({ a, b, expected }) => {
		expect(sameRoute(a, b)).toBe(expected);
	});
});
