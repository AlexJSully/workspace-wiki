import { createMockUri, createMockWorkspace } from '../test/mocks';
import { buildIgnoreIndex } from './gitignore';

/**
 * Builds an index over a set of `.gitignore` files.
 *
 * @param gitignores Contents keyed by workspace-relative `.gitignore` path, e.g. `'.gitignore'` or `'docs/.gitignore'`
 * @param options Optional workspace roots and settings
 * @returns The built index
 */
async function indexFor(
	gitignores: Record<string, string>,
	options: { roots?: string[]; excludeGlobs?: string[] } = {},
) {
	const roots = options.roots ?? ['/workspace-root'];
	const contents: Record<string, string> = {};
	const discovered: string[] = [];

	for (const [relative, content] of Object.entries(gitignores)) {
		// Keys may be prefixed with a root to target a specific folder in multi-root tests.
		const root = roots.find((candidate) => relative.startsWith(`${candidate}/`));
		const path = root ? relative : `${roots[0]}/${relative}`;
		// Key the content map the way the workspace mock reads it, so a path needing
		// percent-encoding still resolves.
		contents[createMockUri(path).toString()] = content;
		discovered.push(path);
	}

	const workspace = createMockWorkspace(
		{ excludeGlobs: options.excludeGlobs ?? [] },
		{
			folders: roots.map(createMockUri),
			contents,
			// Return every known .gitignore; buildIgnoreIndex scopes them per folder itself.
			files: () => discovered.map(createMockUri),
		},
	);

	return buildIgnoreIndex(workspace, options.excludeGlobs ?? []);
}

