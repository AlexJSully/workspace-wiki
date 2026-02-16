import * as vscode from 'vscode';

/**
 * Creates a properly typed mock vscode.Uri object for testing
 *
 * @param fsPath File system path for the mock URI
 * @returns Mock vscode.Uri object with all required methods
 */
export function createMockUri(fsPath: string): vscode.Uri {
	const uri: vscode.Uri = {
		fsPath,
		scheme: 'file',
		authority: '',
		path: fsPath,
		query: '',
		fragment: '',
		with: () => uri,
		toJSON: () => ({ fsPath, scheme: 'file', authority: '', path: fsPath, query: '', fragment: '' }),
	};
	return uri;
}

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
	files?: vscode.Uri[];
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
		createMockUri('/workspace-root/.github/agents.md'),
		createMockUri('/workspace-root/docs/visible.md'),
		createMockUri('/workspace-root/.env'),
		createMockUri('/workspace-root/visible.txt'),
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
 * Mock VS Code API for testing
 */
export const commands = {
	executeCommand: jest.fn(),
	registerCommand: jest.fn(),
};

export const window = {
	createTreeView: jest.fn(() => ({
		reveal: jest.fn(),
		dispose: jest.fn(),
	})),
	showInformationMessage: jest.fn(),
	showErrorMessage: jest.fn(),
	activeTextEditor: undefined,
	onDidChangeActiveTextEditor: jest.fn(),
};

export const workspace = {
	findFiles: jest.fn(),
	getConfiguration: jest.fn(() => ({
		get: jest.fn(),
	})),
	workspaceFolders: [{ uri: { fsPath: '/workspace-root' } }],
	onDidChangeConfiguration: jest.fn(),
};

export const TreeItemCollapsibleState = {
	None: 0,
	Collapsed: 1,
	Expanded: 2,
};

export const TreeItem = class {
	constructor(
		public label: string,
		public collapsibleState?: number,
	) {}
};

export const Uri = {
	file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file', path })),
};

export const EventEmitter = class {
	private listeners: any[] = [];

	fire(data: any) {
		this.listeners.forEach((listener) => listener(data));
	}

	get event() {
		return (listener: any) => {
			this.listeners.push(listener);
			return { dispose: () => {} };
		};
	}
};

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
				createMockUri('/workspace-root/.github/agents.md'),
				createMockUri('/workspace-root/docs/visible.md'),
				createMockUri('/workspace-root/.env'),
				createMockUri('/workspace-root/visible.txt'),
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
