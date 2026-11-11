import type { HostToView } from '@site/protocol';
import { createMockUri, createMockWorkspace } from '../test/mocks';
import { WikiSiteManager, parseViewMessage, toSiteNode } from './sitePanel';

// Only the two open handlers are replaced, so a test can see which one a message reached.
jest.mock('../controllers/previewController', () => ({
	...jest.requireActual('../controllers/previewController'),
	openInEditor: jest.fn(),
	openInPreview: jest.fn(),
}));

const vscode = require('vscode');
const { openInEditor, openInPreview } = require('../controllers/previewController');

const EXTENSION = createMockUri('/extension');
const README = 'file:///workspace-root/README.md';
const GUIDE = 'file:///workspace-root/docs/guide.md';

/** Waits for the host to finish handling posted messages, which it does asynchronously. */
async function settle(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

/** Creates a manager over a two-page workspace, with optional settings. */
function createManager(config: Record<string, unknown> = {}, files: string[] = ['README.md', 'docs/guide.md']) {
	const contents: Record<string, string> = {
		[README]: '# Home\n\nSee [the guide](docs/guide.md).',
		[GUIDE]: '---\ntitle: Guide\n---\n# Guide\n\nUse the scanner.',
	};
	const uris = files.map((path) => createMockUri(`/workspace-root/${path}`));
	const workspace = createMockWorkspace(config as any, {
		contents,
		// Serves each `**/*.<ext>` search the files with that extension, as `findFiles` would.
		files: (pattern) =>
			pattern.includes('favicon')
				? []
				: uris.filter((uri) => pattern.startsWith('**/*.') && uri.path.endsWith(pattern.slice(4))),
	});
	const manager = new WikiSiteManager(EXTENSION, workspace);
	return { manager, workspace, contents };
}

/** The mock panel `createWebviewPanel` returned at an index. */
function panelAt(index = 0): any {
	return vscode.window.createWebviewPanel.mock.results[index].value;
}

/** Messages a panel was sent, of one type. */
function sent<T extends HostToView['type']>(panel: any, type: T): Extract<HostToView, { type: T }>[] {
	return panel.posted.filter((message: HostToView) => message.type === type);
}

beforeEach(() => {
	vscode.commands.getCommands.mockResolvedValue([]);
});

describe('WikiSiteManager.open', () => {
	it('opens a scripted webview limited to the bundle, the media folder, and the workspace', () => {
		const { manager } = createManager();

		manager.open();

		const [viewType, title, column, options] = vscode.window.createWebviewPanel.mock.calls[0];
		expect(viewType).toBe('workspaceWiki.site');
		expect(title).toBe('workspace-root');
		expect(column).toBe(vscode.ViewColumn.Active);
		expect(options.enableScripts).toBe(true);
		expect(options.localResourceRoots.map((uri: any) => uri.path)).toEqual([
			'/extension/dist/webview',
			'/extension/media',
			'/workspace-root',
		]);
	});

	it('writes a page whose only script carries the nonce its policy allows', () => {
		const { manager } = createManager();

		manager.open();

		const html: string = panelAt().webview.html;
		const nonce = /script-src 'nonce-([0-9a-f]{32})'/.exec(html)?.[1];
		expect(nonce).toBeDefined();
		expect(html).toContain("default-src 'none'");
		expect(html).toContain('connect-src vscode-webview://test');
		expect(html).toContain(
			'data-pdf-src="https://file%2B.vscode-resource.vscode-cdn.net/extension/dist/webview/pdf.js"',
		);
		const scripts = html.match(/<script[^>]*>/g) ?? [];
		expect(scripts).toEqual([expect.stringContaining(`nonce="${nonce}"`)]);
		expect(html).toContain('/extension/dist/webview/site.js');
		expect(html).toContain('/extension/dist/webview/site.css');
		expect(html).toContain(
			'data-mermaid-src="https://file%2B.vscode-resource.vscode-cdn.net/extension/dist/webview/mermaid.js"',
		);
	});

	it('reveals the open tab rather than opening another, unless asked for a new tab', () => {
		const { manager } = createManager();

		const first = manager.open();
		const again = manager.open();
		const second = manager.open(undefined, { newTab: true });

		expect(again).toBe(first);
		expect(second).not.toBe(first);
		expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
		expect(first.panel.reveal).toHaveBeenCalled();
	});

	it('moves an open tab to the page asked for', () => {
		const { manager } = createManager();
		manager.open();

		manager.open(createMockUri('/workspace-root/docs/guide.md'));

		expect(sent(panelAt(), 'goto')).toEqual([{ type: 'goto', uri: GUIDE, fragment: undefined }]);
	});

	it('forgets a tab once it is closed', () => {
		const { manager } = createManager();
		manager.open();

		panelAt().dispose();
		manager.open();

		expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
		expect(manager.openPanels).toHaveLength(1);
	});

	it('closes every tab when disposed', () => {
		const { manager } = createManager();
		manager.open();
		manager.open(undefined, { newTab: true });

		manager.dispose();

		expect(panelAt(0).dispose).toHaveBeenCalled();
		expect(panelAt(1).dispose).toHaveBeenCalled();
		expect(manager.openPanels).toHaveLength(0);
	});
});

describe('WikiSitePanel messages', () => {
	it('answers ready with the site and the tree, and the page it was opened on', async () => {
		const { manager } = createManager();
		manager.open(createMockUri('/workspace-root/docs/guide.md'));

		panelAt().receive({ type: 'ready' });
		await settle();

		const [init] = sent(panelAt(), 'init');
		expect(init.site).toEqual({ name: 'workspace-root', theme: 'vscode', customCss: [] });
		expect(init.route).toEqual({ kind: 'page', uri: GUIDE });
		expect(init.tree.map((node) => node.uri)).toEqual([README, 'file:///workspace-root/docs']);
		expect(init.tree[1].children?.[0]).toMatchObject({ uri: GUIDE, title: 'Guide' });
	});

	it('sends the opening route only once', async () => {
		const { manager } = createManager();
		manager.open(createMockUri('/workspace-root/docs/guide.md'));

		panelAt().receive({ type: 'ready' });
		await settle();
		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'init').map((init) => init.route)).toEqual([{ kind: 'page', uri: GUIDE }, undefined]);
	});

	test.each([
		{ description: 'a known theme', theme: 'paper', expected: 'paper' },
		{ description: 'an unknown theme', theme: 'neon', expected: 'vscode' },
		{ description: 'a non-string theme', theme: 7, expected: 'vscode' },
	])('applies $description', async ({ theme, expected }) => {
		const { manager } = createManager({ 'site.theme': theme });
		manager.open();

		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'init')[0].site.theme).toBe(expected);
	});

	it('turns custom stylesheet paths into webview URIs, skipping blanks', async () => {
		const { manager } = createManager({ 'site.customCss': ['./styles/wiki.css', '  ', 7, '/brand.css'] });
		manager.open();

		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'init')[0].site.customCss).toEqual([
			'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/styles/wiki.css',
			'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/brand.css',
		]);
	});

	it('sends a page with its text and the folders its images resolve against', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'navigate', uri: GUIDE, fragment: 'usage' });
		await settle();

		expect(sent(panelAt(), 'page')).toEqual([
			{
				type: 'page',
				fragment: 'usage',
				page: {
					uri: GUIDE,
					title: 'Guide',
					path: 'docs/guide.md',
					kind: 'markdown',
					content: '# Guide\n\nUse the scanner.',
					resourceBase: 'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/docs',
					rootBase: 'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root',
				},
			},
		]);
	});

	it('sends a PDF as a webview URI for the viewer to load, without reading it', async () => {
		const { manager, workspace } = createManager({ supportedExtensions: ['md', 'pdf'] }, [
			'README.md',
			'docs/manual.pdf',
		]);
		const readFile = jest.spyOn(workspace.fs, 'readFile');
		manager.open();

		panelAt().receive({ type: 'navigate', uri: 'file:///workspace-root/docs/manual.pdf' });
		await settle();

		expect(sent(panelAt(), 'page')[0].page).toMatchObject({
			kind: 'pdf',
			fileSrc: 'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/docs/manual.pdf',
		});
		expect(sent(panelAt(), 'page')[0].page.content).toBeUndefined();
		expect(readFile).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/workspace-root/docs/manual.pdf' }));
	});

	it('refuses a page outside the wiki without reading it', async () => {
		const { manager, workspace } = createManager();
		const readFile = jest.spyOn(workspace.fs, 'readFile');
		manager.open();

		panelAt().receive({ type: 'navigate', uri: 'file:///etc/passwd' });
		await settle();

		expect(sent(panelAt(), 'pageError')).toEqual([
			{ type: 'pageError', uri: 'file:///etc/passwd', message: 'This page is not part of the wiki.' },
		]);
		expect(readFile).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/etc/passwd' }));
	});

	it('reports a page it could not read', async () => {
		const { manager, contents } = createManager();
		delete contents[GUIDE];
		manager.open();

		panelAt().receive({ type: 'navigate', uri: GUIDE });
		await settle();

		expect(sent(panelAt(), 'pageError')[0].message).toMatch(/^Could not read this file: File not found/);
	});

	it('names the tab after the page shown', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'title', title: 'Guide' });
		panelAt().receive({ type: 'title', title: '  ' });
		await settle();

		expect(panelAt().title).toBe('workspace-root');
	});

	it('opens a page as its original file, in preview or the editor', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'openOriginal', uri: GUIDE, mode: 'preview' });
		panelAt().receive({ type: 'openOriginal', uri: GUIDE, mode: 'editor' });
		panelAt().receive({ type: 'openOriginal', uri: 'file:///elsewhere.md', mode: 'editor' });
		await settle();

		expect(openInPreview).toHaveBeenCalledWith(expect.objectContaining({ path: '/workspace-root/docs/guide.md' }));
		expect(openInEditor).toHaveBeenCalledTimes(1);
	});

	it('opens a page in a new tab on that page', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'openInNewTab', uri: GUIDE });
		await settle();
		panelAt(1).receive({ type: 'ready' });
		await settle();

		expect(manager.openPanels).toHaveLength(2);
		expect(sent(panelAt(1), 'init')[0].route).toEqual({ kind: 'page', uri: GUIDE });
	});

	it('follows a page link in the same tab, or a new one', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'openLink', href: 'docs/guide.md#usage', fromUri: README, newTab: false });
		panelAt().receive({ type: 'openLink', href: 'docs/guide.md', fromUri: README, newTab: true });
		await settle();

		expect(sent(panelAt(), 'goto')).toEqual([{ type: 'goto', uri: GUIDE, fragment: 'usage' }]);
		expect(manager.openPanels).toHaveLength(2);
	});

	it('opens a linked workspace file outside the wiki in its editor', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'openLink', href: 'src/index.ts', fromUri: README, newTab: false });
		await settle();

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			'vscode.open',
			expect.objectContaining({ path: '/workspace-root/src/index.ts' }),
		);
	});

	it('searches the wiki', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'search', query: 'scanner' });
		await settle();

		const [results] = sent(panelAt(), 'searchResults');
		expect(results.query).toBe('scanner');
		expect(results.results.map((result) => result.uri)).toEqual([GUIDE]);
	});

	it('ignores messages that do not match the protocol', async () => {
		const { manager } = createManager();
		manager.open();

		panelAt().receive({ type: 'navigate', uri: 42 });
		panelAt().receive('ready');
		await settle();

		expect(panelAt().posted).toEqual([]);
	});
});

