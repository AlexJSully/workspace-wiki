import { WorkspaceLike } from '@types';
import { normalizePath } from '@utils';
import ignore, { Ignore } from 'ignore';
import * as vscode from 'vscode';

/** File-system error codes meaning "the file simply is not there", which is expected and not worth logging. */
const MISSING_FILE_CODES = new Set(['FileNotFound', 'ENOENT']);

/** A single `.gitignore` file, with the directory its rules are relative to. */
interface IgnoreSource {
	/** Directory containing the `.gitignore`, relative to its workspace folder; `''` at the folder root. */
	baseDir: string;
	/** Number of path segments in `baseDir`, used to order shallowest-first. */
	depth: number;
	/** Compiled matcher for this file's rules. */
	matcher: Ignore;
}

/**
 * A workspace folder, decomposed so a URI can be tested against it without going through
 * `toString()`. Comparing the components directly keeps paths free of percent-encoding.
 */
interface FolderScope {
	scheme: string;
	authority: string;
	/** The folder's `uri.path`, with a guaranteed trailing slash so `/a/foo` cannot match `/a/foobar`. */
	path: string;
}

/** The `.gitignore` rules discovered in one workspace folder. */
interface FolderRules {
	/** The folder these rules belong to. */
	scope: FolderScope;
	/** Sources ordered shallowest-first. */
	sources: IgnoreSource[];
}

/** Decides whether a file URI is excluded by the workspace's `.gitignore` files. */
export interface IgnoreIndex {
	/**
	 * @param uri The file URI to test
	 * @returns `true` when git would ignore this file
	 */
	isIgnored(uri: vscode.Uri): boolean;
}

/** An index that ignores nothing, used when there are no rules to apply. */
const EMPTY_INDEX: IgnoreIndex = { isIgnored: () => false };

/**
 * Decomposes a workspace folder URI for component-wise comparison.
 *
 * @param uri The workspace folder URI
 * @returns The folder's scheme, authority, and slash-terminated path
 */
function toFolderScope(uri: vscode.Uri): FolderScope {
	const path = normalizePath(uri.path);
	return {
		scheme: uri.scheme,
		authority: uri.authority,
		path: path.endsWith('/') ? path : `${path}/`,
	};
}

/**
 * Returns a URI's path relative to a folder, or null when the URI lies outside it.
 *
 * Comparison is component-wise and reads `uri.path`, never `uri.toString()`. The string form is
 * percent-encoded, so slicing it would hand `my%20docs/notes.md` to the matcher and a rule written
 * `my docs/` would never fire.
 *
 * @param scope The folder to measure against
 * @param uri The URI to place
 * @returns The relative path, or null when the URI is not inside the folder
 */
function relativeTo(scope: FolderScope, uri: vscode.Uri): string | null {
	if (uri.scheme !== scope.scheme || uri.authority !== scope.authority) {
		return null;
	}

	const path = normalizePath(uri.path);
	return path.startsWith(scope.path) ? path.slice(scope.path.length) : null;
}

/**
 * Reads and compiles a single `.gitignore`.
 *
 * @param workspace The workspace providing filesystem access
 * @param gitignoreUri The URI of the `.gitignore` file
 * @param scope The containing workspace folder
 * @returns The compiled source, or null when the file is absent, unreadable, or outside the folder
 */
async function readSource(
	workspace: WorkspaceLike,
	gitignoreUri: vscode.Uri,
	scope: FolderScope,
): Promise<IgnoreSource | null> {
	const relative = relativeTo(scope, gitignoreUri);
	if (relative === null) {
		return null;
	}

	let content: string;

	try {
		const bytes = await workspace.fs.readFile(gitignoreUri);
		content = new TextDecoder().decode(bytes);
	} catch (error: any) {
		// A folder without a .gitignore is the common case, not a problem worth reporting.
		if (!MISSING_FILE_CODES.has(error?.code)) {
			console.warn('[WorkspaceWiki] Could not read .gitignore:', gitignoreUri.toString(), error);
		}
		return null;
	}

	// Strip the trailing '.gitignore' to get the directory the rules are relative to.
	const baseDir = relative.replace(/\.gitignore$/, '').replace(/\/$/, '');

	return {
		baseDir,
		depth: baseDir ? baseDir.split('/').length : 0,
		// allowRelativePaths keeps an unexpected path (`.`, `..`, `../x`) from raising a RangeError.
		// isIgnored runs inside an unguarded filter, so a throw would empty the tree rather than
		// misjudge one file.
		matcher: ignore({ allowRelativePaths: true }).add(content),
	};
}

/**
 * Collects every `.gitignore` in one workspace folder, ordered shallowest-first.
 *
 * @param workspace The workspace providing `findFiles` and filesystem access
 * @param folder The workspace folder to scan
 * @param excludeGlobs Patterns excluded from the search
 * @returns The folder's rules, or null when it has no readable `.gitignore`
 */
