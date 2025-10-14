// Jest configuration for VS Code extension testing
import '@testing-library/jest-dom';

// Mock vscode module for Jest tests
jest.mock(
	'vscode',
	() => ({
		workspace: {
			findFiles: jest.fn(),
			getConfiguration: jest.fn(),
		},
		window: {
			registerTreeDataProvider: jest.fn(),
			createTreeView: jest.fn(),
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
	}),
	{ virtual: true },
);
