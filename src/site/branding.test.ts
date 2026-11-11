import { createMockUri, createMockWorkspace } from '../test/mocks';
import { findSiteBranding, rankLogoCandidates } from './branding';

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

	it('searches for favicons and logos, excluding build output and excludeGlobs', async () => {
		const findFiles = jest.fn(async () => [createMockUri('/workspace-root/public/favicon.ico')]);
		const workspace = { ...createMockWorkspace({ excludeGlobs: ['**/vendor/**'] }), findFiles };

		await findSiteBranding(workspace, '');

		const [pattern, exclude] = findFiles.mock.calls[0] as unknown as [string, string];
		expect(pattern).toBe('**/{favicon,logo,icon,apple-touch-icon}*.{svg,png,ico,webp,jpg,jpeg,gif}');
		expect(exclude).toContain('**/node_modules/**');
		expect(exclude).toContain('**/.vscode-test*/**');
		expect(exclude).toContain('**/vendor/**');
	});

	it('finds nothing in a workspace without a logo', async () => {
		const workspace = createMockWorkspace({}, { files: () => [] });

		expect(await findSiteBranding(workspace, '')).toEqual({ logo: undefined, tabIcon: undefined });
	});
});