async function collectFolderRules(
	workspace: WorkspaceLike,
	folder: { uri: vscode.Uri },
	excludeGlobs: string[],
): Promise<FolderRules | null> {
	const scope = toFolderScope(folder.uri);
	const exclude = excludeGlobs.length > 0 ? `{${excludeGlobs.join(',')}}` : undefined;

	// A .gitignore inside an excluded directory stays invisible on purpose: git would not descend
	// there either, so its rules cannot apply to anything we are able to see.
	let discovered: vscode.Uri[] = [];
	try {
		discovered =
			(await workspace.findFiles(new vscode.RelativePattern(folder.uri, '**/.gitignore'), exclude)) ?? [];
	} catch (error) {
		console.warn('[WorkspaceWiki] Could not search for .gitignore files:', error);
	}

	// Always include the folder root explicitly. If a host's findFiles does not surface dotfiles we
	// would otherwise silently lose all .gitignore support rather than failing visibly.
	const rootUri = vscode.Uri.joinPath(folder.uri, '.gitignore');

	// `readSource` drops anything outside this folder, so a result from a sibling root cannot have
	// this folder's path sliced off it and produce a base directory that filters the wrong tree.
	const uris = [rootUri, ...discovered.filter((uri) => uri.toString() !== rootUri.toString())];

	const sources = (await Promise.all(uris.map((uri) => readSource(workspace, uri, scope)))).filter(
		(source): source is IgnoreSource => source !== null,
	);

	if (sources.length === 0) {
		return null;
	}

	sources.sort((a, b) => a.depth - b.depth);
	return { scope, sources };
}

/**
 * Builds a matcher over every `.gitignore` in the workspace, honouring git's real semantics:
 * negation (`!keep.md`), directory-only rules (`build/`), anchoring, nested `.gitignore` files
 * overriding shallower ones, and the rule that a file under an ignored directory cannot be
 * re-included.
 *
 * Rules are scoped per workspace folder, so a `.gitignore` in one root never filters another.
 *
 * @param workspace The workspace providing `findFiles`, `workspaceFolders`, and filesystem access
 * @param excludeGlobs Patterns excluded from the `.gitignore` search
 * @returns An index whose `isIgnored` reports git's verdict for a file URI
 */
export async function buildIgnoreIndex(workspace: WorkspaceLike, excludeGlobs: string[]): Promise<IgnoreIndex> {
	const folders = workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return EMPTY_INDEX;
	}

	const collected = await Promise.all(folders.map((folder) => collectFolderRules(workspace, folder, excludeGlobs)));
	const folderRules = collected.filter((rules): rules is FolderRules => rules !== null);

	if (folderRules.length === 0) {
		return EMPTY_INDEX;
	}

	// Longest path first, so a workspace folder nested inside another wins over its parent.
	folderRules.sort((a, b) => b.scope.path.length - a.scope.path.length);

	/**
	 * Asks the applicable `.gitignore` files, deepest first, whether a path is ignored.
	 *
	 * @param sources The containing folder's sources, shallowest-first
	 * @param candidate A folder-relative path; directories carry a trailing slash
	 * @returns `true`/`false` when a rule matched, or undefined when none had an opinion
	 */
	function evaluate(sources: IgnoreSource[], candidate: string): boolean | undefined {
		for (let i = sources.length - 1; i >= 0; i--) {
			const source = sources[i];
			const base = source.baseDir ? `${source.baseDir}/` : '';

			// A .gitignore only governs paths beneath its own directory.
			if (base && !candidate.startsWith(base)) {
				continue;
			}

			const relative = candidate.slice(base.length);
			if (!relative) {
				continue;
			}

			const verdict = source.matcher.test(relative);
			if (verdict.ignored) {
				return true;
			}
			if (verdict.unignored) {
				return false;
			}
		}

		return undefined;
	}

	return {
		isIgnored(uri: vscode.Uri): boolean {
			let owner: FolderRules | undefined;
			let relative: string | null = null;

			for (const rules of folderRules) {
				relative = relativeTo(rules.scope, uri);
				if (relative !== null) {
					owner = rules;
					break;
				}
			}

			if (!owner || !relative) {
				return false;
			}

			// Walk ancestors top-down: git never descends into an ignored directory, so once a
			// parent is ignored no deeper rule can bring the file back.
			const segments = relative.split('/');
			for (let i = 1; i <= segments.length; i++) {
				const isDirectory = i < segments.length;

				// Directory-only rules ('build/') only match when the trailing slash is present.
				const candidate = segments.slice(0, i).join('/') + (isDirectory ? '/' : '');

				if (evaluate(owner.sources, candidate) === true) {
					return true;
				}
			}

			return false;
		},
	};
}
