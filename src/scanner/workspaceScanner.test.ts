import { createMockUri, createMockWorkspace } from '../test/mocks';
import { scanWorkspaceDocs } from './workspaceScanner';

/**
 * Collects the include patterns `scanWorkspaceDocs` searches with.
 *
 * @param supportedExtensions The extensions setting to apply, if any
 * @param includeGlobs The `includeGlobs` setting to apply, if any
 * @returns The patterns passed to `findFiles`, in order
 */
async function capturePatterns(supportedExtensions?: string[], includeGlobs?: string[]): Promise<string[]> {
	const patterns: string[] = [];
	const workspace = createMockWorkspace(
		{ supportedExtensions, includeGlobs },
		{
			files: (pattern) => {
				patterns.push(pattern);
				return [];
			},
		},
	);

	await scanWorkspaceDocs(workspace);
	return patterns;
}

/**
 * Runs a scan over a fixed document set.
 *
 * @param paths Paths the search should return for document patterns
 * @param config Settings overrides
 * @returns The resulting paths
 */
async function scanPaths(paths: string[], config: Parameters<typeof createMockWorkspace>[0] = {}): Promise<string[]> {
	const workspace = createMockWorkspace(config, {
		// Only answer the first document pattern, so a file is not counted once per extension.
		files: (pattern) => (pattern === '**/*.md' ? paths.map(createMockUri) : []),
	});

	const result = await scanWorkspaceDocs(workspace);
	return result.map((uri) => uri.path);
}

