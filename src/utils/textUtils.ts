import * as fs from 'fs';
import matter from 'gray-matter';
import * as vscode from 'vscode';

/** Front matter data extracted from a markdown file */
export interface FrontMatterData {
	title: string | null;
	description: string | null;
}

/**
 * Extracts title and description from YAML front matter in a markdown file
 *
 * @param filePath - The path to the markdown file
 * @returns Promise resolving to the `title` and `description` from front matter, or nulls when absent, unreadable, or not a `.md`/`.markdown` file
 */
export async function extractFrontMatter(filePath: string): Promise<FrontMatterData> {
	if (!filePath || typeof filePath !== 'string') {
		return { title: null, description: null };
	}

	try {
		// Only process markdown files
		const ext = getFileExtension(filePath);
		if (!['md', 'markdown'].includes(ext.toLowerCase())) {
			return { title: null, description: null };
		}

		// Read file content using VS Code FS when available, otherwise fall back to Node.
		let content = '';
		const canUseVscodeFs =
			typeof vscode.workspace?.fs?.readFile === 'function' && typeof vscode.Uri?.file === 'function';

		if (canUseVscodeFs) {
			const contentBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
			content = Buffer.from(contentBytes).toString('utf8');
		} else {
			content = await fs.promises.readFile(filePath, 'utf8');
		}

		// Parse front matter
		const parsed = matter(content);

		// Extract title and description
		const title =
			parsed.data && typeof parsed.data.title === 'string' && parsed.data.title.trim()
				? parsed.data.title.trim()
				: null;

		const description =
			parsed.data && typeof parsed.data.description === 'string' && parsed.data.description.trim()
				? parsed.data.description.trim()
				: null;

		return { title, description };
	} catch (error: any) {
		if (error?.code === 'ENOENT') {
			return { title: null, description: null };
		}

		// Log at error level to aid troubleshooting without disrupting extension behavior
		console.error('[WorkspaceWiki] Failed to extract front matter for file:', filePath, error);
		return { title: null, description: null };
	}
}

/**
 * Extracts title from YAML front matter in a markdown file
 *
 * @param filePath - The path to the markdown file
 * @returns Promise resolving to the front matter `title`, or null when absent
 */
export async function extractFrontMatterTitle(filePath: string): Promise<string | null> {
	const frontMatter = await extractFrontMatter(filePath);
	return frontMatter.title;
}

/**
 * Convert file name to human-readable title
 * e.g. "gettingStarted.md" -> "Getting Started"
 * Applies acronym casing from settings for common technical terms
 *
 * @param fileName The file name to convert (extension is stripped)
 * @param acronyms Acronyms to preserve in their given casing (e.g. `['API', 'HTML']`); defaults to none
 * @returns The title-cased name (`'README'` for README files), or `''` for invalid input
 */
export function normalizeTitle(fileName: string, acronyms: string[] = []): string {
	if (!fileName || typeof fileName !== 'string') {
		return '';
	}

	const nameWithoutExt = fileName.replace(/\.(md|markdown|txt|(htm|html)|pdf|css|js|ts|json|xml)$/i, '');

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
 * @param fileName The file name or path
 * @returns The lowercase extension without the dot, or `''` when there is none
 */
export function getFileExtension(fileName: string): string {
	if (!fileName || typeof fileName !== 'string') {
		return '';
	}

	const match = fileName.match(/\.([^.]+)$/);
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
 * @param fileName The file name to check
 * @returns `true` if the name starts with `readme.` (case-insensitive)
 */
export function isReadmeFile(fileName: string): boolean {
	if (!fileName || typeof fileName !== 'string') {
		return false;
	}

	return fileName.toLowerCase().startsWith('readme.');
}
