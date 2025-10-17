// Jest configuration for VS Code extension testing
import '@testing-library/jest-dom';

// Mock vscode module for Jest tests
jest.mock(
	'vscode',
	() => ({
		commands: {
			executeCommand: jest.fn(),
			registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
		},
		workspace: {
			findFiles: jest.fn(),
			getConfiguration: jest.fn().mockReturnValue({
				get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
					// Return defaults for common configuration keys
					const defaults = {
						supportedExtensions: ['md', 'markdown', 'txt'],
						excludeGlobs: ['**/node_modules/**', '**/.git/**'],
						directorySort: 'readme-first',
						acronymCasing: [],
						autoReveal: true,
						autoRevealDelay: 500,
						openWith: {},
						defaultOpenMode: 'preview',
						maxSearchDepth: 10,
						showHiddenFiles: false,
						showIgnoredFiles: false,
					};
					return defaults[key as keyof typeof defaults] ?? defaultValue;
				}),
			}),
			onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() }),
		},
		window: {
			registerTreeDataProvider: jest.fn(),
			createTreeView: jest.fn().mockReturnValue({
				visible: true,
				reveal: jest.fn(),
				onDidChangeVisibility: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			}),
			activeTextEditor: {
				document: {
					uri: {
						fsPath: '/test/file.md',
					},
				},
			},
			onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() }),
		},
		TreeItem: jest.fn().mockImplementation((uri, state) => ({
			resourceUri: uri,
			collapsibleState: state,
		})),
		TreeItemCollapsibleState: {
			None: 0,
			Collapsed: 1,
			Expanded: 2,
		},
		EventEmitter: jest.fn().mockImplementation(() => ({
			event: jest.fn(),
			fire: jest.fn(),
			dispose: jest.fn(),
		})),
		Uri: {
			file: jest.fn((path: string) => ({ fsPath: path })),
			parse: jest.fn((path: string) => ({ fsPath: path })),
		},
	}),
	{ virtual: true },
);
