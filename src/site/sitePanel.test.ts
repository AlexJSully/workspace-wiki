import { createMockUri, createMockWorkspace } from '../test/mocks';
import { EXTENSION, GUIDE, README, createSiteManager, panelAt, sent, settle } from '../test/site';
import { WikiSiteManager } from './sitePanel';

const vscode = require('vscode');

beforeEach(() => {
	vscode.commands.getCommands.mockResolvedValue([]);
});

describe('WikiSiteManager.open', () => {
	it('opens a scripted webview limited to the bundle, the media folder, and the workspace', () => {
		const { manager } = createSiteManager();

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

	it('reveals the open tab rather than opening another, unless asked for a new tab', () => {
		const { manager } = createSiteManager();

		const first = manager.open();
		const again = manager.open();
		const second = manager.open(undefined, { newTab: true });

		expect(again).toBe(first);
		expect(second).not.toBe(first);
		expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
		expect(first.panel.reveal).toHaveBeenCalled();
	});

	it('forgets a tab once it is closed', () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().dispose();
		manager.open();

		expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
		expect(manager.openTabs).toHaveLength(1);
	});

	it('closes every tab when disposed', () => {
		const { manager } = createSiteManager();
		manager.open();
		manager.open(undefined, { newTab: true });

		manager.dispose();

		expect(panelAt(0).dispose).toHaveBeenCalled();
		expect(panelAt(1).dispose).toHaveBeenCalled();
		expect(manager.openTabs).toHaveLength(0);
	});
});

describe('WikiSiteManager tree', () => {
	it('drops the tree once the last tab closes, so the next tab rescans', async () => {
		const { manager, workspace } = createSiteManager();
		const findFiles = jest.spyOn(workspace, 'findFiles');
		manager.open();
		manager.open(undefined, { newTab: true });
		await manager.getTree();
		const scans = findFiles.mock.calls.length;

		panelAt(0).dispose();
		await manager.getTree();
		expect(findFiles.mock.calls.length).toBe(scans);

		panelAt(1).dispose();
		await manager.getTree();
		expect(findFiles.mock.calls.length).toBeGreaterThan(scans);
	});

	it('keeps the pages of the newest load when an older load finishes after it', async () => {
		const NEW_PAGE = 'file:///workspace-root/docs/new.md';
		const { manager, workspace, contents } = createSiteManager({}, ['README.md', 'docs/guide.md', 'docs/new.md']);
		contents[NEW_PAGE] = '# New';
		const findFiles = workspace.findFiles;
		// The older load waits on `gate` and sees the listing from before `new.md` was added.
		let stale = true;
		let releaseOlder: () => void = () => undefined;
		let gate = new Promise<void>((resolve) => {
			releaseOlder = resolve;
		});
		jest.spyOn(workspace, 'findFiles').mockImplementation(async (pattern, exclude, maxResults) => {
			await gate;
			const found = await findFiles(pattern, exclude, maxResults);
			return stale ? found.filter((uri) => !uri.path.endsWith('/new.md')) : found;
		});

		const older = manager.getTree();
		manager.refresh();
		stale = false;
		gate = Promise.resolve();
		await manager.getTree();
		stale = true;
		releaseOlder();
		await older;

		expect((await manager.findDoc(NEW_PAGE))?.title).toBe('New');
	});
});

describe('WikiSiteManager.openExternal', () => {
	it('opens a web link in the default browser', async () => {
		const { manager } = createSiteManager();

		await manager.openExternal('https://example.com/docs', false);

		expect(vscode.env.openExternal).toHaveBeenCalledWith(expect.objectContaining({ authority: 'example.com' }));
	});

	it('opens a web link in a new integrated browser tab when VS Code has the integrated browser', async () => {
		vscode.commands.getCommands.mockResolvedValue(['simpleBrowser.api.open', 'workbench.action.browser.open']);
		const { manager } = createSiteManager();

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
		const { manager } = createSiteManager();

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
		const { manager } = createSiteManager();

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

	test.each([
		{ url: 'javascript:alert(1)' },
		{ url: 'command:workbench.action.quit' },
		{ url: 'file:///etc/hosts' },
		{ url: 'not a url' },
	])('refuses $url', async ({ url }) => {
		const { manager } = createSiteManager();

		await manager.openExternal(url, false);

		expect(vscode.env.openExternal).not.toHaveBeenCalled();
	});
});

describe('WikiSiteManager.handleSave and refresh', () => {
	it('re-renders a saved page in the tabs showing it, and no other', async () => {
		const { manager, contents } = createSiteManager();
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

	it('searches a saved page by its new text', async () => {
		const { manager, contents } = createSiteManager();
		manager.open();
		await manager.search('scanner');

		contents[GUIDE] = '# Guide\n\nUse the indexer.';
		await manager.handleSave(createMockUri('/workspace-root/docs/guide.md'));

		expect(await manager.search('scanner')).toEqual([]);
		expect((await manager.search('indexer')).map((result) => result.uri)).toEqual([GUIDE]);
	});

	it('ignores a saved file outside the wiki', async () => {
		const { manager } = createSiteManager();
		manager.open();
		panelAt().receive({ type: 'navigate', uri: GUIDE });
		await settle();

		await manager.handleSave(createMockUri('/workspace-root/package.json'));

		expect(sent(panelAt(), 'page')).toHaveLength(1);
	});

	it('rescans and re-sends every tab its site on refresh', async () => {
		const { manager, workspace } = createSiteManager();
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
	const WEBVIEW_ORIGIN = 'https://file%2B.vscode-resource.vscode-cdn.net';

	test.each([
		{
			description: 'a local SVG logo',
			logo: '/workspace-root/media/logo.svg',
			icon: '/workspace-root/media/logo.svg',
			logoSrc: `${WEBVIEW_ORIGIN}/workspace-root/media/logo.svg`,
		},
		{
			description: 'a local ICO favicon, which the workbench cannot draw on a tab',
			logo: '/workspace-root/favicon.ico',
			icon: DEFAULT_ICON,
			logoSrc: `${WEBVIEW_ORIGIN}/workspace-root/favicon.ico`,
		},
		{
			description: 'a virtual-workspace logo, which the workbench cannot load for a tab',
			logo: 'vscode-vfs://github/owner/repo/logo.svg',
			icon: DEFAULT_ICON,
			logoSrc: `${WEBVIEW_ORIGIN}/owner/repo/logo.svg`,
		},
		{ description: 'no logo', logo: undefined, icon: DEFAULT_ICON, logoSrc: undefined },
	])('sets the tab icon and header logo for $description', async ({ logo, icon, logoSrc }) => {
		withLogo(logo).open();
		panelAt().receive({ type: 'ready' });
		await settle();

		const iconPath = panelAt().iconPath;
		expect(
			typeof icon === 'string' ? iconPath.path : { light: iconPath.light.path, dark: iconPath.dark.path },
		).toEqual(icon);
		expect(sent(panelAt(), 'init')[0].site.logoSrc).toBe(logoSrc);
	});
});

describe('WikiSiteManager.resolveContextUri', () => {
	test.each([
		{ description: 'a page URI', context: { uri: GUIDE }, expected: '/workspace-root/docs/guide.md' },
		{
			description: 'a page link',
			context: { href: 'docs/guide.md', fromUri: README },
			expected: '/workspace-root/docs/guide.md',
		},
		{
			description: 'a workspace file link',
			context: { href: 'src/a.ts', fromUri: README },
			expected: '/workspace-root/src/a.ts',
		},
	])('resolves $description', async ({ context, expected }) => {
		const { manager } = createSiteManager();

		expect((await manager.resolveContextUri({ webviewSection: 'doc', ...context }))?.path).toBe(expected);
	});

	test.each([
		{ description: 'no context', context: undefined },
		{ description: 'an external link', context: { href: 'https://example.com', fromUri: README } },
		{ description: 'a URI outside the wiki', context: { uri: 'file:///etc/passwd' } },
		{ description: 'a workspace file named as a page', context: { uri: 'file:///workspace-root/src/a.ts' } },
		{
			description: 'a link that climbs out of the workspace',
			context: { href: '../../etc/hosts', fromUri: README },
		},
		{ description: 'a link to another scheme', context: { href: 'vscode://x/run', fromUri: README } },
		{
			description: 'a link from a page outside the wiki',
			context: { href: 'docs/guide.md', fromUri: 'file:///workspace-root/elsewhere.md' },
		},
	])('resolves nothing for $description', async ({ context }) => {
		const { manager } = createSiteManager();

		expect(await manager.resolveContextUri(context)).toBeUndefined();
	});
});
