import {
	getAcronymCasing,
	getAutoRevealSettings,
	getDefaultOpenMode,
	getDirectorySort,
	getExcludePatterns,
	getMaxSearchDepth,
	getOpenWithSettings,
	getShowHiddenFiles,
	getShowIgnoredFiles,
	getSupportedExtensions,
	getWorkspaceWikiConfig,
	syncOpenWithToSupportedExtensions,
} from './configUtils';

// Override the vscode import
jest.mock(
	'vscode',
	() => ({
		workspace: {
			getConfiguration: jest.fn(() => ({
				get: jest.fn(),
				update: jest.fn(),
				inspect: jest.fn(),
				has: jest.fn(),
			})),
		},
		ConfigurationTarget: {
			Global: 1,
			Workspace: 2,
			WorkspaceFolder: 3,
		},
	}),
	{ virtual: true },
);

describe('configUtils', () => {
	const mockVscode = require('vscode') as any;
	const mockConfig = mockVscode.workspace.getConfiguration();

	beforeEach(() => {
		jest.clearAllMocks();
		mockConfig.get.mockClear();
		mockConfig.update.mockClear();
		mockVscode.workspace.getConfiguration.mockClear();
		mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);
	});

	describe('getWorkspaceWikiConfig', () => {
		it('should return workspace wiki configuration', () => {
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const config = getWorkspaceWikiConfig();

			expect(mockVscode.workspace.getConfiguration).toHaveBeenCalledWith('workspaceWiki');
			expect(config).toBe(mockConfig);
		});
	});

	describe('getSupportedExtensions', () => {
		it('should return configured supported extensions', () => {
			mockConfig.get.mockReturnValue(['md', 'txt', 'html']);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const extensions = getSupportedExtensions();

			expect(extensions).toEqual(['md', 'txt', 'html']);
			expect(mockConfig.get).toHaveBeenCalledWith('supportedExtensions');
		});

		it('should return default extensions when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const extensions = getSupportedExtensions();

			expect(extensions).toEqual(['md', 'markdown', 'txt']);
		});
	});

	describe('getExcludePatterns', () => {
		it('should return configured exclude patterns', () => {
			const customPatterns = ['**/build/**', '**/temp/**'];
			mockConfig.get.mockReturnValue(customPatterns);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const patterns = getExcludePatterns();

			expect(patterns).toEqual(customPatterns);
		});

		it('should return default exclude patterns when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const patterns = getExcludePatterns();

			expect(patterns).toEqual([
				'**/node_modules/**',
				'**/.git/**',
				'**/dist/**',
				'**/build/**',
				'**/out/**',
				'**/.vscode/**',
				'**/.vs/**',
				'**/target/**',
				'**/.next/**',
				'**/.nuxt/**',
				'**/coverage/**',
				'**/.nyc_output/**',
				'**/temp/**',
				'**/tmp/**',
				'**/.cache/**',
				'**/bin/**',
				'**/obj/**',
				'**/packages/**',
				'**/.angular/**',
				'**/vendor/**',
				'**/deps/**',
				'**/_site/**',
				'**/.jekyll-cache/**',
				'**/.sass-cache/**',
				'**/public/**',
				'**/.docusaurus/**',
				'**/docs/.vitepress/cache/**',
				'**/docs/.vitepress/dist/**',
			]);
		});
	});

	describe('getDirectorySort', () => {
		it('should return configured directory sort', () => {
			mockConfig.get.mockReturnValue('folders-first');
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const sort = getDirectorySort();

			expect(sort).toBe('folders-first');
		});

		it('should return default sort when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const sort = getDirectorySort();

			expect(sort).toBe('files-first');
		});
	});

	describe('getAcronymCasing', () => {
		it('should return configured acronym casing', () => {
			const acronyms = ['API', 'HTML', 'CSS'];
			mockConfig.get.mockReturnValue(acronyms);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const result = getAcronymCasing();

			expect(result).toEqual(acronyms);
		});

		it('should return empty array when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const result = getAcronymCasing();

			expect(result).toEqual([]);
		});
	});

	describe('getAutoRevealSettings', () => {
		it('should return configured auto-reveal settings', () => {
			mockConfig.get.mockImplementation((...args: unknown[]) => {
				const key = args[0] as string;
				if (key === 'autoReveal') {
					return false;
				}
				if (key === 'autoRevealDelay') {
					return 1000;
				}
				return undefined;
			});
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const settings = getAutoRevealSettings();

			expect(settings).toEqual({ enabled: false, delay: 1000 });
		});

		it('should return default auto-reveal settings when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const settings = getAutoRevealSettings();

			expect(settings).toEqual({ enabled: true, delay: 500 });
		});
	});

	describe('getOpenWithSettings', () => {
		it('should return configured open with settings', () => {
			const openWith = { md: 'markdown.preview', html: 'browser.open' };
			mockConfig.get.mockReturnValue(openWith);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const settings = getOpenWithSettings();

			expect(settings).toEqual(openWith);
		});

		it('should return default open with settings when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const settings = getOpenWithSettings();

			expect(settings).toEqual({
				md: 'markdown.showPreview',
				markdown: 'markdown.showPreview',
				txt: 'vscode.open',
			});
		});
	});

	describe('getDefaultOpenMode', () => {
		it('should return configured default open mode', () => {
			mockConfig.get.mockReturnValue('editor');
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const mode = getDefaultOpenMode();

			expect(mode).toBe('editor');
		});

		it('should return default open mode when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const mode = getDefaultOpenMode();

			expect(mode).toBe('preview');
		});
	});

	describe('getMaxSearchDepth', () => {
		it('should return configured max search depth', () => {
			mockConfig.get.mockReturnValue(5);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const depth = getMaxSearchDepth();

			expect(depth).toBe(5);
		});

		it('should return default max search depth when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const depth = getMaxSearchDepth();

			expect(depth).toBe(10);
		});
	});

	describe('getShowHiddenFiles', () => {
		it('should return configured show hidden files setting', () => {
			mockConfig.get.mockReturnValue(true);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const result = getShowHiddenFiles();

			expect(result).toBe(true);
		});

		it('should return default show hidden files setting when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const result = getShowHiddenFiles();

			expect(result).toBe(false);
		});
	});

	describe('getShowIgnoredFiles', () => {
		it('should return configured show ignored files setting', () => {
			mockConfig.get.mockReturnValue(true);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const result = getShowIgnoredFiles();

			expect(result).toBe(true);
		});

		it('should return default show ignored files setting when not configured', () => {
			mockConfig.get.mockReturnValue(undefined);
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			const result = getShowIgnoredFiles();

			expect(result).toBe(false);
		});
	});

	describe('syncOpenWithToSupportedExtensions', () => {
		it('should add openWith extensions to supportedExtensions', () => {
			mockConfig.get.mockImplementation((...args: unknown[]) => {
				const key = args[0] as string;
				if (key === 'openWith') {
					return { md: 'markdown.preview', html: 'browser.open', pdf: 'pdf.viewer' };
				}
				if (key === 'supportedExtensions') {
					return ['md', 'txt'];
				}
				return undefined;
			});
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			syncOpenWithToSupportedExtensions();

			expect(mockConfig.update).toHaveBeenCalledWith(
				'supportedExtensions',
				['md', 'txt', 'html', 'pdf'],
				2, // vscode.ConfigurationTarget.Workspace
			);
		});

		it('should not update when no new extensions', () => {
			mockConfig.get.mockImplementation((...args: unknown[]) => {
				const key = args[0] as string;
				if (key === 'openWith') {
					return { md: 'markdown.preview', txt: 'vscode.open' };
				}
				if (key === 'supportedExtensions') {
					return ['md', 'txt'];
				}
				return undefined;
			});
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			syncOpenWithToSupportedExtensions();

			expect(mockConfig.update).not.toHaveBeenCalled();
		});

		it('should handle empty openWith', () => {
			mockConfig.get.mockImplementation((...args: unknown[]) => {
				const key = args[0] as string;
				if (key === 'openWith') {
					return {};
				}
				if (key === 'supportedExtensions') {
					return ['md', 'txt'];
				}
				return undefined;
			});
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			syncOpenWithToSupportedExtensions();

			expect(mockConfig.update).not.toHaveBeenCalled();
		});

		it('should handle undefined supportedExtensions', () => {
			mockConfig.get.mockImplementation((...args: unknown[]) => {
				const key = args[0] as string;
				if (key === 'openWith') {
					return { md: 'markdown.preview', html: 'browser.open' };
				}
				if (key === 'supportedExtensions') {
					return undefined;
				}
				return undefined;
			});
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			syncOpenWithToSupportedExtensions();

			expect(mockConfig.update).toHaveBeenCalledWith(
				'supportedExtensions',
				['md', 'markdown', 'txt', 'html'],
				2, // vscode.ConfigurationTarget.Workspace
			);
		});

		it('should handle invalid supportedExtensions type', () => {
			mockConfig.get.mockImplementation((...args: unknown[]) => {
				const key = args[0] as string;
				if (key === 'openWith') {
					return { md: 'markdown.preview' };
				}
				if (key === 'supportedExtensions') {
					return 'invalid';
				}
				return undefined;
			});
			mockVscode.workspace.getConfiguration.mockReturnValue(mockConfig);

			syncOpenWithToSupportedExtensions();

			expect(mockConfig.update).toHaveBeenCalledWith(
				'supportedExtensions',
				['md', 'markdown', 'txt'],
				2, // vscode.ConfigurationTarget.Workspace
			);
		});
	});
});
