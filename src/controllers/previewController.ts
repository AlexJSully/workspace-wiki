/**
 * Preview controller for handling file opening and interaction logic
 */
import { getFileExtension as extensionFromPath, getFileName, matchesGlobPattern } from '@utils';
import * as vscode from 'vscode';

/** Map of URI strings to their last click timestamps, used to detect a double click. */
const lastClickTimes: Map<string, number> = new Map();
/** Time threshold (in milliseconds) to consider two clicks as a double-click */
const DOUBLE_CLICK_THRESHOLD = 500;

/**
 * Command this extension registers to open a Markdown file through {@link openMarkdown}.
 *
 * It is the shipped `openWith` value for Markdown rather than a concrete VS Code command because
 * which surface exists depends on the running version, and that can only be decided at click time.
 */
export const OPEN_MARKDOWN_COMMAND = 'workspace-wiki.openMarkdown';

/**
 * ViewType of VS Code's built-in Markdown Editor, a rendered surface that edits in place.
 *
 * Added in VS Code 1.131 and contributed by the built-in `markdown-language-features` extension.
 * Its `priority.textEditor` is `option`, so VS Code never selects it on its own.
 */
const MARKDOWN_EDITOR_VIEW_TYPE = 'vscode.markdown.editor';

/** ViewType of VS Code's plain text editor, `DEFAULT_EDITOR_ASSOCIATION.id` in the VS Code source. */
const TEXT_EDITOR_VIEW_TYPE = 'default';

/** Command the built-in markdown extension contributes for its read-only preview. */
const MARKDOWN_PREVIEW_COMMAND = 'markdown.showPreview';

/**
 * Default commands per extension when configuration is missing or invalid.
 *
 * Exported so the tree provider falls back to the same commands this module does; the second copy of
 * these pairs is `package.json`, which is what a user's settings are diffed against. Frozen because
 * both consumers hold it by reference, so a write through either would rewrite the default for every
 * caller, and given no prototype so that a file extension colliding with an `Object.prototype` member
 * cannot resolve to one. Lowercasing in `getFileExtension` leaves `constructor` and `__proto__` as
 * the two names that could.
 */
export const DEFAULT_OPEN_WITH: Readonly<Record<string, string>> = Object.freeze(
	Object.assign(Object.create(null) as Record<string, string>, {
		md: OPEN_MARKDOWN_COMMAND,
		markdown: OPEN_MARKDOWN_COMMAND,
		mdx: OPEN_MARKDOWN_COMMAND,
		txt: 'vscode.open',
	}),
);

/**
 * Gets the file extension from a URI
 *
 * Reads `uri.path` rather than `uri.fsPath` so the result is correct on virtual file systems,
 * and looks only at the final path segment so a dotted directory name cannot leak in.
 *
 * @param uri The URI to extract the file extension from
 * @returns The file extension in lowercase, or undefined if none exists
 */
function getFileExtension(uri: vscode.Uri): string | undefined {
	return extensionFromPath(uri.path) || undefined;
}

/**
 * Checks an already-read `openWith` value is an object of string values, falling back to
 * `DEFAULT_OPEN_WITH` when it is missing or malformed.
 *
 * Takes the value rather than reading the setting itself, so a caller holding the configuration
 * through its own seam validates it the same way this module does without going around that seam.
 *
 * @param value The raw setting value, which is user JSON and may be any shape
 * @returns A mapping of file extensions to commands
 */
export function validateOpenWith(value: unknown): Readonly<Record<string, string>> {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const entries = Object.entries(value);

		if (entries.every(([k, v]) => typeof k === 'string' && typeof v === 'string')) {
			// Copied onto a null prototype rather than returned as given: the setting is parsed JSON and
			// so carries `Object.prototype`, where a lookup for an extension named `constructor` or
			// `__proto__` would find a function or an object to run as a command. Assigning onto a null
			// prototype also writes a configured `__proto__` key as an ordinary property.
			return Object.freeze(Object.assign(Object.create(null) as Record<string, string>, value));
		}
	}

	return DEFAULT_OPEN_WITH;
}