describe('workspaceScanner', () => {
	describe('scanWorkspaceDocs', () => {
		describe('Basic Functionality', () => {
			it('should return an array of file URIs', async () => {
				const workspace = createMockWorkspace(
					{},
					{ files: (pattern) => [createMockUri(`/test/doc.${pattern.split('.').pop()}`)] },
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBeGreaterThan(0);
				expect(result[0].path).toBeTruthy();
			});

			it('should handle empty workspace', async () => {
				const result = await scanWorkspaceDocs(createMockWorkspace({}, { files: () => [] }));

				expect(result).toEqual([]);
			});

			it('should handle findFiles returning undefined', async () => {
				const result = await scanWorkspaceDocs(createMockWorkspace({}, { files: () => undefined as any }));

				expect(result).toEqual([]);
			});
		});

		describe('Supported Extensions', () => {
			it('should include README (no extension) if Markdown is supported', async () => {
				const workspace = createMockWorkspace(
					{ supportedExtensions: ['md', 'markdown', 'txt'] },
					{
						files: (pattern) =>
							pattern === '**/README' || pattern === '**/readme'
								? [
										createMockUri('/project-root/README'),
										createMockUri('/project-root/docs/README'),
										createMockUri('/project-root/docs/readme'),
									]
								: [],
					},
				);

				const result = await scanWorkspaceDocs(workspace);
				const readmeFiles = result.filter((uri) => /README$/i.test(uri.path));

				expect(readmeFiles.length).toBeGreaterThanOrEqual(3);
			});

			it('should NOT include README (no extension) if Markdown is NOT supported', async () => {
				const patterns = await capturePatterns(['txt', 'html']);

				expect(patterns).not.toContain('**/README');
				expect(patterns).not.toContain('**/readme');
			});

			it('should scan default extensions (md, markdown, mdx, txt)', async () => {
				const patterns = await capturePatterns();

				expect(patterns).toEqual(expect.arrayContaining(['**/*.md', '**/*.markdown', '**/*.mdx', '**/*.txt']));
			});

			it('should include README (no extension) when only MDX is supported', async () => {
				const patterns = await capturePatterns(['mdx']);

				expect(patterns).toContain('**/README');
			});

			it('should respect custom supportedExtensions from configuration', async () => {
				const patterns = await capturePatterns(['md', 'html', 'pdf']);

				expect(patterns).toEqual(expect.arrayContaining(['**/*.md', '**/*.html', '**/*.pdf']));
				expect(patterns).not.toContain('**/*.txt');
				expect(patterns).not.toContain('**/*.markdown');
			});
		});

		describe('Include Globs', () => {
			it('should search no extra pattern when includeGlobs is unset', async () => {
				// `**/.gitignore` belongs to ignore-index discovery, not document discovery.
				const patterns = (await capturePatterns(['md'])).filter((pattern) => pattern !== '**/.gitignore');

				expect(patterns).toEqual(['**/*.md', '**/README', '**/readme']);
			});

			it('should search no extra pattern when includeGlobs is empty', async () => {
				const patterns = (await capturePatterns(['md'], [])).filter((pattern) => pattern !== '**/.gitignore');

				expect(patterns).toEqual(['**/*.md', '**/README', '**/readme']);
			});

			it('should search a bare file name at any depth', async () => {
				const patterns = await capturePatterns(['md'], ['doc.go']);

				expect(patterns).toContain('**/doc.go');
			});

			it('should search a bare wildcard name at any depth', async () => {
				const patterns = await capturePatterns(['md'], ['*.guide.ts']);

				expect(patterns).toContain('**/*.guide.ts');
			});

			it('should search a backslash-written path pattern with forward slashes', async () => {
				// findFiles only understands forward slashes, so a hand-typed Windows pattern has to
				// arrive normalized rather than as a bare name prefixed with `**/`.
				const patterns = await capturePatterns(['md'], ['docs\\notes\\*.adoc']);

				expect(patterns).toContain('docs/notes/*.adoc');
			});

			it('should pass a path-scoped pattern through unchanged', async () => {
				const patterns = await capturePatterns(['md'], ['docs/notes/*.adoc']);

				expect(patterns).toContain('docs/notes/*.adoc');
				expect(patterns).not.toContain('**/docs/notes/*.adoc');
			});

			it('should return files matched only by an include glob', async () => {
				const workspace = createMockWorkspace(
					{ supportedExtensions: ['md'], includeGlobs: ['doc.go'], excludeGlobs: [] },
					{
						files: (pattern) =>
							pattern === '**/doc.go' ? [createMockUri('/workspace-root/pkg/doc.go')] : [],
					},
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(result.map((uri) => uri.path)).toEqual(['/workspace-root/pkg/doc.go']);
			});

			it('should apply excludeGlobs to include glob matches', async () => {
				const workspace = createMockWorkspace(
					{ supportedExtensions: ['md'], includeGlobs: ['doc.go'], excludeGlobs: ['**/vendor/**'] },
					{
						files: (pattern) =>
							pattern === '**/doc.go'
								? [
										createMockUri('/workspace-root/pkg/doc.go'),
										createMockUri('/workspace-root/vendor/pkg/doc.go'),
									]
								: [],
					},
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(result.map((uri) => uri.path)).toEqual(['/workspace-root/pkg/doc.go']);
			});

			it('should apply the hidden-file rule to include glob matches', async () => {
				const workspace = createMockWorkspace(
					{ supportedExtensions: ['md'], includeGlobs: ['doc.go'], excludeGlobs: [] },
					{
						files: (pattern) =>
							pattern === '**/doc.go'
								? [
										createMockUri('/workspace-root/pkg/doc.go'),
										createMockUri('/workspace-root/.hidden/doc.go'),
									]
								: [],
					},
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(result.map((uri) => uri.path)).toEqual(['/workspace-root/pkg/doc.go']);
			});

			it('should apply maxSearchDepth to include glob matches', async () => {
				const workspace = createMockWorkspace(
					{ supportedExtensions: ['md'], includeGlobs: ['doc.go'], excludeGlobs: [], maxSearchDepth: 2 },
					{
						files: (pattern) =>
							pattern === '**/doc.go'
								? [
										createMockUri('/workspace-root/pkg/doc.go'),
										createMockUri('/workspace-root/pkg/nested/doc.go'),
									]
								: [],
					},
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(result.map((uri) => uri.path)).toEqual(['/workspace-root/pkg/doc.go']);
			});

			it('should return a file matched by two patterns only once', async () => {
				const guide = createMockUri('/workspace-root/docs/guide.md');
				const workspace = createMockWorkspace(
					{ supportedExtensions: ['md'], includeGlobs: ['*.md'], excludeGlobs: [] },
					{ files: (pattern) => (pattern === '**/*.md' ? [guide] : []) },
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(result.map((uri) => uri.path)).toEqual(['/workspace-root/docs/guide.md']);
			});
		});

		describe('Exclude Patterns', () => {
			it('should exclude default patterns (node_modules, .git)', async () => {
				const excludes: string[] = [];
				const workspace = createMockWorkspace(
					{},
					{
						files: (pattern, exclude) => {
							if (typeof exclude === 'string') {
								excludes.push(exclude);
							}
							return pattern === '**/*.md'
								? [
										createMockUri('/test/valid.md'),
										createMockUri('/test/node_modules/invalid.md'),
										createMockUri('/test/.git/invalid.md'),
									]
								: [];
						},
					},
				);

				const result = (await scanWorkspaceDocs(workspace)).map((uri) => uri.path);

				expect(excludes).toContain('{**/node_modules/**,**/.git/**}');
				expect(result).toContain('/test/valid.md');
				expect(result.some((path) => path.includes('node_modules'))).toBe(false);
				expect(result.some((path) => path.includes('.git/'))).toBe(false);
			});

			it('should respect custom excludeGlobs from configuration', async () => {
				const result = await scanPaths(['/test/valid.md', '/test/custom-exclude/invalid.md'], {
					excludeGlobs: ['**/custom-exclude/**'],
				});

				expect(result).toContain('/test/valid.md');
				expect(result.some((path) => path.includes('custom-exclude'))).toBe(false);
			});

			it('should handle showIgnoredFiles=true to include normally excluded files', async () => {
				const result = await scanPaths(['/test/normal.md', '/test/node_modules/excluded.md'], {
					showIgnoredFiles: true,
				});

				expect(result).toContain('/test/normal.md');
				expect(result).toContain('/test/node_modules/excluded.md');
			});
		});

		describe('GitIgnore Filtering', () => {
			/**
			 * Runs a scan against a workspace whose root carries a `.gitignore`.
			 *
			 * @param gitignore The `.gitignore` contents
			 * @param paths Document paths the search should return
			 * @param config Settings overrides
			 * @returns The resulting paths
			 */
			async function scanWithGitignore(
				gitignore: string,
				paths: string[],
				config: Parameters<typeof createMockWorkspace>[0] = {},
			): Promise<string[]> {
				const gitignoreUri = createMockUri('/workspace-root/.gitignore');
				const workspace = createMockWorkspace(config, {
					contents: { [gitignoreUri.toString()]: gitignore },
					files: (pattern) => {
						if (pattern === '**/.gitignore') {
							return [gitignoreUri];
						}
						return pattern === '**/*.md' ? paths.map(createMockUri) : [];
					},
				});

				const result = await scanWorkspaceDocs(workspace);
				return result.map((uri) => uri.path);
			}

			it('should drop files the workspace .gitignore names', async () => {
				const result = await scanWithGitignore('secret.md\n', [
					'/workspace-root/secret.md',
					'/workspace-root/public.md',
				]);

				expect(result).toEqual(['/workspace-root/public.md']);
			});

			it('should drop files beneath an ignored directory', async () => {
				const result = await scanWithGitignore('build/\n', [
					'/workspace-root/build/output.md',
					'/workspace-root/src/notes.md',
				]);

				expect(result).toEqual(['/workspace-root/src/notes.md']);
			});

			it('should keep a file a negation rule re-includes', async () => {
				const result = await scanWithGitignore('*.md\n!keep.md\n', [
					'/workspace-root/keep.md',
					'/workspace-root/drop.md',
				]);

				expect(result).toEqual(['/workspace-root/keep.md']);
			});

			it('should keep ignored files when showIgnoredFiles is true', async () => {
				const result = await scanWithGitignore(
					'secret.md\n',
					['/workspace-root/secret.md', '/workspace-root/public.md'],
					{ showIgnoredFiles: true },
				);

				expect(result).toContain('/workspace-root/secret.md');
			});
		});

		describe('Hidden Files', () => {
			it('should exclude hidden files by default', async () => {
				const result = await scanPaths([
					'/test/visible.md',
					'/test/.hidden.md',
					'/test/.hidden/file.md',
					'/test/folder/.dotfile.md',
				]);

				expect(result).toContain('/test/visible.md');
				expect(result.some((path) => path.includes('.hidden'))).toBe(false);
				expect(result.some((path) => path.includes('.dotfile'))).toBe(false);
			});

			it('should include hidden files when showHiddenFiles=true', async () => {
				const result = await scanPaths(['/test/visible.md', '/test/.hidden.md', '/test/.hidden/file.md'], {
					showHiddenFiles: true,
				});

				expect(result).toContain('/test/visible.md');
				expect(result).toContain('/test/.hidden.md');
				expect(result).toContain('/test/.hidden/file.md');
			});

			it('should not exclude single dots or files ending with dot', async () => {
				const result = await scanPaths(['/test/file.md', '/test/file.']);

				expect(result).toContain('/test/file.md');
				expect(result).toContain('/test/file.');
			});
		});

		describe('Max Search Depth', () => {
			it('should exclude files deeper than maxSearchDepth', async () => {
				const result = await scanPaths(
					[
						'/workspace-root/level1.md',
						'/workspace-root/sub/level2.md',
						'/workspace-root/sub/deep/level3.md',
					],
					{ maxSearchDepth: 2 },
				);

				expect(result).toEqual(['/workspace-root/level1.md', '/workspace-root/sub/level2.md']);
			});

			it('should handle maxSearchDepth=0 to disable depth filtering', async () => {
				const result = await scanPaths(
					['/workspace-root/level1.md', '/workspace-root/very/deep/nested/structure/file.md'],
					{ maxSearchDepth: 0 },
				);

				expect(result).toHaveLength(2);
			});

			it('should measure depth from the file’s own workspace folder in a multi-root workspace', async () => {
				// Root-relative depth: both files sit one level below their own folder, so a
				// maxSearchDepth of 1 must keep both even though the absolute paths differ in length.
				const workspace = createMockWorkspace(
					{ maxSearchDepth: 1 },
					{
						folders: [createMockUri('/folder-a'), createMockUri('/deeply/nested/folder-b')],
						files: (pattern) =>
							pattern === '**/*.md'
								? [
										createMockUri('/folder-a/notes.md'),
										createMockUri('/deeply/nested/folder-b/notes.md'),
									]
								: [],
					},
				);

				const result = await scanWorkspaceDocs(workspace);

				expect(result).toHaveLength(2);
			});

			it('should keep files when the workspace root cannot be determined', async () => {
				const result = await scanPaths(['/some/path/level1.md', '/some/path/sub/level2.md'], {
					maxSearchDepth: 0,
				});

				expect(result).toHaveLength(2);
			});
		});

		describe('Performance Edge Cases', () => {
			it('should handle large numbers of files efficiently', async () => {
				const largeFileList = Array.from({ length: 1000 }, (_, i) => `/test/file${i}.md`);

				const result = await scanPaths(largeFileList);

				expect(result).toHaveLength(1000);
			});

			it('should handle complex exclude patterns efficiently', async () => {
				const files = Array.from({ length: 100 }, (_, i) => `/test/file${i}.md`);
				const excludeGlobs = Array.from({ length: 50 }, (_, i) => `**/exclude${i}/**`);

				const result = await scanPaths(files, { excludeGlobs });

				expect(result).toHaveLength(100);
			});
		});

		describe('Security Edge Cases', () => {
			it('should pass unusual paths through unchanged', async () => {
				const maliciousPaths = [
					'../../../etc/passwd.md',
					'/test/normal.md',
					'test/../../../sensitive.md',
					'/test/file\x00injection.md',
					'/test/file\n\r.md',
				];

				const result = await scanPaths(maliciousPaths, { showHiddenFiles: true, maxSearchDepth: 0 });

				// Paths are passed through unchanged; the scanner does no traversal validation.
				expect(result).toHaveLength(maliciousPaths.length);
			});

			it('should handle extremely long file paths', async () => {
				const longPath = `/test/${'a'.repeat(1000)}.md`;

				const result = await scanPaths([longPath]);

				expect(result).toEqual([longPath]);
			});

			it('should handle special characters in file paths', async () => {
				const specialPaths = [
					'/test/file with spaces.md',
					'/test/файл.md',
					'/test/文件.md',
					'/test/file-with-émojis-🚀.md',
					'/test/file&with%special$chars.md',
				];

				const result = await scanPaths(specialPaths);

				expect(result).toEqual(specialPaths);
			});
		});

		describe('Configuration Edge Cases', () => {
			it('should handle missing getConfiguration method', async () => {
				const workspace = createMockWorkspace({}, { files: () => [createMockUri('/test/file.md')] });
				delete (workspace as any).getConfiguration;

				const result = await scanWorkspaceDocs(workspace);

				expect(result.length).toBeGreaterThan(0);
			});

			it('should fall back to defaults when every configuration value is null', async () => {
				const patterns: string[] = [];
				const workspace = createMockWorkspace(
					{},
					{
						files: (pattern) => {
							patterns.push(pattern);
							return [];
						},
					},
				);
				workspace.getConfiguration = () => ({ get: () => null });

				await scanWorkspaceDocs(workspace);

				expect(patterns).toEqual(expect.arrayContaining(['**/*.md', '**/*.markdown', '**/*.txt']));
			});

			it('should fall back to defaults for invalid configuration types', async () => {
				const patterns: string[] = [];
				const excludes: string[] = [];
				const workspace = createMockWorkspace(
					{},
					{
						files: (pattern, exclude) => {
							patterns.push(pattern);
							if (typeof exclude === 'string') {
								excludes.push(exclude);
							}
							return pattern === '**/*.md'
								? [createMockUri('/workspace-root/.hidden.md'), createMockUri('/workspace-root/ok.md')]
								: [];
						},
					},
				);
				workspace.getConfiguration = () => ({
					get: (key: string) => {
						const invalid: Record<string, unknown> = {
							supportedExtensions: 'invalid-string',
							excludeGlobs: 123,
							maxSearchDepth: 'not-a-number',
							showIgnoredFiles: 'not-boolean',
							showHiddenFiles: {},
						};
						return invalid[key];
					},
				});

				const result = await scanWorkspaceDocs(workspace);

				// Each malformed value must fall back rather than silently disable its filter.
				expect(patterns).toEqual(expect.arrayContaining(['**/*.md', '**/*.markdown', '**/*.txt']));
				expect(excludes).toContain('{**/node_modules/**,**/.git/**}');
				expect(result.map((uri) => uri.path)).toEqual(['/workspace-root/ok.md']);
			});
		});

		describe('Cross-platform Compatibility', () => {
			it('should handle drive-letter paths', async () => {
				// The path form Uri.file produces on Windows.
				const result = await scanPaths(
					['file:///c:/Users/test/Documents/file.md', 'file:///c:/Users/test/Documents/sub/nested.md'],
					{ maxSearchDepth: 0 },
				);

				expect(result).toEqual(['/c:/Users/test/Documents/file.md', '/c:/Users/test/Documents/sub/nested.md']);
			});

			it('should pass through paths the scanner cannot interpret as separators', async () => {
				// A backslash is a legal filename character outside Windows, so these stay one segment
				// each. The scanner must neither drop nor rewrite them.
				const result = await scanPaths(['/test/back\\slash.md', '/test/plain.md'], { maxSearchDepth: 0 });

				expect(result).toHaveLength(2);
				expect(result).toContain('/test/plain.md');
			});
		});
	});
});
