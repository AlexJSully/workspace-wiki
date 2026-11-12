import { openInEditor, openInPreview } from '@controllers';
import * as vscode from 'vscode';
import { parseSiteContext } from './messages';
import type { WikiSiteManager } from './sitePanel';

/**
 * Registers the Wiki Site's right-click menu commands, which `package.json` contributes to
 * `webview/context`. Each receives the `data-vscode-context` of the element clicked. Page commands act
 * on what {@link WikiSiteManager.resolveContextUri} accepts, a wiki page or a workspace file, and link
 * commands on an external link's `href`.
 *
 * @param manager The site manager, which resolves and opens what each command names
 * @returns The command registrations, for the extension to dispose
 */
export function registerSiteCommands(manager: WikiSiteManager): vscode.Disposable[] {
	const onPage = (id: string, act: (uri: vscode.Uri) => unknown) =>
		vscode.commands.registerCommand(`workspace-wiki.site.${id}`, async (context: unknown) => {
			const uri = await manager.resolveContextUri(context);
			if (uri) {
				await act(uri);
			}
		});
	const onLink = (id: string, act: (href: string) => unknown) =>
		vscode.commands.registerCommand(`workspace-wiki.site.${id}`, async (context: unknown) => {
			const href = parseSiteContext(context)?.href;
			if (href !== undefined) {
				await act(href);
			}
		});

	return [
		onPage('openInNewTab', (uri) => manager.open(uri, { newTab: true })),
		onPage('openToSide', (uri) => manager.open(uri, { newTab: true, viewColumn: vscode.ViewColumn.Beside })),
		onPage('openOriginal', openInPreview),
		onPage('editSource', openInEditor),
		onPage('copyPath', (uri) => vscode.env.clipboard.writeText(vscode.workspace.asRelativePath(uri, false))),
		onLink('openLinkExternal', (href) => manager.openExternal(href, false)),
		onLink('openLinkIntegrated', (href) => manager.openExternal(href, true)),
		onLink('copyLink', (href) => vscode.env.clipboard.writeText(href)),
	];
}