/**
 * Retrieves the 'openWith' configuration from settings.
 *
 * @returns A mapping of file extensions to commands
 */
function getOpenWithConfig(): Readonly<Record<string, string>> {
	return validateOpenWith(vscode.workspace.getConfiguration('workspaceWiki').get('openWith'));
}

/** What the installed extensions between them offer for opening a Markdown file. */
interface MarkdownSurfaces {
	/** Filename patterns the Markdown Editor claims, empty when no extension contributes it. */
	readonly markdownEditorPatterns: string[];
	/** Whether some extension contributes `markdown.showPreview`. */
	readonly previewAvailable: boolean;
}

/**
 * Collects both Markdown surfaces from the installed extensions in a single pass.
 *
 * One walk rather than one per surface, because this runs on every click and the two questions read
 * neighbouring keys of the same manifests.
 *
 * @returns The patterns the Markdown Editor claims and whether the preview command exists
 */
function findMarkdownSurfaces(): MarkdownSurfaces {
	const markdownEditorPatterns: string[] = [];
	let previewAvailable = false;

	for (const extension of vscode.extensions.all) {
		// Another extension's manifest, so each hop is checked rather than trusted. `packageJSON` is
		// already typed `any` by the VS Code API, so reaching into it needs no cast.
		const contributes = extension.packageJSON?.contributes;
		const customEditors = contributes?.customEditors;
		const commands = contributes?.commands;

		if (Array.isArray(customEditors)) {
			for (const editor of customEditors) {
				if (editor?.viewType !== MARKDOWN_EDITOR_VIEW_TYPE || !Array.isArray(editor.selector)) {
					continue;
				}

				for (const selector of editor.selector) {
					if (typeof selector?.filenamePattern === 'string') {
						markdownEditorPatterns.push(selector.filenamePattern);
					}
				}
			}
		}

		if (!previewAvailable && Array.isArray(commands)) {
			previewAvailable = commands.some((entry) => entry?.command === MARKDOWN_PREVIEW_COMMAND);
		}
	}

	return { markdownEditorPatterns, previewAvailable };
}

/**
 * Reports whether the running VS Code would open this file in its built-in Markdown Editor.
 *
 * Reads the filename patterns off the live `customEditors` contribution rather than testing for
 * `.md`, so a VS Code that changes which extensions the editor claims is followed without a change
 * here. Only the file name is matched, as VS Code itself does for a pattern naming no directory; a
 * selector spelling out path structure would not be honoured.
 *
 * This check cannot be replaced by attempting the open and catching a failure: `vscode.openWith`
 * with a viewType no registered editor matches resolves to nothing and returns normally, so the
 * click would silently do nothing at all.
 *
 * @param uri The URI of the file to test
 * @param patterns The patterns the Markdown Editor claims, from {@link findMarkdownSurfaces}
 * @returns `true` when the Markdown Editor is registered and claims this file name
 */
function markdownEditorClaims(uri: vscode.Uri, patterns: string[]): boolean {
	// The bare file name, not `uri.path`: `matchesGlobPattern` anchors a slash-free pattern to the
	// start of what it is given, so a full path would never match `*.md`. VS Code resolves the same
	// selector against the resource's base name, so the two agree.
	return matchesGlobPattern(getFileName(uri.path), patterns);
}

/**
 * Opens a Markdown file in the best surface the running VS Code offers, degrading in three steps:
 * the Markdown Editor when it claims the file, the Markdown preview when only that exists, and
 * otherwise a plain open, which honours whatever the user set in `workbench.editorAssociations`.
 *
 * Never consults `openWith`. That setting resolves Markdown to this very command, so reading it
 * here would dispatch back into this function without end.
 *
 * @param uri The URI of the file to open
 */
