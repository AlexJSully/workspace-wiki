import type { TreeNode } from '@types';
import { createMockUri } from '../test/mocks';
import { SearchIndex, flattenFiles } from './search';

const node = (path: string, title: string): TreeNode => ({
	type: 'file',
	name: path.split('/').pop() ?? path,
	title,
	path,
	uri: createMockUri(`/workspace-root/${path}`),
});

describe('flattenFiles', () => {
	it('lists files depth first and skips folders', () => {
		const tree: TreeNode[] = [
			node('a.md', 'A'),
			{ ...node('docs', 'Docs'), type: 'folder', children: [node('docs/b.md', 'B'), node('docs/c.md', 'C')] },
		];

		expect(flattenFiles(tree).map((file) => file.title)).toEqual(['A', 'B', 'C']);
	});
});

describe('SearchIndex', () => {
	/** A reader over in-memory files keyed by path, counting reads. */
	function createReader(files: Record<string, string>) {
		return jest.fn(async (uri: { path: string }) => {
			const text = files[uri.path];
			if (text === undefined) {
				throw new Error(`missing ${uri.path}`);
			}
			return new TextEncoder().encode(text);
		});
	}

	it('reads nothing until the first search, then reads each document once', async () => {
		const readFile = createReader({ '/workspace-root/a.md': 'alpha', '/workspace-root/b.md': 'beta' });
		const index = new SearchIndex(readFile);
		index.setFiles([node('a.md', 'A'), node('b.md', 'B')]);

		expect(readFile).not.toHaveBeenCalled();

		await index.search('alpha');
		await index.search('beta');

		expect(readFile).toHaveBeenCalledTimes(2);
	});

	it('finds Markdown by its text rather than its syntax', async () => {
		const index = new SearchIndex(
			createReader({ '/workspace-root/a.md': '---\ntitle: x\n---\nSee [the guide](guide.md).' }),
		);
		index.setFiles([node('a.md', 'A')]);

		const [result] = await index.search('guide');

		expect(result.snippet).toBe('See the guide.');
		expect(await index.search('title')).toEqual([]);
	});

	it('finds a term past the 1 MB render limit', async () => {
		const large = `${'filler '.repeat(200_000)}needle at the end`;
		expect(new TextEncoder().encode(large).length).toBeGreaterThan(1024 * 1024);
		const index = new SearchIndex(createReader({ '/workspace-root/big.txt': large }));
		index.setFiles([node('big.txt', 'Big')]);

		const results = await index.search('needle');

		expect(results.map((result) => result.title)).toEqual(['Big']);
		expect(results[0].snippet).toContain('needle at the end');
	});

	it('keeps an unreadable document findable by title, and never reads images or binaries', async () => {
		const readFile = createReader({});
		const index = new SearchIndex(readFile);
		index.setFiles([node('gone.md', 'Gone'), node('logo.png', 'Logo'), node('manual.pdf', 'Manual')]);

		expect((await index.search('gone')).map((result) => result.title)).toEqual(['Gone']);
		expect(readFile).toHaveBeenCalledTimes(1);
	});

	it('re-reads every document after invalidation', async () => {
		const files = { '/workspace-root/a.md': 'old' };
		const readFile = createReader(files);
		const index = new SearchIndex(readFile);
		index.setFiles([node('a.md', 'A')]);
		await index.search('old');

		files['/workspace-root/a.md'] = 'new';
		index.invalidate();

		expect((await index.search('new')).map((result) => result.title)).toEqual(['A']);
	});

	it('updates one saved document in place', async () => {
		const files = { '/workspace-root/a.md': 'old', '/workspace-root/b.md': 'beta' };
		const readFile = createReader(files);
		const index = new SearchIndex(readFile);
		index.setFiles([node('a.md', 'A'), node('b.md', 'B')]);
		await index.search('old');

		files['/workspace-root/a.md'] = 'fresh';
		await index.update(createMockUri('/workspace-root/a.md'));

		expect((await index.search('fresh')).map((result) => result.title)).toEqual(['A']);
		expect(readFile).toHaveBeenCalledTimes(3);
	});

	it('ignores a save before the index is built, and of a file outside the wiki', async () => {
		const readFile = createReader({ '/workspace-root/a.md': 'alpha' });
		const index = new SearchIndex(readFile);
		index.setFiles([node('a.md', 'A')]);

		await index.update(createMockUri('/workspace-root/a.md'));
		await index.update(createMockUri('/workspace-root/other.md'));

		expect(readFile).not.toHaveBeenCalled();
	});

	it('discards a read that a refresh overtook', async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const files = { '/workspace-root/a.md': 'stale' };
		const readFile = jest.fn(async (uri: { path: string }) => {
			await gate;
			return new TextEncoder().encode(files[uri.path as keyof typeof files]);
		});
		const index = new SearchIndex(readFile);
		index.setFiles([node('a.md', 'A')]);

		const first = index.search('stale');
		index.invalidate();
		files['/workspace-root/a.md'] = 'current';
		release();
		await first;

		expect((await index.search('current')).map((result) => result.title)).toEqual(['A']);
	});
});
