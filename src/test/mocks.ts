/**
 * Shared mock utilities for Workspace Wiki tests
 */

export interface MockWorkspaceConfig {
	showHiddenFiles?: boolean;
	showIgnoredFiles?: boolean;
	excludeGlobs?: string[];
	supportedExtensions?: string[];
	maxSearchDepth?: number;
	defaultOpenMode?: string;
	directorySort?: string;
	acronymCasing?: string[];
}

export interface MockWorkspaceFiles {
	files?: Array<{ fsPath: string }>;
	pattern?: string;
	exclude?: string;
}

/**
 * Creates a mock workspace with configurable settings and file list
 *
 * @param config Configuration settings for the mock workspace
 * @param files File list and pattern matching configuration
 * @returns Mock workspace object compatible with WorkspaceLike interface
 */
export function createMockWorkspace(config: MockWorkspaceConfig = {}, files: MockWorkspaceFiles = {}) {
	const defaultFiles = [
		{ fsPath: '/workspace-root/.github/agents.md' },
		{ fsPath: '/workspace-root/docs/visible.md' },
		{ fsPath: '/workspace-root/.env' },
		{ fsPath: '/workspace-root/visible.txt' },
	];

	return {
		findFiles: async (_pattern: string, _exclude?: string) => files.files || defaultFiles,
		getConfiguration: (_section: string) => ({
			get: (key: string) => {
				switch (key) {
					case 'showHiddenFiles':
						return config.showHiddenFiles !== undefined ? config.showHiddenFiles : false;
					case 'showIgnoredFiles':
						return config.showIgnoredFiles !== undefined ? config.showIgnoredFiles : false;
					case 'excludeGlobs':
						return config.excludeGlobs || [];
					case 'supportedExtensions':
						return config.supportedExtensions || ['md', 'txt'];
					case 'maxSearchDepth':
						return config.maxSearchDepth !== undefined ? config.maxSearchDepth : 10;
					case 'defaultOpenMode':
						return config.defaultOpenMode || 'preview';
					case 'directorySort':
						return config.directorySort || 'files-first';
					case 'acronymCasing':
						return (
							config.acronymCasing || [
								'HTML',
								'CSS',
								'JS',
								'TS',
								'API',
								'URL',
								'JSON',
								'XML',
								'HTTP',
								'HTTPS',
								'REST',
								'SQL',
								'CSV',
								'FHIR',
							]
						);
					default:
						return undefined;
				}
			},
		}),
	};
}

/**
 * Creates a mock workspace specifically for hidden file testing
 *
 * @param showHiddenFiles Whether to show hidden files
 * @returns Mock workspace configured for hidden file tests
 */
export function createHiddenFilesMockWorkspace(showHiddenFiles: boolean) {
	return createMockWorkspace(
		{
			showHiddenFiles,
			excludeGlobs: [],
			supportedExtensions: ['md', 'txt'],
		},
		{
			files: [
				{ fsPath: '/workspace-root/.github/agents.md' },
				{ fsPath: '/workspace-root/docs/visible.md' },
				{ fsPath: '/workspace-root/.env' },
				{ fsPath: '/workspace-root/visible.txt' },
			],
		},
	);
}

/**
 * Creates a mock workspace for basic file discovery testing
 *
 * @param supportedExtensions Array of supported file extensions
 * @param excludeGlobs Array of exclude patterns
 * @returns Mock workspace configured for file discovery tests
 */
export function createFileDiscoveryMockWorkspace(
	supportedExtensions: string[] = ['md', 'txt'],
	excludeGlobs: string[] = [],
) {
	return createMockWorkspace({
		supportedExtensions,
		excludeGlobs,
	});
}