export function openMarkdown(uri: vscode.Uri): void {
	const { markdownEditorPatterns, previewAvailable } = findMarkdownSurfaces();

	if (markdownEditorClaims(uri, markdownEditorPatterns)) {
		vscode.commands.executeCommand('vscode.openWith', uri, MARKDOWN_EDITOR_VIEW_TYPE);

		return;
	}

	if (previewAvailable) {
		vscode.commands.executeCommand(MARKDOWN_PREVIEW_COMMAND, uri);

		return;
	}

	vscode.commands.executeCommand('vscode.open', uri);
}

/**
 * Opens a file in preview mode using the command configured for its extension (falling back to `vscode.open`).
 * @param uri The URI of the file to open
 */
export function openInPreview(uri: vscode.Uri): void {
	const command = getOpenCommand(uri, 'preview');
	vscode.commands.executeCommand(command, uri);
}

/**
 * Opens a file in editor mode.
 *
 * A file the Markdown Editor would claim is pinned to the plain text editor, so this stays the way
 * back to the Markdown source however the user has associated `*.md`. Every other file is left to
 * `vscode.open`, which resolves whichever editor owns it — pinning those would open a PDF as text.
 *
 * @param uri The URI of the file to open
 */
export function openInEditor(uri: vscode.Uri): void {
	if (markdownEditorClaims(uri, findMarkdownSurfaces().markdownEditorPatterns)) {
		vscode.commands.executeCommand('vscode.openWith', uri, TEXT_EDITOR_VIEW_TYPE);

		return;
	}

	vscode.commands.executeCommand('vscode.open', uri);
}

/**
 * Handles file clicks with double-click detection: a second click within `DOUBLE_CLICK_THRESHOLD`
 * opens the file in the editor, otherwise the single-click `defaultCommand` runs.
 * @param uri The URI of the file that was clicked
 * @param defaultCommand The default command to execute on single click
 */
export function handleFileClick(uri: vscode.Uri, defaultCommand: string): void {
	const now = Date.now();
	const key = uri.toString();
	const lastClick = lastClickTimes.get(key) || 0;

	if (now - lastClick < DOUBLE_CLICK_THRESHOLD) {
		// Double-click detected - open in editor
		openInEditor(uri);

		// Clear to prevent triple-click issues
		lastClickTimes.delete(key);
	} else {
		// Single click - execute default command (preview)
		vscode.commands.executeCommand(defaultCommand, uri);
		lastClickTimes.set(key, now);

		// Clear old entries to prevent memory leaks
		setTimeout(() => {
			if (lastClickTimes.get(key) === now) {
				lastClickTimes.delete(key);
			}
		}, DOUBLE_CLICK_THRESHOLD + 100);
	}
}

/**
 * Gets the appropriate command for opening a file based on extension and settings
 *
 * Resolves to a command taking the URI as its only argument, which is what a tree item can carry.
 * Editor mode is therefore the plain `vscode.open`: pinning a viewType needs a second argument, so
 * a double click goes through {@link openInEditor} rather than a command string resolved here.
 *
 * @param uri The URI of the file
 * @param mode The mode to open the file in ('preview' or 'editor')
 * @returns The command string to execute
 */
export function getOpenCommand(uri: vscode.Uri, mode: 'preview' | 'editor' = 'preview'): string {
	if (mode === 'editor') {
		return 'vscode.open';
	}

	const openWith = getOpenWithConfig();
	const fileExt = getFileExtension(uri);

	// `Object.hasOwn` rather than `in`, which reads the prototype chain: the map reaching here has no
	// prototype, and this keeps that from being the only thing holding the lookup safe.
	return fileExt && Object.hasOwn(openWith, fileExt) ? openWith[fileExt] : 'vscode.open';
}

/** Clears all stored click times (useful for testing) */
export function clearClickTimes(): void {
	lastClickTimes.clear();
}

/**
 * Gets the double click threshold value
 * @returns The double click threshold in milliseconds
 */
export function getDoubleClickThreshold(): number {
	return DOUBLE_CLICK_THRESHOLD;
}
