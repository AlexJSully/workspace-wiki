// The `vscode` module only exists inside the extension host, so Jest needs a stand-in. `Uri` is
// the real implementation from `vscode-uri`, and `workspace.fs` reads from disk, so the front
// matter path is exercised rather than stubbed.
jest.mock(
	'vscode',
	() => {
		// Required inside the factory: jest.mock is hoisted above imports.
		const nodeFs = require('fs');
		const { URI, Utils } = require('vscode-uri');

		return {
			commands: {
				executeCommand: jest.fn(),
				registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			},
			workspace: {
				findFiles: jest.fn(),
				fs: {
					readFile: jest.fn(async (uri: any) => {
						try {
							return new Uint8Array(nodeFs.readFileSync(uri.fsPath));
						} catch (error: any) {
							// Surface the code VS Code's FileSystemError would use, so production
							// code's "missing file is not an error" branch is exercised for real.
							if (error?.code === 'ENOENT') {
								const notFound: any = new Error(`File not found: ${uri.toString()}`);
								notFound.code = 'FileNotFound';
								throw notFound;
							}
							throw error;
						}
					}),
				},
				// No settings defaults here: they would duplicate package.json and mask the production
				// fallbacks under test. Callers get whatever default they pass to `get`.
				getConfiguration: jest.fn().mockReturnValue({
					get: jest.fn().mockImplementation((_key: string, defaultValue?: any) => defaultValue),
				}),
				workspaceFolders: [{ uri: URI.file('/workspace-root'), name: 'workspace-root', index: 0 }],
				asRelativePath: jest.fn((pathOrUri: any, _includeWorkspaceFolder?: boolean) => {
					const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.path;
					return path.replace(/^\/workspace-root\/?/, '');
				}),
				getWorkspaceFolder: jest.fn(() => undefined),
				onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			},
			// Starts empty so a test that reads a contribution has to install the extension it expects,
			// rather than inheriting one and passing for the wrong reason. `setMockExtensions` sets it.
			extensions: {
				all: [] as unknown[],
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
						uri: URI.file('/test/file.md'),
					},
				},
				onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			},
			TreeItem: jest.fn().mockImplementation((label, state) => ({
				label,
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
			RelativePattern: jest.fn().mockImplementation(function (this: any, base: any, pattern: string) {
				this.baseUri = typeof base === 'string' ? URI.file(base) : (base.uri ?? base);
				this.base = this.baseUri.path;
				this.pattern = pattern;
			}),
			Uri: {
				file: jest.fn(URI.file),
				parse: jest.fn(URI.parse),
				joinPath: jest.fn(Utils.joinPath),
				from: jest.fn(URI.from),
			},
		};
	},
	{ virtual: true },
);
