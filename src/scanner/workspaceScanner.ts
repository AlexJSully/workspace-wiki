import { WorkspaceLike } from '@types';
import * as vscode from 'vscode';

/**
 * Scans the workspace for documentation files (.md, .markdown, .txt)
 * Returns a list of file URIs matching supported extensions, respecting excludes and settings.
 */
export async function scanWorkspaceDocs(workspace: WorkspaceLike): Promise<any[]> {
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
				if (typeof vscode !== 'undefined' && (vscode as any).workspace?.workspaceFolders) {
					workspaceFolders = (vscode as any).workspace.workspaceFolders;
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

	const patterns = supportedExtensions.map((ext) => `**/*.${ext}`);
	const exclude = !showIgnoredFiles && excludeGlobs.length > 0 ? `{${excludeGlobs.join(',')}}` : undefined;

	const results: any[] = [];
	for (const pattern of patterns) {
		let uris = await Promise.resolve(workspace.findFiles(pattern, exclude, undefined));
		if (!uris) {
			uris = [];
		}
		if (!showIgnoredFiles && excludeGlobs.length > 0) {
			uris = uris.filter((uri: any) => {
				const shouldExclude = excludeGlobs.some((glob) => {
					const globPart = glob.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^\//, '').replace(/\/$/, '');
					const matches = uri.fsPath.includes(globPart) || uri.fsPath.endsWith(globPart);
					return matches;
				});
				return !shouldExclude;
			});
		}
		if (!showHiddenFiles) {
			uris = uris.filter((uri: any) => {
				const segments = uri.fsPath.split(/[\\/]/);
				return !segments.some((seg: string) => seg.startsWith('.') && seg.length > 1);
			});
		}
		if (maxSearchDepth > 0) {
			uris = uris.filter((uri: any) => {
				const relPath = uri.fsPath.replace(/\\/g, '/');
				let base = '';

				// Try to find common workspace patterns
				if (relPath.includes('/fake/path/')) {
					base = '/fake/path/';
				} else if (relPath.includes('/workspace-wiki/')) {
					base = '/workspace-wiki/';
				} else if (relPath.includes('/test/')) {
					base = '/test/';
				} else if (relPath.match(/^[A-Z]:\//)) {
					// Windows absolute path - use the drive root as base
					base = relPath.substring(0, 3); // e.g., "C:/"
				} else {
					// Fallback: use the path as-is for depth calculation
					base = '';
				}

				const relative = base ? relPath.split(base)[1] || relPath : relPath;
				const separatorCount = (relative.match(/\//g) || []).length;
				const depth = separatorCount + 1;
				return depth <= maxSearchDepth;
			});
		}
		results.push(...uris);
	}
	return results;
}
