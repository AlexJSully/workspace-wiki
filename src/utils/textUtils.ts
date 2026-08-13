import { load } from 'js-yaml';
import * as vscode from 'vscode';

/** Front matter data extracted from a Markdown or MDX file */
export interface FrontMatterData {
	title: string | null;
	description: string | null;
}

/**
 * Matches a leading YAML front matter block, tolerating a UTF-8 BOM and CRLF line endings.
 * Capture group 1 is the raw YAML between the delimiters.
 */
const FRONT_MATTER_BLOCK = /^﻿?---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

/** File-system error codes meaning "the file simply is not there", which is not worth logging. */
const MISSING_FILE_CODES = new Set(['FileNotFound', 'ENOENT']);

/** Extensions whose documents carry YAML front matter. */
const FRONT_MATTER_EXTENSIONS = ['md', 'markdown', 'mdx'];

/**
 * Splits a leading YAML front matter block off a document and parses it.
 *
 * @param text The full document text
 * @returns The parsed front matter mapping, or an empty object when there is no block, the block is
 * blank, or it does not parse to an object
 */
function parseFrontMatter(text: string): Record<string, unknown> {
	const match = FRONT_MATTER_BLOCK.exec(text);

	// Test for emptiness on a trimmed copy but parse the original, so block indentation survives.
	if (!match || !match[1].trim()) {
		return {};
	}

	const parsed = load(match[1]);
	return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

/**
 * Reads a front matter field, accepting only non-empty strings.
 *
 * @param data The parsed front matter mapping
 * @param key The field to read
 * @returns The trimmed value, or null when absent, non-string, or blank
 */
function readStringField(data: Record<string, unknown>, key: string): string | null {
	const value = data[key];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Extracts title and description from YAML front matter in a Markdown or MDX file.
 *
 * Reads through `vscode.workspace.fs`, so it works against any file system provider — local disk,
 * remote, or a virtual workspace such as `vscode-vfs://` on VS Code Web.
 *
 * @param uri - The URI of the Markdown or MDX file
 * @returns Promise resolving to the `title` and `description` from front matter, or nulls when absent, unreadable, or not a `.md`/`.markdown`/`.mdx` file
 */
export async function extractFrontMatter(uri: vscode.Uri): Promise<FrontMatterData> {
	if (!uri || typeof uri.path !== 'string') {
		return { title: null, description: null };
	}

	try {
		// Only process Markdown and MDX files
		const ext = getFileExtension(uri.path);
		if (!FRONT_MATTER_EXTENSIONS.includes(ext)) {
			return { title: null, description: null };
		}

		const contentBytes = await vscode.workspace.fs.readFile(uri);
		const content = new TextDecoder().decode(contentBytes);

		const data = parseFrontMatter(content);

		return {
			title: readStringField(data, 'title'),
			description: readStringField(data, 'description'),
		};
	} catch (error: any) {
		if (MISSING_FILE_CODES.has(error?.code)) {
			return { title: null, description: null };
		}

		// Log at error level to aid troubleshooting without disrupting extension behavior
		console.error('[WorkspaceWiki] Failed to extract front matter for file:', uri.toString(), error);
		return { title: null, description: null };
	}
}

/**
 * Extracts title from YAML front matter in a Markdown or MDX file.
 *
 * @param uri - The URI of the Markdown or MDX file
 * @returns Promise resolving to the front matter `title`, or null when absent
 */
export async function extractFrontMatterTitle(uri: vscode.Uri): Promise<string | null> {
	const frontMatter = await extractFrontMatter(uri);
	return frontMatter.title;
}

/**
 * Removes a trailing extension from a file name.
 *
 * Any extension is removed rather than a known list of them, so a file reaching the tree through
 * `includeGlobs` (`doc.go`) reads the same as one reaching it through `supportedExtensions`.
 *
 * @param fileName The file name to trim
 * @returns The name without its extension, or the name unchanged when there is nothing left to keep (`.env`)
 */
function removeExtension(fileName: string): string {
	const extension = getFileExtension(fileName);
	if (!extension) {
		return fileName;
	}

	const trimmed = fileName.slice(0, -(extension.length + 1));
	return trimmed || fileName;
}

/**
 * Convert file name to human-readable title
 * e.g. "gettingStarted.md" -> "Getting Started"
 * Applies acronym casing from settings for common technical terms
 *
 * @param fileName The file name to convert (extension is stripped)
 * @param acronyms Acronyms to preserve in their given casing (e.g. `['API', 'HTML']`); defaults to none
 * @param stripExtension Whether a trailing extension is removed; pass `false` for a folder name, where
 * the text after a dot is part of the name (`docs.v2`) rather than an extension
 * @returns The title-cased name (`'README'` for README files), or `''` for invalid input
 */
export function normalizeTitle(fileName: string, acronyms: string[] = [], stripExtension: boolean = true): string {
	if (!fileName || typeof fileName !== 'string') {
		return '';
	}

	const nameWithoutExt = stripExtension ? removeExtension(fileName) : fileName;

	// Handle special cases
	if (nameWithoutExt.toLowerCase() === 'readme') {
		return 'README';
	}

	// Apply acronym casing early, before other transformations
	let processedName = nameWithoutExt;
	if (acronyms.length > 0) {
		// Create a regex pattern to match any acronym as a whole word (case-insensitive)
		const acronymMap = new Map(acronyms.map((acronym) => [acronym.toLowerCase(), acronym]));

		// Replace whole word matches first, handling kebab/snake case
		processedName = processedName.replace(/\b[\w-]+\b/g, (word) => {
			// Try to find a matching acronym for this word (without separators)
			const cleanWord = word.replace(/[-_]/g, '').toLowerCase();
			const matchingAcronym = acronymMap.get(cleanWord);
			if (matchingAcronym) {
				return matchingAcronym;
			}
			return word;
		});
	}

	// Convert camelCase to Title Case
	let result = processedName
		.replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
		.replace(/[-_]/g, ' ') // kebab-case and snake_case
		.replace(/\b\w/g, (l) => l.toUpperCase()) // Title Case
		.trim();

	// Apply acronym casing again to ensure proper casing after transformations
	if (acronyms.length > 0) {
		const words = result.split(/\s+/);
		result = words
			.map((word) => {
				// Check if this word matches any acronym (case-insensitive)
				const matchingAcronym = acronyms.find((acronym) => acronym.toLowerCase() === word.toLowerCase());
				return matchingAcronym || word;
			})
			.join(' ');
	}

	return result;
}

/**
 * Extracts file extension from a file name or path
 *
 * The extension is looked for in the final path segment only, so a dotted directory name
 * (`/docs.v2/README`) does not produce a spurious extension.
 *
 * @param fileName The file name or path
 * @returns The lowercase extension without the dot, or `''` when there is none
 */
export function getFileExtension(fileName: string): string {
	if (!fileName || typeof fileName !== 'string') {
		return '';
	}

	const baseName = fileName.split(/[/\\]/).pop() ?? '';
	const match = baseName.match(/\.([^.]+)$/);
	return match ? match[1].toLowerCase() : '';
}

/**
 * Checks if a file name represents an index file
 *
 * @param fileName The file name to check
 * @returns `true` if the name starts with `index.` (case-insensitive)
 */
export function isIndexFile(fileName: string): boolean {
	if (!fileName || typeof fileName !== 'string') {
		return false;
	}

	return fileName.toLowerCase().startsWith('index.');
}

/**
 * Checks if a file name represents a README file
 *
 * An extensionless `README` counts: the scanner searches for those wherever Markdown is enabled, and
 * they carry the same meaning as `README.md`, so they earn the same first place in the tree.
 *
 * @param fileName The file name to check
 * @returns `true` if the name is `readme` or starts with `readme.` (case-insensitive)
 */
export function isReadmeFile(fileName: string): boolean {
	if (!fileName || typeof fileName !== 'string') {
		return false;
	}

	const name = fileName.toLowerCase();
	return name === 'readme' || name.startsWith('readme.');
}
