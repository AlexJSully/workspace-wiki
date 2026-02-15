import { WorkspaceLike } from '@types';
import * as vscode from 'vscode';

/**
 * Scans the workspace for documentation files (.md, .markdown, .txt)
 * Returns a list of file URIs matching supported extensions, respecting excludes and settings.
 */
export async function scanWorkspaceDocs(workspace: WorkspaceLike): Promise<vscode.Uri[]> {
	let supportedExtensions = ['md', 'markdown', 'txt'];
	let excludeGlobs: string[] = ['**/node_modules/**', '**/.git/**'];
	let maxSearchDepth = 10;
	let showIgnoredFiles = false;
	let showHiddenFiles = false;

	if (workspace.getConfiguration) {
		const config = workspace.getConfiguration('workspaceWiki');
		supportedExtensions = config.get('supportedExtensions') || supportedExtensions;
		excludeGlobs = config.get('excludeGlobs') || excludeGlobs;
		maxSearchDepth = config.get('maxSearchDepth') || maxSearchDepth;
		showIgnoredFiles = config.get('showIgnoredFiles') ?? false;
		showHiddenFiles = config.get('showHiddenFiles') ?? false;
	}

	if (!showIgnoredFiles) {
		try {
			if (typeof process !== 'undefined' && process.versions && process.versions.node) {
				const fs = require('fs');
				const path = require('path');
				let workspaceFolders;
				if (typeof vscode !== 'undefined' && vscode.workspace?.workspaceFolders) {
					workspaceFolders = vscode.workspace.workspaceFolders;
				} else {
					try {
						const vscodeModule = require('vscode');
						workspaceFolders = vscodeModule.workspace?.workspaceFolders;
					} catch {
						// In web environment, fs operations may not be available, continue without gitignore
					}
				}
				if (workspaceFolders && workspaceFolders.length > 0) {
					const gitignorePath = path.join(workspaceFolders[0].uri.fsPath, '.gitignore');
					if (fs.existsSync(gitignorePath)) {
						const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
						const gitignorePatterns = gitignoreContent
							.split('\n')
							.map((line: string) => line.trim())
							.filter((line: string) => line && !line.startsWith('#'))
							.map((line: string) => {
								if (line.endsWith('/')) {
									return `**/${line}**`;
								} else if (line.startsWith('/')) {
									return `**${line}${line.endsWith('/') ? '**' : ''}`;
								} else if (line.includes('*')) {
									return `**/${line}`;
								} else {
									return `**/${line}`;
								}
							});
						excludeGlobs = [...excludeGlobs, ...gitignorePatterns];
					}
				}
			} else {
				console.log('Workspace Wiki: Running in web environment, skipping .gitignore processing');
			}
		} catch (error) {
			console.warn('Workspace Wiki: Could not process .gitignore file:', error);
		}
	}

	// Type check and ensure supportedExtensions is an array
	if (!Array.isArray(supportedExtensions)) {
		supportedExtensions = ['md', 'markdown', 'txt']; // Fallback to defaults
	}

	// Add README (no extension) support if Markdown is enabled
	let patterns = supportedExtensions.map((ext) => `**/*.${ext}`);

	const markdownExts = ['md', 'markdown'];
	const hasMarkdown = supportedExtensions.some((ext) => markdownExts.includes(ext.toLowerCase()));

	if (hasMarkdown) {
		// README (no extension) at any depth, case-insensitive
		patterns.push('**/README');
		patterns.push('**/readme');
	}

	const exclude = !showIgnoredFiles && excludeGlobs.length > 0 ? `{${excludeGlobs.join(',')}}` : undefined;

	const results: vscode.Uri[] = [];
	for (const pattern of patterns) {
		let uris = (await workspace.findFiles(pattern, exclude, undefined)) as vscode.Uri[];
		if (!uris) {
			uris = [];
		}

		// For README (no extension), filter to only files named exactly 'README' (case-insensitive, no extension)
		if (pattern === '**/README' || pattern === '**/readme') {
			uris = uris.filter((uri: vscode.Uri) => {
				const fileName = uri.fsPath.split(/[\\\/]/).pop() || '';
				return /^readme$/i.test(fileName);
			});
		}

		if (!showIgnoredFiles && excludeGlobs.length > 0) {
			uris = uris.filter((uri: vscode.Uri) => {
				const shouldExclude = excludeGlobs.some((glob) => {
					const globPart = glob.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^\//, '').replace(/\/$/, '');
					const matches = uri.fsPath.includes(globPart) || uri.fsPath.endsWith(globPart);
					return matches;
				});
				return !shouldExclude;
			});
		}

		if (!showHiddenFiles) {
			uris = uris.filter((uri: vscode.Uri) => {
				const segments = uri.fsPath.split(/[\\\/]/);
				return !segments.some((seg: string) => seg.startsWith('.') && seg.length > 1);
			});
		}

		if (maxSearchDepth > 0) {
			uris = uris.filter((uri: vscode.Uri) => {
				const normalizedPath = uri.fsPath.replace(/\\/g, '/');

				// Get workspace root path for relative calculation
				let workspaceRoot = '';
				if (
					typeof vscode !== 'undefined' &&
					vscode.workspace?.workspaceFolders &&
					vscode.workspace.workspaceFolders.length > 0
				) {
					workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
				} else {
					try {
						const vscodeModule = require('vscode');
						if (
							vscodeModule.workspace?.workspaceFolders &&
							vscodeModule.workspace.workspaceFolders.length > 0
						) {
							workspaceRoot = vscodeModule.workspace.workspaceFolders[0].uri.fsPath.replace(/\\/g, '/');
						}
					} catch {
						// Fallback: calculate common base from all paths
						return true; // Skip depth filtering if we can't determine workspace root
					}
				}

				// Calculate relative path from workspace root
				let relativePath = normalizedPath;
				if (workspaceRoot && normalizedPath.startsWith(workspaceRoot)) {
					relativePath = normalizedPath.substring(workspaceRoot.length);
					// Remove leading slash if present
					if (relativePath.startsWith('/')) {
						relativePath = relativePath.substring(1);
					}
				}

				// Count directory separators to determine depth
				const separatorCount = relativePath ? (relativePath.match(/\//g) || []).length : 0;
				const depth = separatorCount + 1;
				return depth <= maxSearchDepth;
			});
		}
		results.push(...uris);
	}

	return results;
}
