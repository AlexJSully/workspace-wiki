import { setMockExtensions } from '../test/mocks';
import { GUIDE, README, createSiteManager, panelAt, sent, settle } from '../test/site';
import { registerSiteCommands } from './commands';

const vscode = require('vscode');

/**
 * Registers the site commands over a two-page workspace.
 *
 * @returns The manager, and the handler a command id was registered with
 */
function registerOver() {
	const { manager } = createSiteManager();
	const disposables = registerSiteCommands(manager);
	const handler = (id: string) =>
		vscode.commands.registerCommand.mock.calls.find((call: any) => call[0] === `workspace-wiki.site.${id}`)[1];
	return { manager, disposables, handler };
}

const PAGE_CONTEXT = { webviewSection: 'doc', uri: GUIDE };
const GUIDE_PATH = expect.objectContaining({ path: '/workspace-root/docs/guide.md' });

beforeEach(() => {
	setMockExtensions([]);
	vscode.commands.getCommands.mockResolvedValue([]);
});

describe('registerSiteCommands', () => {
	it('registers every right-click command and returns their registrations', () => {
		const { disposables } = registerOver();

		expect(vscode.commands.registerCommand.mock.calls.map((call: any) => call[0]).sort()).toEqual([
			'workspace-wiki.site.copyLink',
			'workspace-wiki.site.copyPath',
			'workspace-wiki.site.editSource',
			'workspace-wiki.site.openInNewTab',
			'workspace-wiki.site.openLinkExternal',
			'workspace-wiki.site.openLinkIntegrated',
			'workspace-wiki.site.openOriginal',
			'workspace-wiki.site.openToSide',
		]);
		expect(disposables).toHaveLength(8);
	});

	it('opens a right-clicked page in a new tab on that page', async () => {
		const { manager, handler } = registerOver();

		await handler('openInNewTab')(PAGE_CONTEXT);
		panelAt().receive({ type: 'ready' });
		await settle();

		expect(manager.openTabs).toHaveLength(1);
		expect(sent(panelAt(), 'init')[0].route).toEqual({ kind: 'page', uri: GUIDE });
	});

	it('opens a right-clicked page to the side', async () => {
		const { handler } = registerOver();

		await handler('openToSide')(PAGE_CONTEXT);

		expect(vscode.window.createWebviewPanel.mock.calls[0][2]).toBe(vscode.ViewColumn.Beside);
	});

	it('opens a right-clicked page as its original file, through its openWith command or the text editor', async () => {
		const { handler } = registerOver();

		await handler('openOriginal')(PAGE_CONTEXT);
		await handler('editSource')(PAGE_CONTEXT);

		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workspace-wiki.openMarkdown', GUIDE_PATH);
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', GUIDE_PATH);
	});

	it('copies the workspace-relative path of a right-clicked link', async () => {
		const { handler } = registerOver();

		await handler('copyPath')({ webviewSection: 'doc', href: 'docs/guide.md', fromUri: README });

		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('docs/guide.md');
	});

	test.each([
		{ description: 'no context', context: undefined },
		{ description: 'an external link', context: { webviewSection: 'external', href: 'https://example.com' } },
		{ description: 'a URI outside the wiki', context: { webviewSection: 'doc', uri: 'file:///etc/hosts' } },
	])('does nothing for a page command on $description', async ({ context }) => {
		const { manager, handler } = registerOver();

		await handler('openInNewTab')(context);
		await handler('editSource')(context);
		await handler('copyPath')(context);

		expect(manager.openTabs).toHaveLength(0);
		expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('vscode.open', expect.anything());
		expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
	});

	it('opens a right-clicked external link in the default or integrated browser, and copies it', async () => {
		vscode.commands.getCommands.mockResolvedValue(['workbench.action.browser.open']);
		const { handler } = registerOver();
		const context = { webviewSection: 'external', href: 'https://example.com/docs' };

		await handler('openLinkExternal')(context);
		await handler('openLinkIntegrated')(context);
		await handler('copyLink')(context);

		expect(vscode.env.openExternal).toHaveBeenCalledTimes(1);
		expect(vscode.env.openExternal).toHaveBeenCalledWith(expect.objectContaining({ authority: 'example.com' }));
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.browser.open', {
			url: 'https://example.com/docs',
		});
		expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('https://example.com/docs');
	});

	it('does nothing for a link command whose context has no link', async () => {
		const { handler } = registerOver();

		await handler('openLinkExternal')(PAGE_CONTEXT);
		await handler('copyLink')({ webviewSection: 'external', href: 7 });

		expect(vscode.env.openExternal).not.toHaveBeenCalled();
		expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
	});
});
