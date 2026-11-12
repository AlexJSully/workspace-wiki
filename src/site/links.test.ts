import type { TreeNode } from '@types';
import { createMockUri } from '../test/mocks';
import { containingFolder, resolveDocLink } from './links';

const fileNode = (uri: string, extra: Partial<TreeNode> = {}): TreeNode => {
	const parsed = createMockUri(uri);
	const name = parsed.path.split('/').pop() ?? '';
	return { type: 'file', name, title: name, path: name, uri: parsed, ...extra };
};

describe('resolveDocLink', () => {
	const docs = new Map<string, TreeNode>(
		[
			fileNode('/workspace-root/README.md', { isReadme: true }),
			fileNode('/workspace-root/docs/guide.md'),
			fileNode('/workspace-root/docs/my file.md'),
			fileNode('/workspace-root/docs/api/index.md', { isIndex: true }),
			fileNode('/workspace-root/docs/both/index.md', { isIndex: true }),
			fileNode('/workspace-root/docs/both/README.md', { isReadme: true }),
		].map((node) => [node.uri.toString(), node]),
	);
	const folders = [{ uri: createMockUri('/workspace-root') }];
	const from = createMockUri('/workspace-root/docs/guide.md');

	test.each([
		{ description: 'a sibling', href: 'my%20file.md', expected: '/workspace-root/docs/my file.md' },
		{ description: 'a parent', href: '../README.md', expected: '/workspace-root/README.md' },
		{ description: 'a dot-relative path', href: './guide.md', expected: '/workspace-root/docs/guide.md' },
		{ description: 'a root-relative path', href: '/README.md', expected: '/workspace-root/README.md' },
		{ description: 'a folder with an index', href: 'api/', expected: '/workspace-root/docs/api/index.md' },
		{ description: 'a folder without a slash', href: 'api', expected: '/workspace-root/docs/api/index.md' },
		{
			description: 'a folder preferring its README',
			href: 'both',
			expected: '/workspace-root/docs/both/README.md',
		},
		{ description: 'a query string', href: 'guide.md?plain=1', expected: '/workspace-root/docs/guide.md' },
	])('resolves $description to a wiki page', ({ href, expected }) => {
		const target = resolveDocLink(href, from, docs, folders);

		expect(target.kind).toBe('doc');
		expect(target.kind === 'doc' && target.node.uri.path).toBe(expected);
	});

	it('keeps the fragment of a page link', () => {
		const target = resolveDocLink('../README.md#getting%20started', from, docs, folders);

		expect(target).toMatchObject({ kind: 'doc', fragment: 'getting started' });
	});

	test.each([
		{ href: 'https://example.com', expected: { kind: 'external', url: 'https://example.com' } },
		{ href: 'mailto:team@example.com', expected: { kind: 'external', url: 'mailto:team@example.com' } },
		{ href: '#install', expected: { kind: 'anchor', fragment: 'install' } },
	])('classifies $href', ({ href, expected }) => {
		expect(resolveDocLink(href, from, docs, folders)).toEqual(expected);
	});

	it('resolves a link to a workspace file outside the wiki as a file', () => {
		const target = resolveDocLink('../src/index.ts', from, docs, folders);

		expect(target.kind).toBe('file');
		expect(target.kind === 'file' && target.uri.path).toBe('/workspace-root/src/index.ts');
	});

	it('keeps the scheme and authority of a virtual workspace', () => {
		const vfsDoc = fileNode('vscode-vfs://github/owner/repo/docs/b.md');
		const vfsDocs = new Map([[vfsDoc.uri.toString(), vfsDoc]]);
		const vfsFrom = createMockUri('vscode-vfs://github/owner/repo/docs/a.md');

		const target = resolveDocLink('b.md', vfsFrom, vfsDocs, [
			{ uri: createMockUri('vscode-vfs://github/owner/repo') },
		]);

		expect(target.kind === 'doc' && target.node.uri.toString()).toBe('vscode-vfs://github/owner/repo/docs/b.md');
	});

	it('resolves an absolute workspace URI written as a link', () => {
		const target = resolveDocLink('file:///workspace-root/README.md#top', from, docs, folders);

		expect(target).toMatchObject({ kind: 'doc', fragment: 'top' });
	});

	test.each([
		{ description: 'a relative path', href: '../../../etc/hosts', expected: '/etc/hosts' },
		{ description: 'a root-relative path', href: '/../etc/hosts', expected: '/etc/hosts' },
		{ description: 'an absolute URI', href: 'file:///workspace-root/docs/../../etc/hosts', expected: '/etc/hosts' },
	])('resolves the dot segments of $description that climbs out of the workspace', ({ href, expected }) => {
		const target = resolveDocLink(href, from, docs, folders);

		expect(target.kind === 'file' && target.uri.path).toBe(expected);
		expect(target.kind === 'file' && containingFolder(target.uri, folders)).toBeUndefined();
	});

	it('resolves the dot segments of an absolute URI to a wiki page', () => {
		const target = resolveDocLink('file:///workspace-root/docs/api/../guide.md', from, docs, folders);

		expect(target.kind === 'doc' && target.node.uri.path).toBe('/workspace-root/docs/guide.md');
	});

	it('leaves malformed percent-encoding as written', () => {
		const target = resolveDocLink('bad%zz.md', from, docs, folders);

		expect(target.kind === 'file' && target.uri.path).toBe('/workspace-root/docs/bad%zz.md');
	});
});

describe('containingFolder', () => {
	it('picks the deepest workspace folder holding a URI', () => {
		const folders = [{ uri: createMockUri('/root') }, { uri: createMockUri('/root/nested') }];

		expect(containingFolder(createMockUri('/root/nested/a.md'), folders)?.path).toBe('/root/nested');
		expect(containingFolder(createMockUri('/root/a.md'), folders)?.path).toBe('/root');
		expect(containingFolder(createMockUri('/rootless/a.md'), folders)).toBeUndefined();
	});
});
