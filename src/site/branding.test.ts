import { createMockUri, createMockWorkspace } from '../test/mocks';
import { canBeTabIcon, findSiteBranding, rankLogoCandidates } from './branding';

describe('rankLogoCandidates', () => {
	const workspace = createMockWorkspace();
	const rank = (paths: string[], formats?: string[]) =>
		rankLogoCandidates(
			paths.map((path) => createMockUri(`/workspace-root/${path}`)),
			workspace,
			formats,
		).map((uri) => uri.path.replace('/workspace-root/', ''));

	test.each([
		{
			description: 'favicon before logo before icon',
			paths: ['icon.svg', 'logo.svg', 'favicon.svg'],
			expected: ['favicon.svg', 'logo.svg', 'icon.svg'],
		},
		{
			description: 'SVG before PNG before ICO',
			paths: ['logo.ico', 'logo.png', 'logo.svg'],
			expected: ['logo.svg', 'logo.png', 'logo.ico'],
		},
		{
			description: 'the exact name before a sized one',
			paths: ['public/favicon-32x32.png', 'public/favicon.ico'],
			expected: ['public/favicon.ico', 'public/favicon-32x32.png'],
		},
		{
			description: 'suffixed names as candidates',
			paths: ['apple-touch-icon-120x120.png', 'logo@2x.png', 'icon_dark.svg'],
			expected: ['logo@2x.png', 'icon_dark.svg', 'apple-touch-icon-120x120.png'],
		},
		{
			description: 'shallower first',
			paths: ['a/b/logo.svg', 'media/logo.svg'],
			expected: ['media/logo.svg', 'a/b/logo.svg'],
		},
		{ description: 'names case-insensitively', paths: ['Media/Logo.SVG'], expected: ['Media/Logo.SVG'] },
		{ description: 'too deep dropped', paths: ['a/b/c/d/logo.svg'], expected: [] },
		{ description: 'other names dropped', paths: ['banner.svg', 'logos.svg', 'iconography.png'], expected: [] },
		{
			description: 'dot-folders dropped, except .github',
			paths: ['.next/server/favicon.ico', '.github/logo.png'],
			expected: ['.github/logo.png'],
		},
	])('orders $description', ({ paths, expected }) => {
		expect(rank(paths)).toEqual(expected);
	});

	it('keeps only the formats asked for', () => {
		expect(rank(['favicon.ico', 'favicon-16x16.png'], ['svg', 'png'])).toEqual(['favicon-16x16.png']);
	});
});

describe('canBeTabIcon', () => {
	test.each([
		{ uri: '/workspace-root/logo.svg', expected: true },
		{ uri: '/workspace-root/LOGO.PNG', expected: true },
		{ uri: '/workspace-root/favicon.ico', expected: false },
		{ uri: 'vscode-vfs://github/owner/repo/logo.svg', expected: false },
	])('accepts $uri: $expected', ({ uri, expected }) => {
		expect(canBeTabIcon(createMockUri(uri))).toBe(expected);
	});
});

