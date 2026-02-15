import matter from 'gray-matter';

/**
 * Extracts title from YAML front matter in a markdown file
 *
 * @param filePath - The path to the markdown file
 * @returns The title from front matter if exists, otherwise null
 */
export async function extractFrontMatterTitle(filePath: string): Promise<string | null> {
	if (!filePath || typeof filePath !== 'string') {
		return null;
	}

	try {
		// Only process markdown files
		const ext = getFileExtension(filePath);
		if (!['md', 'markdown'].includes(ext.toLowerCase())) {
			return null;
		}

		// Read file content
		// In VS Code extension context, we need to use VS Code's file system API
		// This function will be called from extension context with proper VS Code imports
		const fs = require('fs');
		const content = fs.readFileSync(filePath, 'utf8');

		// Parse front matter
		const parsed = matter(content);

		// Return title if exists in front matter data
		if (parsed.data && typeof parsed.data.title === 'string' && parsed.data.title.trim()) {
			return parsed.data.title.trim();
		}

		return null;
	} catch {
		// If file can't be read or parsed, return null
		return null;
	}
}

/**
 * Convert file name to human-readable title
 * e.g. "gettingStarted.md" -> "Getting Started"
 * Applies acronym casing from settings for common technical terms
 */
export function normalizeTitle(fileName: string, acronyms: string[] = []): string {
	if (!fileName || typeof fileName !== 'string') {
		return '';
	}

	/**
	 * nameWithoutExt:
	 * - Removes the file extension from the provided fileName using a regex.
	 * - Used to extract the base name for further normalization (e.g., converting to title case, handling acronyms).
	 * - Should include only the main part of the filename, excluding extensions like .md, .markdown, .txt, .htm, .html, .pdf, .css, .js, .ts, .json, .xml.
	 * - This is important for generating human-readable titles and for consistent handling of technical acronyms.
	 */
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
 */
export function isIndexFile(fileName: string): boolean {
	if (!fileName || typeof fileName !== 'string') {
		return false;
	}

	return fileName.toLowerCase().startsWith('index.');
}

/**
 * Checks if a file name represents a README file
 */
export function isReadmeFile(fileName: string): boolean {
	if (!fileName || typeof fileName !== 'string') {
		return false;
	}

	return fileName.toLowerCase().startsWith('readme.');
}

/**
 * Converts a string to snake_case
 */
export function toSnakeCase(str: string): string {
	if (!str || typeof str !== 'string') {
		return '';
	}

	return str
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.replace(/[\s-]+/g, '_')
		.toLowerCase();
}

/**
 * Converts a string to camelCase
 */
export function toCamelCase(str: string): string {
	if (!str || typeof str !== 'string') {
		return '';
	}

	return str
		.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
		.replace(/^[A-Z]/, (char) => char.toLowerCase());
}