describe('WikiSiteManager.openExternal', () => {
	it('opens a web link in the default browser', async () => {
		const { manager } = createManager();

		await manager.openExternal('https://example.com/docs', false);

		expect(vscode.env.openExternal).toHaveBeenCalledWith(expect.objectContaining({ authority: 'example.com' }));
	});

	it('opens a web link in a new integrated browser tab when VS Code has the integrated browser', async () => {
		vscode.commands.getCommands.mockResolvedValue(['simpleBrowser.api.open', 'workbench.action.browser.open']);
		const { manager } = createManager();

		await manager.openExternal('https://example.com/docs?q=1', true);

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.browser.open', {
			url: 'https://example.com/docs?q=1',
		});
		expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
			'simpleBrowser.api.open',
			expect.anything(),
			expect.anything(),
		);
		expect(vscode.env.openExternal).not.toHaveBeenCalled();
	});

	it('opens a web link in the Simple Browser when that is the only browser inside VS Code', async () => {
		vscode.commands.getCommands.mockResolvedValue(['simpleBrowser.api.open']);
		const { manager } = createManager();

		await manager.openExternal('https://example.com/docs', true);

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			'simpleBrowser.api.open',
			expect.objectContaining({ authority: 'example.com' }),
			{ viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
		);
		expect(vscode.env.openExternal).not.toHaveBeenCalled();
	});

	test.each([
		{ description: 'no browser inside VS Code is available', url: 'https://example.com', commands: [] },
		{
			description: 'the link is not a web page',
			url: 'mailto:team@example.com',
			commands: ['simpleBrowser.api.open', 'workbench.action.browser.open'],
		},
	])('falls back to the default browser when $description', async ({ url, commands }) => {
		vscode.commands.getCommands.mockResolvedValue(commands);
		const { manager } = createManager();

		await manager.openExternal(url, true);

		expect(vscode.env.openExternal).toHaveBeenCalledTimes(1);
		expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
			'workbench.action.browser.open',
			expect.anything(),
		);
		expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
			'simpleBrowser.api.open',
			expect.anything(),
			expect.anything(),
		);
	});

	test.each([{ url: 'javascript:alert(1)' }, { url: 'command:workbench.action.quit' }, { url: 'not a url' }])(
		'refuses $url',
		async ({ url }) => {
			const { manager } = createManager();

			await manager.openExternal(url, false);

			expect(vscode.env.openExternal).not.toHaveBeenCalled();
		},
	);
});