describe('buildIgnoreIndex', () => {
	describe('basic matching', () => {
		it('ignores files matching a simple glob', async () => {
			const index = await indexFor({ '.gitignore': '*.log\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/debug.log'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/README.md'))).toBe(false);
		});

		it('ignores everything under a directory rule', async () => {
			const index = await indexFor({ '.gitignore': 'build/\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/build/a.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/build/deep/b.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/src/a.md'))).toBe(false);
		});

		it('skips comments and blank lines', async () => {
			const index = await indexFor({ '.gitignore': '# a comment\n\n*.tmp\n\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/a.tmp'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/comment'))).toBe(false);
		});
	});

	describe('negation', () => {
		it('re-includes a file excluded by an earlier rule', async () => {
			const index = await indexFor({ '.gitignore': '*.log\n!keep.log\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/debug.log'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/keep.log'))).toBe(false);
		});

		it('cannot re-include a file whose parent directory is ignored', async () => {
			// git: "It is not possible to re-include a file if a parent directory is excluded."
			const index = await indexFor({ '.gitignore': 'build/\n!build/keep.md\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/build/keep.md'))).toBe(true);
		});
	});

	describe('anchoring', () => {
		it('anchors a pattern containing a slash to the .gitignore directory', async () => {
			const index = await indexFor({ '.gitignore': 'docs/tmp\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/docs/tmp'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/sub/docs/tmp'))).toBe(false);
		});

		it('matches a slashless pattern at any depth', async () => {
			const index = await indexFor({ '.gitignore': 'tmp2\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/tmp2'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/sub/tmp2'))).toBe(true);
		});
	});

	describe('nested .gitignore files', () => {
		it('lets a deeper file re-include what a shallower one excluded', async () => {
			const index = await indexFor({
				'.gitignore': '*.md\n',
				'docs/.gitignore': '!notes.md\n',
			});

			expect(index.isIgnored(createMockUri('/workspace-root/docs/notes.md'))).toBe(false);
			expect(index.isIgnored(createMockUri('/workspace-root/docs/other.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/top.md'))).toBe(true);
		});

		it('scopes a nested file to its own directory', async () => {
			const index = await indexFor({ 'docs/.gitignore': 'draft.md\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/docs/draft.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/draft.md'))).toBe(false);
		});
	});

	describe('multi-root workspaces', () => {
		it('does not let one folder’s rules filter another', async () => {
			const index = await indexFor(
				{ '/folder-a/.gitignore': 'secret.md\n' },
				{ roots: ['/folder-a', '/folder-b'] },
			);

			expect(index.isIgnored(createMockUri('/folder-a/secret.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/folder-b/secret.md'))).toBe(false);
		});

		it('attributes a file to the innermost workspace folder containing it', async () => {
			const index = await indexFor(
				{
					'/outer/.gitignore': 'notes.md\n',
					'/outer/inner/.gitignore': '!notes.md\n',
				},
				{ roots: ['/outer', '/outer/inner'] },
			);

			// /outer/inner is its own root, so /outer's rules must not reach into it.
			expect(index.isIgnored(createMockUri('/outer/inner/notes.md'))).toBe(false);
			expect(index.isIgnored(createMockUri('/outer/notes.md'))).toBe(true);
		});

		it('does not match a sibling folder sharing a name prefix', async () => {
			const index = await indexFor({ '/app/.gitignore': 'notes.md\n' }, { roots: ['/app'] });

			expect(index.isIgnored(createMockUri('/app/notes.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/application/notes.md'))).toBe(false);
		});
	});

	describe('paths needing percent-encoding', () => {
		// `Uri.toString()` encodes aggressively, so deriving a path from it yields `my%20docs`,
		// which no rule written `my docs/` can match. These fail if the index reads toString().
		it('matches a rule naming a folder with a space in it', async () => {
			const index = await indexFor({ '.gitignore': 'my docs/\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/my docs/notes.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/workspace-root/other/notes.md'))).toBe(false);
		});

		it('matches a rule naming a non-ASCII file', async () => {
			const index = await indexFor({ '.gitignore': 'файл.md\n' });

			expect(index.isIgnored(createMockUri('/workspace-root/файл.md'))).toBe(true);
		});

		it('resolves a nested .gitignore whose directory contains a space', async () => {
			const index = await indexFor({
				'.gitignore': '*.md\n',
				'my docs/.gitignore': '!keep.md\n',
			});

			expect(index.isIgnored(createMockUri('/workspace-root/my docs/keep.md'))).toBe(false);
			expect(index.isIgnored(createMockUri('/workspace-root/my docs/other.md'))).toBe(true);
		});

		it('attributes a URI to a workspace folder whose path contains a space', async () => {
			const index = await indexFor({ '/my project/.gitignore': 'secret.md\n' }, { roots: ['/my project'] });

			expect(index.isIgnored(createMockUri('/my project/secret.md'))).toBe(true);
			expect(index.isIgnored(createMockUri('/my project/public.md'))).toBe(false);
		});
	});

	describe('robustness', () => {
		it('does not throw on paths the matcher considers invalid', async () => {
			// `ignore` raises a RangeError for these unless allowRelativePaths is set. isIgnored runs
			// inside an unguarded filter, so a throw would empty the tree rather than misjudge a file.
			const index = await indexFor({ '.gitignore': '*.md\n' });

			for (const path of ['/workspace-root/.', '/workspace-root/..', '/workspace-root/../x']) {
				expect(() => index.isIgnored(createMockUri(path))).not.toThrow();
			}
		});

		it('ignores nothing when no .gitignore exists', async () => {
			const index = await indexFor({});

			expect(index.isIgnored(createMockUri('/workspace-root/anything.md'))).toBe(false);
		});

		it('does not warn when a .gitignore is simply absent', async () => {
			const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

			await indexFor({});

			expect(warnSpy).not.toHaveBeenCalled();
			warnSpy.mockRestore();
		});

		it('ignores nothing when the workspace has no folders', async () => {
			const workspace = createMockWorkspace({}, { folders: [] });
			const index = await buildIgnoreIndex(workspace, []);

			expect(index.isIgnored(createMockUri('/anywhere/file.md'))).toBe(false);
		});

		it('ignores nothing for a URI outside every workspace folder', async () => {
			const index = await indexFor({ '.gitignore': '*.md\n' });

			expect(index.isIgnored(createMockUri('/elsewhere/file.md'))).toBe(false);
		});

		it('applies rules on a virtual file system scheme', async () => {
			// A non-file scheme must still resolve relative paths and match rules.
			const root = 'vscode-vfs://github/owner/repo';
			const workspace = createMockWorkspace(
				{},
				{
					folders: [createMockUri(root)],
					contents: { [`${root}/.gitignore`]: 'build/\n!keep.md\n' },
					files: () => [createMockUri(`${root}/.gitignore`)],
				},
			);
			const index = await buildIgnoreIndex(workspace, []);

			expect(index.isIgnored(createMockUri(`${root}/build/a.md`))).toBe(true);
			expect(index.isIgnored(createMockUri(`${root}/docs/a.md`))).toBe(false);
			expect(index.isIgnored(createMockUri(`${root}/keep.md`))).toBe(false);
		});
	});
});
