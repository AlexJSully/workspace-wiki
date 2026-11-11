import type { WorkspaceLike } from '@types';
import { getFileExtension, getFileName } from '@utils';
import * as vscode from 'vscode';

/** Logo file names, best first. A name may carry a size or variant suffix (`favicon-32x32`, `logo@2x`). */
const LOGO_NAMES = ['favicon', 'logo', 'icon', 'apple-touch-icon'];
/** Formats an `<img>` in the site header shows, best first: a vector scales to any size. */
const HEADER_FORMATS = ['svg', 'png', 'ico', 'webp', 'jpg', 'jpeg', 'gif'];
/**
 * Formats VS Code will draw as a tab icon, best first. The desktop workbench serves a workspace file
 * to its own UI only with one of these extensions (`validExtensions` in VS Code's
 * `protocolMainService.ts`), so an `.ico` cannot be a tab icon.
 */
const TAB_FORMATS = ['svg', 'png', 'webp', 'jpg', 'jpeg', 'gif'];
/** Folders whose icons belong to tooling or build output rather than to the project. */
const LOGO_EXCLUDES = [
	'**/node_modules/**',
	'**/.git/**',
	'**/.vscode-test*/**',
	'**/dist/**',
	'**/out/**',
	'**/build/**',
	'**/coverage/**',
];
/** Folder levels below a workspace root searched for a logo. Deeper icons are rarely the project's. */
const MAX_LOGO_DEPTH = 3;
/** Matches a logo file's base name: one of {@link LOGO_NAMES}, optionally followed by a suffix. */
const LOGO_NAME = new RegExp(`^(${LOGO_NAMES.join('|')})(?:[-_.@].*)?$`);

/** The images the site is branded with. */
export interface SiteBranding {
	/** Shown beside the workspace name in the site header. */
	logo?: vscode.Uri;
	/** Shown on the site's editor tab; always in one of {@link TAB_FORMATS}. */
	tabIcon?: vscode.Uri;
}

/**
 * Orders logo candidates best first: by name (`favicon` before `logo` before `icon`), the exact name
 * before a suffixed one (`favicon.png` before `favicon-16x16.png`), then by format, then the
 * shallowest path.
 *
 * Paths inside a dot-folder other than `.github` are left out: they hold tool and build output, such
 * as `.next`, rather than the project's own artwork.
 *
 * @param uris The candidates found
 * @param workspace Supplies `asRelativePath` to measure each candidate's depth
 * @param formats The extensions to accept, best first
 * @returns The accepted candidates within {@link MAX_LOGO_DEPTH} levels, best first
 */
export function rankLogoCandidates(
	uris: vscode.Uri[],
	workspace: Pick<WorkspaceLike, 'asRelativePath'>,
	formats: readonly string[] = HEADER_FORMATS,
): vscode.Uri[] {
	const scored = uris
		.map((uri) => {
			const relative = workspace.asRelativePath(uri, false);
			const fileName = getFileName(uri.path).toLowerCase();
			const extension = getFileExtension(fileName);
			const baseName = fileName.slice(0, -(extension.length + 1));
			const match = LOGO_NAME.exec(baseName);
			const folders = relative.split('/').slice(0, -1);
			return {
				uri,
				name: match ? LOGO_NAMES.indexOf(match[1]) : -1,
				exact: match !== null && match[1] === baseName ? 0 : 1,
				format: formats.indexOf(extension),
				depth: folders.length,
				hidden: folders.some((folder) => folder.startsWith('.') && folder !== '.github'),
			};
		})
		.filter(
			(candidate) =>
				candidate.name !== -1 &&
				candidate.format !== -1 &&
				candidate.depth <= MAX_LOGO_DEPTH &&
				!candidate.hidden,
		);

	scored.sort((a, b) => a.name - b.name || a.exact - b.exact || a.format - b.format || a.depth - b.depth);
	return scored.map((candidate) => candidate.uri);
}

/**
 * Finds the images to brand the site with: a logo for the header and an icon for the tab.
 *
 * A configured path, relative to the first workspace folder, is the logo when that file can be read,
 * and also the tab icon when its format is one a tab can show. Otherwise the workspace is searched
 * for favicons and logos, skipping dependency and build folders and anything `excludeGlobs`
 * excludes, and the best candidate in each set of formats is taken. The two can differ: a workspace
 * whose favicon is an `.ico` shows it in the header and a PNG favicon, if it has one, on the tab.
 *
 * @param workspace The workspace API
 * @param configured The `workspaceWiki.site.logo` setting; empty to search
 * @returns The logo and tab icon, either of which may be absent
 */
export async function findSiteBranding(workspace: WorkspaceLike, configured: string): Promise<SiteBranding> {
	const root = workspace.workspaceFolders?.[0]?.uri;
	const relative = configured.trim().replace(/^\.?\//, '');

	let configuredLogo: vscode.Uri | undefined;
	if (root && relative) {
		const uri = vscode.Uri.joinPath(root, relative);
		try {
			await workspace.fs.readFile(uri);
			configuredLogo = uri;
		} catch {
			// A configured logo that is missing falls back to the search rather than a broken image.
		}
	}

	const configuredTabIcon =
		configuredLogo && TAB_FORMATS.includes(getFileExtension(configuredLogo.path)) ? configuredLogo : undefined;
	if (configuredLogo && configuredTabIcon) {
		return { logo: configuredLogo, tabIcon: configuredTabIcon };
	}

	const excludeGlobs = workspace.getConfiguration?.('workspaceWiki').get('excludeGlobs');
	const excludes = [...LOGO_EXCLUDES, ...(Array.isArray(excludeGlobs) ? excludeGlobs : [])].filter(
		(glob): glob is string => typeof glob === 'string' && glob.length > 0,
	);
	const pattern = `**/{${LOGO_NAMES.join(',')}}*.{${HEADER_FORMATS.join(',')}}`;
	const found = [...((await workspace.findFiles(pattern, `{${excludes.join(',')}}`, 200)) ?? [])];

	return {
		logo: configuredLogo ?? rankLogoCandidates(found, workspace, HEADER_FORMATS)[0],
		tabIcon: rankLogoCandidates(found, workspace, TAB_FORMATS)[0],
	};
}