describe('findSiteBranding', () => {
	it('uses a configured PNG for both the header and the tab', async () => {
		const workspace = createMockWorkspace(
			{},
			{
				contents: { 'file:///workspace-root/brand/mark.png': 'png' },
				files: () => [createMockUri('/workspace-root/favicon.svg')],
			},
		);

		const branding = await findSiteBranding(workspace, './brand/mark.png');

		expect(branding.logo?.path).toBe('/workspace-root/brand/mark.png');
		expect(branding.tabIcon?.path).toBe('/workspace-root/brand/mark.png');
	});

	it('keeps a configured ICO for the header and searches for a tab icon', async () => {
		const workspace = createMockWorkspace(
			{},
			{
				contents: { 'file:///workspace-root/brand/mark.ico': 'ico' },
				files: () => [createMockUri('/workspace-root/media/icon.png')],
			},
		);

		const branding = await findSiteBranding(workspace, 'brand/mark.ico');

		expect(branding.logo?.path).toBe('/workspace-root/brand/mark.ico');
		expect(branding.tabIcon?.path).toBe('/workspace-root/media/icon.png');
	});

	it('falls back to the search when the configured logo is missing', async () => {
		const workspace = createMockWorkspace({}, { files: () => [createMockUri('/workspace-root/media/icon.svg')] });

		const branding = await findSiteBranding(workspace, 'missing.png');

		expect(branding.logo?.path).toBe('/workspace-root/media/icon.svg');
		expect(branding.tabIcon?.path).toBe('/workspace-root/media/icon.svg');
	});

	it('puts an ICO favicon in the header and a PNG one on the tab', async () => {
		const workspace = createMockWorkspace(
			{},
			{
				files: () =>
					['public/icon/favicon.ico', 'public/icon/favicon-16x16.png', '.next/server/app/favicon.ico'].map(
						(path) => createMockUri(`/workspace-root/${path}`),
					),
			},
		);

		const branding = await findSiteBranding(workspace, '');

		expect(branding.logo?.path).toBe('/workspace-root/public/icon/favicon.ico');
		expect(branding.tabIcon?.path).toBe('/workspace-root/public/icon/favicon-16x16.png');
	});

	it('leaves the tab icon empty when only an ICO exists', async () => {
		const workspace = createMockWorkspace({}, { files: () => [createMockUri('/workspace-root/favicon.ico')] });

		const branding = await findSiteBranding(workspace, '');

		expect(branding.logo?.path).toBe('/workspace-root/favicon.ico');
		expect(branding.tabIcon).toBeUndefined();
	});

	it('searches exact and suffixed favicon and logo names separately, excluding build output and excludeGlobs', async () => {
		const findFiles = jest.fn(async () => [createMockUri('/workspace-root/public/favicon.ico')]);
		const workspace = { ...createMockWorkspace({ excludeGlobs: ['**/vendor/**'] }), findFiles };

		await findSiteBranding(workspace, '');

		const calls = findFiles.mock.calls as unknown as [string, string, number][];
		expect(calls.map(([pattern, , maxResults]) => [pattern, maxResults])).toEqual([
			['**/{favicon,logo,icon,apple-touch-icon}.{svg,png,ico,webp,jpg,jpeg,gif}', 50],
			['**/{favicon,logo,icon,apple-touch-icon}[-_.@]*.{svg,png,ico,webp,jpg,jpeg,gif}', 200],
		]);
		for (const [, exclude] of calls) {
			expect(exclude).toContain('**/node_modules/**');
			expect(exclude).toContain('**/.vscode-test*/**');
			expect(exclude).toContain('**/vendor/**');
		}
	});

	it('finds the exact favicon when more suffixed icons exist than a search returns', async () => {
		const favicon = createMockUri('/workspace-root/favicon.svg');
		// 300 suffixed icons that a search would list before the favicon.
		const suffixed = Array.from({ length: 300 }, (_, i) => createMockUri(`/workspace-root/a/icon-${i}.png`));
		// Lists what a pattern matches in that order and truncates to the limit, as `findFiles` may.
		const findFiles = jest.fn(async (pattern: unknown, _exclude?: unknown, maxResults?: number) => {
			const glob = String(pattern);
			const suffixedOnly = glob.includes('[-_.@]');
			// `{names}*` matches the exact and the suffixed names together.
			const both = glob.includes('}*');
			const matches = suffixedOnly ? suffixed : both ? [...suffixed, favicon] : [favicon];
			return matches.slice(0, maxResults);
		});
		const workspace = { ...createMockWorkspace(), findFiles };

		const branding = await findSiteBranding(workspace, '');

		expect(branding.logo?.path).toBe('/workspace-root/favicon.svg');
	});

	test.each([{ configured: '../outside/logo.svg' }, { configured: '/../../etc/logo.svg' }])(
		'ignores a configured logo outside the workspace folder: $configured',
		async ({ configured }) => {
			const workspace = createMockWorkspace({}, { contents: {}, files: () => [] });
			const readFile = jest.spyOn(workspace.fs, 'readFile');

			const branding = await findSiteBranding(workspace, configured);

			expect(readFile).not.toHaveBeenCalled();
			expect(branding).toEqual({ logo: undefined, tabIcon: undefined });
		},
	);

	it('finds nothing in a workspace without a logo', async () => {
		const workspace = createMockWorkspace({}, { files: () => [] });

		expect(await findSiteBranding(workspace, '')).toEqual({ logo: undefined, tabIcon: undefined });
	});
});
