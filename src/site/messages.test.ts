import { createMockUri } from '../test/mocks';
import { parseSiteContext, parseViewMessage, toSiteNode } from './messages';

const GUIDE = 'file:///workspace-root/docs/guide.md';

describe('parseViewMessage', () => {
	test.each([
		{ raw: { type: 'ready' }, valid: true },
		{ raw: { type: 'navigate', uri: GUIDE }, valid: true },
		{ raw: { type: 'navigate', uri: GUIDE, fragment: 'usage' }, valid: true },
		{ raw: { type: 'navigate', uri: GUIDE, fragment: 3 }, valid: false },
		{ raw: { type: 'navigate' }, valid: false },
		{ raw: { type: 'title', title: 'x' }, valid: true },
		{ raw: { type: 'title', title: 1 }, valid: false },
		{ raw: { type: 'openLink', href: 'a.md', fromUri: GUIDE, newTab: false }, valid: true },
		{ raw: { type: 'openLink', href: 'a.md', fromUri: GUIDE }, valid: false },
		{ raw: { type: 'openLink', href: 'a.md', newTab: true }, valid: false },
		{ raw: { type: 'openExternal', url: 'https://x', integrated: true }, valid: true },
		{ raw: { type: 'openExternal', url: 'https://x', integrated: 'yes' }, valid: false },
		{ raw: { type: 'openOriginal', uri: GUIDE, mode: 'preview' }, valid: true },
		{ raw: { type: 'openOriginal', uri: GUIDE, mode: 'delete' }, valid: false },
		{ raw: { type: 'openInNewTab', uri: GUIDE }, valid: true },
		{ raw: { type: 'openInNewTab' }, valid: false },
		{ raw: { type: 'search', query: 'x' }, valid: true },
		{ raw: { type: 'search', query: null }, valid: false },
		{ raw: { type: 'runCommand', command: 'x' }, valid: false },
		{ raw: null, valid: false },
		{ raw: 'ready', valid: false },
	])('accepts $raw: $valid', ({ raw, valid }) => {
		expect(parseViewMessage(raw) !== undefined).toBe(valid);
	});

	it('returns only the fields the protocol defines', () => {
		expect(parseViewMessage({ type: 'openInNewTab', uri: GUIDE, extra: 'x' })).toEqual({
			type: 'openInNewTab',
			uri: GUIDE,
		});
	});
});

describe('parseSiteContext', () => {
	test.each([
		{
			description: 'a page',
			raw: { webviewSection: 'doc', uri: GUIDE, preventDefaultContextMenuItems: true },
			expected: { webviewSection: 'doc', uri: GUIDE },
		},
		{
			description: 'a link written in a page',
			raw: { webviewSection: 'doc', href: 'a.md', fromUri: GUIDE },
			expected: { webviewSection: 'doc', href: 'a.md', fromUri: GUIDE },
		},
		{
			description: 'fields of the wrong type',
			raw: { webviewSection: 'other', uri: 7, href: ['x'] },
			expected: {},
		},
	])('keeps the string fields of $description', ({ raw, expected }) => {
		expect(parseSiteContext(raw)).toEqual(expected);
	});

	test.each([{ raw: undefined }, { raw: null }, { raw: 'doc' }])('rejects $raw', ({ raw }) => {
		expect(parseSiteContext(raw)).toBeUndefined();
	});
});

describe('toSiteNode', () => {
	it('serializes URIs and keeps only the flags that are set', () => {
		const node = toSiteNode({
			type: 'folder',
			name: 'docs',
			title: 'Docs',
			path: 'docs',
			uri: createMockUri('/workspace-root/docs'),
			children: [
				{
					type: 'file',
					name: 'index.md',
					title: 'Index',
					path: 'docs/index.md',
					uri: createMockUri('/workspace-root/docs/index.md'),
					isIndex: true,
					isReadme: false,
					description: 'Start here',
				},
			],
		});

		expect(node).toStrictEqual({
			type: 'folder',
			name: 'docs',
			title: 'Docs',
			path: 'docs',
			uri: 'file:///workspace-root/docs',
			children: [
				{
					type: 'file',
					name: 'index.md',
					title: 'Index',
					path: 'docs/index.md',
					uri: 'file:///workspace-root/docs/index.md',
					isIndex: true,
					description: 'Start here',
				},
			],
		});
	});
});