describe('WikiSiteManager.handleSave and refresh', () => {
	it('re-renders a saved page in the tabs showing it, and no other', async () => {
		const { manager, contents } = createManager();
		manager.open();
		manager.open(undefined, { newTab: true });
		panelAt(0).receive({ type: 'navigate', uri: GUIDE });
		panelAt(1).receive({ type: 'navigate', uri: README });
		await settle();

		contents[GUIDE] = '# Guide\n\nSaved.';
		await manager.handleSave(createMockUri('/workspace-root/docs/guide.md'));
		await settle();

		expect(sent(panelAt(0), 'page').map((message) => message.page.content)).toEqual([
			'# Guide\n\nUse the scanner.',
			'# Guide\n\nSaved.',
		]);
		expect(sent(panelAt(1), 'page')).toHaveLength(1);
	});

	it('ignores a saved file outside the wiki', async () => {
		const { manager } = createManager();
		manager.open();
		panelAt().receive({ type: 'navigate', uri: GUIDE });
		await settle();

		await manager.handleSave(createMockUri('/workspace-root/package.json'));

		expect(sent(panelAt(), 'page')).toHaveLength(1);
	});

	it('rescans and re-sends every tab its site on refresh', async () => {
		const { manager, workspace } = createManager();
		const findFiles = jest.spyOn(workspace, 'findFiles');
		manager.open();
		panelAt().receive({ type: 'ready' });
		await settle();
		const scansBefore = findFiles.mock.calls.length;

		manager.refresh();
		await settle();

		expect(sent(panelAt(), 'init')).toHaveLength(2);
		expect(findFiles.mock.calls.length).toBeGreaterThan(scansBefore);
	});
});

