import { createMockUri, setMockExtensions } from '../test/mocks';
import { GUIDE, README, createSiteManager, panelAt, sent, settle } from '../test/site';

const vscode = require('vscode');

beforeEach(() => {
	// The `vscode` stub persists across tests in this file, so no Markdown extension is left installed.
	setMockExtensions([]);
});

describe('WikiSiteTab page', () => {
	it('writes a page whose only script carries the nonce its policy allows', () => {
		const { manager } = createSiteManager();

		manager.open();

		const html: string = panelAt().webview.html;
		const nonce = /script-src 'nonce-([0-9a-f]{32})'/.exec(html)?.[1];
		expect(nonce).toBeDefined();
		expect(html).toContain("default-src 'none'");
		expect(html).toContain('img-src vscode-webview://test https: data:;');
		expect(html).not.toContain('connect-src');
		expect(html).not.toContain('blob:');
		const scripts = html.match(/<script[^>]*>/g) ?? [];
		expect(scripts).toEqual([expect.stringContaining(`nonce="${nonce}"`)]);
		expect(html).toContain('/extension/dist/webview/site.js');
		expect(html).toContain('/extension/dist/webview/site.css');
		expect(html).toContain(
			'data-mermaid-src="https://file%2B.vscode-resource.vscode-cdn.net/extension/dist/webview/mermaid.js"',
		);
	});
});

describe('WikiSiteTab messages', () => {
	it('answers ready with the site and the tree, and the page it was opened on', async () => {
		const { manager } = createSiteManager();
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
		const { manager } = createSiteManager();
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
		const { manager } = createSiteManager({ 'site.theme': theme });
		manager.open();

		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'init')[0].site.theme).toBe(expected);
	});

	it('turns custom stylesheet paths into webview URIs, skipping blanks and paths outside the workspace', async () => {
		const { manager } = createSiteManager({
			'site.customCss': ['./styles/wiki.css', '  ', 7, '/brand.css', '../../etc/x.css'],
		});
		manager.open();

		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'init')[0].site.customCss).toEqual([
			'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/styles/wiki.css',
			'https://file%2B.vscode-resource.vscode-cdn.net/workspace-root/brand.css',
		]);
	});

	it('sends a page with its text and the folders its images resolve against', async () => {
		const { manager } = createSiteManager();
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

	it('sends a PDF as a binary page without reading it', async () => {
		const { manager, workspace } = createSiteManager({ supportedExtensions: ['md', 'pdf'] }, [
			'README.md',
			'docs/manual.pdf',
		]);
		const readFile = jest.spyOn(workspace.fs, 'readFile');
		manager.open();

		panelAt().receive({ type: 'navigate', uri: 'file:///workspace-root/docs/manual.pdf' });
		await settle();

		const [{ page }] = sent(panelAt(), 'page');
		expect(page.kind).toBe('binary');
		expect(page.content).toBeUndefined();
		expect(page.fileSrc).toBeUndefined();
		expect(readFile).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/workspace-root/docs/manual.pdf' }));
	});

	it('refuses a page outside the wiki without reading it', async () => {
		const { manager, workspace } = createSiteManager();
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
		const { manager, contents } = createSiteManager();
		delete contents[GUIDE];
		manager.open();

		panelAt().receive({ type: 'navigate', uri: GUIDE });
		await settle();

		expect(sent(panelAt(), 'pageError')[0].message).toMatch(/^Could not read this file: File not found/);
	});

	it('names the tab after the page shown, and after the site for a blank title', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'title', title: 'Guide' });
		await settle();
		expect(panelAt().title).toBe('Guide');

		panelAt().receive({ type: 'title', title: '  ' });
		await settle();
		expect(panelAt().title).toBe('workspace-root');
	});

	it('opens a page as its original file, through its openWith command or the text editor', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'openOriginal', uri: GUIDE, mode: 'preview' });
		panelAt().receive({ type: 'openOriginal', uri: GUIDE, mode: 'editor' });
		await settle();

		const guide = expect.objectContaining({ path: '/workspace-root/docs/guide.md' });
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workspace-wiki.openMarkdown', guide);
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', guide);
	});

	it('does not open a file outside the wiki as an original', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'openOriginal', uri: 'file:///elsewhere.md', mode: 'editor' });
		await settle();

		expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ path: '/elsewhere.md' }),
		);
	});

	it('opens a page in a new tab on that page', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'openInNewTab', uri: GUIDE });
		await settle();
		panelAt(1).receive({ type: 'ready' });
		await settle();

		expect(manager.openTabs).toHaveLength(2);
		expect(sent(panelAt(1), 'init')[0].route).toEqual({ kind: 'page', uri: GUIDE });
	});

	it('follows a page link in the same tab, or a new one', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'openLink', href: 'docs/guide.md#usage', fromUri: README, newTab: false });
		panelAt().receive({ type: 'openLink', href: 'docs/guide.md', fromUri: README, newTab: true });
		await settle();

		expect(sent(panelAt(), 'goto')).toEqual([{ type: 'goto', uri: GUIDE, fragment: 'usage' }]);
		expect(manager.openTabs).toHaveLength(2);
	});

	it('opens a linked workspace file outside the wiki in its editor', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'openLink', href: 'src/index.ts', fromUri: README, newTab: false });
		await settle();

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			'vscode.open',
			expect.objectContaining({ path: '/workspace-root/src/index.ts' }),
		);
	});

	test.each([
		{ description: 'another scheme', href: 'vscode://some.extension/run' },
		{ description: 'a file URI outside the workspace', href: 'file:///etc/hosts' },
		{ description: 'a relative path that climbs out', href: '../../../etc/hosts' },
		{ description: 'a workspace URI that climbs out', href: 'file:///workspace-root/../etc/hosts' },
	])('does not open a link to $description', async ({ href }) => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'openLink', href, fromUri: README, newTab: false });
		await settle();

		expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('vscode.open', expect.anything());
	});

	it('ignores a link from a page that is not in the wiki', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({
			type: 'openLink',
			href: 'docs/guide.md',
			fromUri: 'file:///workspace-root/elsewhere.md',
			newTab: true,
		});
		await settle();

		expect(manager.openTabs).toHaveLength(1);
	});

	it('searches the wiki', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'search', query: 'scanner' });
		await settle();

		const [results] = sent(panelAt(), 'searchResults');
		expect(results.query).toBe('scanner');
		expect(results.results.map((result) => result.uri)).toEqual([GUIDE]);
	});

	it('ignores messages that do not match the protocol', async () => {
		const { manager } = createSiteManager();
		manager.open();

		panelAt().receive({ type: 'navigate', uri: 42 });
		panelAt().receive('ready');
		await settle();

		expect(panelAt().posted).toEqual([]);
	});
});

describe('WikiSiteTab.reveal', () => {
	it('moves a visible tab to the page asked for', () => {
		const { manager } = createSiteManager();
		manager.open();

		manager.open(createMockUri('/workspace-root/docs/guide.md'));

		expect(sent(panelAt(), 'goto')).toEqual([{ type: 'goto', uri: GUIDE, fragment: undefined }]);
	});

	it('gives a hidden tab the page with its next init, since a hidden webview drops messages', async () => {
		const { manager } = createSiteManager();
		manager.open();
		panelAt().visible = false;

		manager.open(createMockUri('/workspace-root/docs/guide.md'));
		panelAt().receive({ type: 'ready' });
		await settle();

		expect(sent(panelAt(), 'goto')).toEqual([]);
		expect(sent(panelAt(), 'init')[0].route).toEqual({ kind: 'page', uri: GUIDE });
	});
});
