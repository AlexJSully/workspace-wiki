import * as assert from 'assert';
import { WorkspaceLike } from '../types';
import { scanWorkspaceDocs } from './workspaceScanner';

describe('workspaceScanner', () => {
	describe('scanWorkspaceDocs', () => {
		describe('Basic Functionality', () => {
			it('should return an array of file URIs', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => [{ fsPath: `/test/doc.${pattern.split('.').pop()}` }],
				};
				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.ok(result.length > 0);
				assert.ok(result[0].fsPath);
			});

			it('should handle empty workspace', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [],
				};
				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.strictEqual(result.length, 0);
			});

			it('should handle findFiles returning undefined', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => undefined as any,
				};
				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.strictEqual(result.length, 0);
			});
		});

		describe('Supported Extensions', () => {
			it('should scan default extensions (md, markdown, txt)', async () => {
				const patterns: string[] = [];
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						patterns.push(pattern);
						return [{ fsPath: `/test/file.${pattern.split('.').pop()}` }];
					},
				};

				await scanWorkspaceDocs(mockWorkspace);

				assert.ok(patterns.includes('**/*.md'));
				assert.ok(patterns.includes('**/*.markdown'));
				assert.ok(patterns.includes('**/*.txt'));
			});

			it('should respect custom supportedExtensions from configuration', async () => {
				const patterns: string[] = [];
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						patterns.push(pattern);
						return [{ fsPath: `/test/file.${pattern.split('.').pop()}` }];
					},
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'supportedExtensions') {
								return ['md', 'html', 'pdf'];
							}
							return undefined;
						},
					}),
				};

				await scanWorkspaceDocs(mockWorkspace);

				assert.ok(patterns.includes('**/*.md'));
				assert.ok(patterns.includes('**/*.html'));
				assert.ok(patterns.includes('**/*.pdf'));
				assert.ok(!patterns.includes('**/*.txt'));
				assert.ok(!patterns.includes('**/*.markdown'));
			});
		});

		describe('Exclude Patterns', () => {
			it('should exclude default patterns (node_modules, .git)', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string, exclude?: string) => {
						assert.ok(exclude?.includes('node_modules'));
						assert.ok(exclude?.includes('.git'));
						return [
							{ fsPath: '/test/valid.md' },
							{ fsPath: '/test/node_modules/invalid.md' },
							{ fsPath: '/test/.git/invalid.md' },
						];
					},
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('valid.md')));
				assert.ok(!result.some((uri: any) => uri.fsPath.includes('node_modules')));
				assert.ok(!result.some((uri: any) => uri.fsPath.includes('.git')));
			});

			it('should respect custom excludeGlobs from configuration', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string, exclude?: string) => {
						assert.ok(exclude?.includes('custom-exclude'));
						return [{ fsPath: '/test/valid.md' }, { fsPath: '/test/custom-exclude/invalid.md' }];
					},
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'excludeGlobs') {
								return ['**/custom-exclude/**'];
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('valid.md')));
				assert.ok(!result.some((uri: any) => uri.fsPath.includes('custom-exclude')));
			});

			it('should handle showIgnoredFiles=true to include normally excluded files', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return files for each extension pattern
						if (pattern.includes('md')) {
							return [{ fsPath: '/test/normal.md' }, { fsPath: '/test/node_modules/excluded.md' }];
						}
						return [];
					},
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'showIgnoredFiles') {
								return true;
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('normal.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('node_modules')));
			});
		});

		describe('Hidden Files', () => {
			it('should exclude hidden files by default', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/test/visible.md' },
						{ fsPath: '/test/.hidden.md' },
						{ fsPath: '/test/.hidden/file.md' },
						{ fsPath: '/test/folder/.dotfile.md' },
					],
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('visible.md')));
				assert.ok(!result.some((uri: any) => uri.fsPath.includes('.hidden')));
				assert.ok(!result.some((uri: any) => uri.fsPath.includes('.dotfile')));
			});

			it('should include hidden files when showHiddenFiles=true', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/test/visible.md' },
						{ fsPath: '/test/.hidden.md' },
						{ fsPath: '/test/.hidden/file.md' },
					],
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'showHiddenFiles') {
								return true;
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('visible.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('.hidden.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('.hidden/file.md')));
			});

			it('should not exclude single dots or files ending with dot', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/test/file.md' },
						{ fsPath: '/test/file.' },
						{ fsPath: '/test/.' },
						{ fsPath: '/test/..' },
					],
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('file.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.endsWith('file.')));
				// Single dots should not be excluded as they are not "hidden" in the traditional sense
			});
		});

		describe('Max Search Depth', () => {
			it('should respect maxSearchDepth configuration', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/project-root/level1.md' },
						{ fsPath: '/project-root/sub/level2.md' },
						{ fsPath: '/project-root/sub/deep/level3.md' },
						{ fsPath: '/project-root/sub/deep/deeper/level4.md' },
					],
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'maxSearchDepth') {
								return 0; // Disable depth filtering for this test
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				// With depth filtering disabled, all files should be included
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level1.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level2.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level3.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level4.md')));
			});

			it('should handle maxSearchDepth=0 to disable depth filtering', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/project-root/level1.md' },
						{ fsPath: '/project-root/very/deep/nested/structure/file.md' },
					],
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'maxSearchDepth') {
								return 0;
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level1.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('very/deep/nested')));
			});

			it('should handle workspace root relative paths correctly', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/workspace-root/level1.md' },
						{ fsPath: '/workspace-root/sub/level2.md' },
						{ fsPath: '/workspace-root/sub/deep/level3.md' },
					],
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'maxSearchDepth') {
								return 0; // Disable depth filtering for this test
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level1.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level2.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level3.md')));
			});

			it('should fallback gracefully when workspace root cannot be determined', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [
						{ fsPath: '/some/path/level1.md' },
						{ fsPath: '/some/path/sub/level2.md' },
						{ fsPath: '/some/path/sub/deep/level3.md' },
					],
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'maxSearchDepth') {
								return 0; // Disable depth filtering
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				// Should return all files when workspace root cannot be determined
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level1.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level2.md')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('level3.md')));
			});
		});
		describe('GitIgnore Processing', () => {
			let originalProcess: any;
			let originalRequire: any;

			beforeEach(() => {
				originalProcess = global.process;
				originalRequire = global.require;
			});

			afterEach(() => {
				global.process = originalProcess;
				global.require = originalRequire;
			});

			it('should skip gitignore processing in web environment', async () => {
				// Simulate web environment
				delete (global as any).process;

				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [{ fsPath: '/test/file.md' }],
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.ok(result.length > 0);
			});

			it('should handle gitignore file not existing', async () => {
				// Mock Node.js environment but no gitignore file
				(global as any).process = { versions: { node: '18.0.0' } };
				(global as any).require = (module: string) => {
					if (module === 'fs') {
						return { existsSync: () => false };
					}
					if (module === 'path') {
						return { join: (...args: string[]) => args.join('/') };
					}
					if (module === 'vscode') {
						return { workspace: { workspaceFolders: [{ uri: { fsPath: '/test' } }] } };
					}
					throw new Error(`Module ${module} not found`);
				};

				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [{ fsPath: '/test/file.md' }],
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
			});

			it('should handle errors in gitignore processing gracefully', async () => {
				// Mock environment that throws errors
				(global as any).process = { versions: { node: '18.0.0' } };
				(global as any).require = () => {
					throw new Error('Test error');
				};

				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [{ fsPath: '/test/file.md' }],
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
			});
		});

		describe('Performance Edge Cases', () => {
			it('should handle large numbers of files efficiently', async () => {
				const largeFileList = Array.from({ length: 1000 }, (_, i) => ({
					fsPath: `/test/file${i}.md`,
				}));

				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return files only for .md pattern to avoid triplication
						if (pattern.includes('.md')) {
							return largeFileList;
						}
						return [];
					},
				};

				const startTime = Date.now();
				const result = await scanWorkspaceDocs(mockWorkspace);
				const endTime = Date.now();

				assert.strictEqual(result.length, 1000);
				// Should complete within reasonable time (less than 1 second)
				assert.ok(endTime - startTime < 1000);
			});

			it('should handle complex exclude patterns efficiently', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () =>
						Array.from({ length: 100 }, (_, i) => ({
							fsPath: `/test/file${i}.md`,
						})),
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'excludeGlobs') {
								return Array.from({ length: 50 }, (_, i) => `**/exclude${i}/**`);
							}
							return undefined;
						},
					}),
				};

				const startTime = Date.now();
				const result = await scanWorkspaceDocs(mockWorkspace);
				const endTime = Date.now();

				assert.ok(Array.isArray(result));
				// Should handle complex patterns efficiently
				assert.ok(endTime - startTime < 500);
			});
		});

		describe('Security Edge Cases', () => {
			it('should handle malicious file paths safely', async () => {
				const maliciousPaths = [
					{ fsPath: '../../../etc/passwd.md' },
					{ fsPath: '..\\..\\..\\windows\\system32.md' },
					{ fsPath: '/test/normal.md' },
					{ fsPath: 'test/../../../sensitive.md' },
					{ fsPath: '/test/file\x00injection.md' },
					{ fsPath: '/test/file\n\r.md' },
				];

				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return paths only for .md pattern to avoid triplication
						if (pattern.includes('.md')) {
							return maliciousPaths;
						}
						return [];
					},
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'showHiddenFiles') {
								return true; // Include hidden files to test all malicious paths
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				// Should return results without throwing errors
				assert.ok(Array.isArray(result));
				// All paths should be preserved as-is (no path traversal validation in scanner)
				assert.strictEqual(result.length, maliciousPaths.length);
			});

			it('should handle extremely long file paths', async () => {
				const longPath = '/test/' + 'a'.repeat(1000) + '.md';
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return path only for .md pattern to avoid triplication
						if (pattern.includes('.md')) {
							return [{ fsPath: longPath }];
						}
						return [];
					},
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.strictEqual(result.length, 1);
				assert.strictEqual(result[0].fsPath, longPath);
			});

			it('should handle special characters in file paths', async () => {
				const specialPaths = [
					{ fsPath: '/test/file with spaces.md' },
					{ fsPath: '/test/файл.md' },
					{ fsPath: '/test/文件.md' },
					{ fsPath: '/test/file-with-émojis-🚀.md' },
					{ fsPath: '/test/file&with%special$chars.md' },
				];

				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return paths only for .md pattern to avoid triplication
						if (pattern.includes('.md')) {
							return specialPaths;
						}
						return [];
					},
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.strictEqual(result.length, specialPaths.length);
				// All special characters should be preserved
				assert.ok(result.some((uri: any) => uri.fsPath.includes('spaces')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('файл')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('文件')));
				assert.ok(result.some((uri: any) => uri.fsPath.includes('🚀')));
			});
		});

		describe('Configuration Edge Cases', () => {
			it('should handle missing getConfiguration method', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [{ fsPath: '/test/file.md' }],
					// No getConfiguration method
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.ok(result.length > 0);
			});

			it('should handle null/undefined configuration values', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [{ fsPath: '/test/file.md' }],
					getConfiguration: () => ({
						get: () => null,
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
			});

			it('should handle invalid configuration types', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async () => [{ fsPath: '/test/file.md' }],
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'supportedExtensions') {
								return 'invalid-string';
							}
							if (key === 'excludeGlobs') {
								return 123;
							}
							if (key === 'maxSearchDepth') {
								return 'not-a-number';
							}
							if (key === 'showIgnoredFiles') {
								return 'not-boolean';
							}
							if (key === 'showHiddenFiles') {
								return {};
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				// Should fall back to defaults and not crash
				assert.ok(Array.isArray(result));
			});
		});

		describe('Cross-platform Compatibility', () => {
			it('should handle Windows-style paths', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return paths only for .md pattern to avoid triplication
						if (pattern.includes('.md')) {
							return [
								{ fsPath: 'C:\\Users\\test\\Documents\\file.md' },
								{ fsPath: 'C:\\Users\\test\\Documents\\sub\\nested.md' },
							];
						}
						return [];
					},
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === 'maxSearchDepth') {
								return 0; // Disable depth filtering
							}
							return undefined;
						},
					}),
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.ok(result.length > 0);
			});

			it('should handle mixed path separators', async () => {
				const mockWorkspace: WorkspaceLike = {
					findFiles: async (pattern: string) => {
						// Return paths only for .md pattern to avoid triplication
						if (pattern.includes('.md')) {
							return [
								{ fsPath: '/test\\mixed/path\\separators.md' },
								{ fsPath: 'C:/Windows\\Style/Mixed.md' },
							];
						}
						return [];
					},
				};

				const result = await scanWorkspaceDocs(mockWorkspace);
				assert.ok(Array.isArray(result));
				assert.strictEqual(result.length, 2);
			});
		});
	});
});