describe('WikiSiteManager branding', () => {
	/** Creates a manager whose logo search finds one URI. */
	function withLogo(logo: string | undefined) {
		const workspace = createMockWorkspace(
			{},
			{
				files: (pattern) => (pattern.includes('favicon') && logo ? [createMockUri(logo)] : []),
			},
		);
		return new WikiSiteManager(EXTENSION, workspace);
	}

	const DEFAULT_ICON = { light: '/extension/media/icon-light.svg', dark: '/extension/media/icon-dark.svg' };

	test.each([
		{
			description: 'a local SVG logo',
			logo: '/workspace-root/media/logo.svg',
			expected: '/workspace-root/media/logo.svg',
		},
		{
			description: 'a local ICO favicon, which the workbench cannot draw on a tab',
			logo: '/workspace-root/favicon.ico',
			expected: DEFAULT_ICON,
		},
		{
			description: 'a virtual-workspace logo, which the workbench cannot load for a tab',
			logo: 'vscode-vfs://github/owner/repo/logo.svg',
			expected: DEFAULT_ICON,
		},
		{ description: 'no logo', logo: undefined, expected: DEFAULT_ICON },
	])('sets the tab icon for $description', async ({ logo, expected }) => {
		withLogo(logo).open();
		await settle();

		const icon = panelAt().iconPath;
		expect(typeof expected === 'string' ? icon.path : { light: icon.light.path, dark: icon.dark.path }).toEqual(
			expected,
		);
	});

	it('sends the logo to the page as a webview URI', async () => {
		withLogo('/workspace-root/media/logo.svg').open();
		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'init')[0].site.logoSrc).toBe(
			'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/media/logo.svg',
		);
	});
});

describe('WikiSiteManager.resolveContextUri', () => {
	test.each([
		{ description: 'no context', context: undefined, expected: undefined },
		{
			description: 'a page URI',
			context: { webviewSection: 'doc' as const, uri: GUIDE },
			expected: '/workspace-root/docs/guide.md',
		},
		{
			description: 'a page link',
			context: { webviewSection: 'doc' as const, href: 'docs/guide.md', fromUri: README },
			expected: '/workspace-root/docs/guide.md',
		},
		{
			description: 'a workspace file link',
			context: { webviewSection: 'doc' as const, href: 'src/a.ts', fromUri: README },
			expected: '/workspace-root/src/a.ts',
		},
		{
			description: 'an external link',
			context: { webviewSection: 'external' as const, href: 'https://example.com', fromUri: README },
			expected: undefined,
		},
	])('resolves $description', async ({ context, expected }) => {
		const { manager } = createManager();

		expect((await manager.resolveContextUri(context))?.path).toBe(expected);
	});
});

describe('parseViewMessage', () => {
	test.each([
		{ raw: { type: 'ready' }, valid: true },
		{ raw: { type: 'navigate', uri: GUIDE }, valid: true },
		{ raw: { type: 'navigate', uri: GUIDE, fragment: 3 }, valid: false },
		{ raw: { type: 'title', title: 'x' }, valid: true },
		{ raw: { type: 'openLink', href: 'a.md', fromUri: GUIDE, newTab: false }, valid: true },
		{ raw: { type: 'openLink', href: 'a.md', fromUri: GUIDE }, valid: false },
		{ raw: { type: 'openExternal', url: 'https://x', integrated: true }, valid: true },
		{ raw: { type: 'openOriginal', uri: GUIDE, mode: 'preview' }, valid: true },
		{ raw: { type: 'openOriginal', uri: GUIDE, mode: 'delete' }, valid: false },
		{ raw: { type: 'openInNewTab', uri: GUIDE }, valid: true },
		{ raw: { type: 'search', query: 'x' }, valid: true },
		{ raw: { type: 'runCommand', command: 'x' }, valid: false },
		{ raw: null, valid: false },
		{ raw: 'ready', valid: false },
	])('accepts $raw: $valid', ({ raw, valid }) => {
		expect(parseViewMessage(raw) !== undefined).toBe(valid);
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

		expect(node).toEqual({
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
