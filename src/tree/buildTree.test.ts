/**
 * Unit tests for buildTree.ts
 */
import { buildTree, processNode, sortNodes } from '../tree/buildTree';
import { normalizeTitle } from '../utils';

// Create a mock TreeNode interface for testing
interface MockTreeNode {
	type: 'file' | 'folder';
	name: string;
	title: string;
	path: string;
	uri?: any;
	children?: MockTreeNode[];
	isIndex?: boolean;
	isReadme?: boolean;
}

// Mock URI objects for testing
const createMockUri = (fsPath: string) => ({
	fsPath,
	scheme: 'file',
	authority: '',
	path: fsPath,
	query: '',
	fragment: '',
});

describe('normalizeTitle', () => {
	describe('basic functionality', () => {
		it('should handle empty or invalid input', () => {
			expect(normalizeTitle('')).toBe('');
			expect(normalizeTitle(null as any)).toBe('');
			expect(normalizeTitle(undefined as any)).toBe('');
			expect(normalizeTitle(123 as any)).toBe('');
		});

		it('should remove common file extensions', () => {
			expect(normalizeTitle('test.md')).toBe('Test');
			expect(normalizeTitle('test.markdown')).toBe('Test');
			expect(normalizeTitle('test.txt')).toBe('Test');
			expect(normalizeTitle('test.html')).toBe('Test');
			expect(normalizeTitle('test.htm')).toBe('Test');
			expect(normalizeTitle('test.pdf')).toBe('Test');
			expect(normalizeTitle('test.css')).toBe('Test');
			expect(normalizeTitle('test.js')).toBe('Test');
			expect(normalizeTitle('test.ts')).toBe('Test');
			expect(normalizeTitle('test.json')).toBe('Test');
			expect(normalizeTitle('test.xml')).toBe('Test');
		});

		it('should handle special case for README files', () => {
			expect(normalizeTitle('readme')).toBe('README');
			expect(normalizeTitle('README')).toBe('README');
			expect(normalizeTitle('Readme')).toBe('README');
			expect(normalizeTitle('readme.md')).toBe('README');
			expect(normalizeTitle('README.markdown')).toBe('README');
		});
	});

	describe('case conversion', () => {
		it('should convert camelCase to Title Case', () => {
			expect(normalizeTitle('gettingStarted')).toBe('Getting Started');
			expect(normalizeTitle('myTestFile')).toBe('My Test File');
			expect(normalizeTitle('apiReference')).toBe('Api Reference');
		});

		it('should convert kebab-case to Title Case', () => {
			expect(normalizeTitle('getting-started')).toBe('Getting Started');
			expect(normalizeTitle('my-test-file')).toBe('My Test File');
			expect(normalizeTitle('api-reference')).toBe('Api Reference');
		});

		it('should convert snake_case to Title Case', () => {
			expect(normalizeTitle('getting_started')).toBe('Getting Started');
			expect(normalizeTitle('my_test_file')).toBe('My Test File');
			expect(normalizeTitle('api_reference')).toBe('Api Reference');
		});

		it('should handle mixed case patterns', () => {
			expect(normalizeTitle('myFile_withMixed-cases')).toBe('My File With Mixed Cases');
			expect(normalizeTitle('API_endpointFor-users')).toBe('API Endpoint For Users');
		});
	});

	describe('acronym handling', () => {
		it('should apply acronym casing correctly', () => {
			const acronyms = ['API', 'HTTP', 'JSON', 'HTML', 'CSS'];
			expect(normalizeTitle('api-reference', acronyms)).toBe('API Reference');
			expect(normalizeTitle('httpClient', acronyms)).toBe('HTTP Client');
			expect(normalizeTitle('json_parser', acronyms)).toBe('JSON Parser');
			expect(normalizeTitle('html-templates', acronyms)).toBe('HTML Templates');
		});

		it('should handle acronyms in mixed case scenarios', () => {
			const acronyms = ['API', 'REST', 'JSON'];
			expect(normalizeTitle('restApiClient', acronyms)).toBe('REST API Client');
			expect(normalizeTitle('json_rest_api', acronyms)).toBe('JSON REST API');
		});

		it('should preserve acronym casing after transformations', () => {
			const acronyms = ['UI', 'UX', 'API'];
			expect(normalizeTitle('uiUxDesign', acronyms)).toBe('UI UX Design');
			expect(normalizeTitle('api-ui-guide', acronyms)).toBe('API UI Guide');
		});

		it('should work with empty acronyms array', () => {
			expect(normalizeTitle('apiReference', [])).toBe('Api Reference');
			expect(normalizeTitle('httpClient')).toBe('Http Client');
		});
	});

	describe('edge cases', () => {
		it('should handle single words', () => {
			expect(normalizeTitle('test')).toBe('Test');
			expect(normalizeTitle('documentation')).toBe('Documentation');
		});

		it('should handle files without extensions', () => {
			expect(normalizeTitle('makefile')).toBe('Makefile');
			expect(normalizeTitle('dockerfile')).toBe('Dockerfile');
		});

		it('should handle multiple dots in filename', () => {
			expect(normalizeTitle('test.config.js')).toBe('Test.Config');
			expect(normalizeTitle('my.component.test')).toBe('My.Component.Test');
		});

		it('should trim whitespace', () => {
			expect(normalizeTitle('  test  ')).toBe('Test');
			expect(normalizeTitle('test-file  .md')).toBe('Test File');
		});
	});
});

describe('buildTree', () => {
	describe('basic functionality', () => {
		it('should return empty array for empty input', () => {
			const result = buildTree([]);
			expect(result).toEqual([]);
		});

		it('should handle single file at root level', () => {
			const uris = [createMockUri('/workspace-root/test.md')];
			const result = buildTree(uris);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				type: 'file',
				name: 'test.md',
				title: 'Test',
				path: '/workspace-root/test.md',
				isIndex: false,
				isReadme: false,
			});
		});

		it('should handle multiple files at root level', () => {
			const uris = [createMockUri('/workspace-root/first.md'), createMockUri('/workspace-root/second.md')];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('first.md');
			expect(result[1].name).toBe('second.md');
		});
	});

	describe('folder structure', () => {
		it('should create folder structure for nested files', () => {
			const uris = [
				createMockUri('/workspace-root/docs/getting-started.md'),
				createMockUri('/workspace-root/docs/api/reference.md'),
			];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			// First item should be the file at docs level
			expect(result[0]).toMatchObject({
				type: 'file',
				name: 'getting-started.md',
				title: 'Getting Started',
			});
			// Second item should be the api folder
			expect(result[1]).toMatchObject({
				type: 'folder',
				name: 'api',
				title: 'Api',
				path: 'api',
			});
			expect(result[1].children).toHaveLength(1);
		});

		it('should handle deeply nested folder structures', () => {
			const uris = [
				createMockUri('/workspace-root/docs/api/v1/users.md'),
				createMockUri('/workspace-root/docs/api/v2/users.md'),
			];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			const v1Folder = result[0];
			const v2Folder = result[1];
			expect(v1Folder.name).toBe('v1');
			expect(v2Folder.name).toBe('v2');
			expect(v1Folder.children).toHaveLength(1);
			expect(v2Folder.children).toHaveLength(1);
		});
	});

	describe('special files', () => {
		it('should identify README files correctly', () => {
			const uris = [createMockUri('/workspace-root/README.md'), createMockUri('/workspace-root/readme.txt')];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			expect(result[0].isReadme).toBe(true);
			expect(result[1].isReadme).toBe(true);
		});

		it('should identify index files correctly', () => {
			const uris = [createMockUri('/workspace-root/index.md'), createMockUri('/workspace-root/docs/index.md')];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			expect(result[0].isIndex).toBe(true);

			// Check the nested index file
			const docsFolder = result[1];
			expect(docsFolder.children![0].isIndex).toBe(true);
		});
	});

	describe('sorting functionality', () => {
		it('should sort README files first by default', () => {
			const uris = [
				createMockUri('/workspace-root/zebra.md'),
				createMockUri('/workspace-root/README.md'),
				createMockUri('/workspace-root/alpha.md'),
			];
			const result = buildTree(uris);

			expect(result).toHaveLength(3);
			expect(result[0].name).toBe('README.md');
			expect(result[0].isReadme).toBe(true);
		});

		it('should sort files first when directorySort is "files-first"', () => {
			const uris = [
				createMockUri('/workspace-root/docs/guide.md'),
				createMockUri('/workspace-root/test.md'),
				createMockUri('/workspace-root/nested/file.md'),
			];
			const result = buildTree(uris, 'files-first');

			expect(result).toHaveLength(3);
			expect(result[0].type).toBe('file'); // test.md
			expect(result[1].type).toBe('folder'); // docs
			expect(result[2].type).toBe('folder'); // nested
		});

		it('should sort folders first when directorySort is "folders-first"', () => {
			const uris = [
				createMockUri('/workspace-root/docs/guide.md'),
				createMockUri('/workspace-root/test.md'),
				createMockUri('/workspace-root/nested/file.md'),
			];
			const result = buildTree(uris, 'folders-first');

			expect(result).toHaveLength(3);
			expect(result[0].type).toBe('folder'); // docs
			expect(result[1].type).toBe('folder'); // nested
			expect(result[2].type).toBe('file'); // test.md
		});

		it('should sort alphabetically when directorySort is "alphabetical"', () => {
			const uris = [
				createMockUri('/workspace-root/zebra.md'),
				createMockUri('/workspace-root/alpha.md'),
				createMockUri('/workspace-root/beta/file.md'),
			];
			const result = buildTree(uris, 'alphabetical');

			expect(result).toHaveLength(3);
			expect(result[0].title).toBe('Alpha');
			expect(result[1].title).toBe('Beta');
			expect(result[2].title).toBe('Zebra');
		});
	});

	describe('acronym integration', () => {
		it('should apply acronyms to file and folder titles', () => {
			const acronyms = ['API', 'REST'];
			const uris = [createMockUri('/workspace-root/api-docs/rest-guide.md')];
			const result = buildTree(uris, 'files-first', acronyms);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('REST Guide');
		});
	});

	describe('path handling', () => {
		it('should handle different path separators', () => {
			const uris = [{ fsPath: '/workspace-root/docs/test.md' }, { fsPath: '/workspace-root\\docs\\guide.md' }];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			// The backslash path is treated as a different structure
			expect(result[0].name).toBe('workspace-root\\docs\\guide.md');
			expect(result[1].name).toBe('workspace-root');
		});

		it('should find common base path correctly', () => {
			const uris = [
				createMockUri('/very/long/common/path/docs/test.md'),
				createMockUri('/very/long/common/path/guides/guide.md'),
			];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('docs');
			expect(result[1].name).toBe('guides');
		});

		it('should handle files with no common base path', () => {
			const uris = [createMockUri('/different/path/test.md'), createMockUri('/another/path/guide.md')];
			const result = buildTree(uris);

			// Should create appropriate folder structure
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('edge cases', () => {
		it('should handle files with empty names gracefully', () => {
			const uris = [{ fsPath: '/workspace-root/' }, createMockUri('/workspace-root/valid.md')];
			const result = buildTree(uris);

			// The buildTree function filters out files with empty relative names
			// so we should only get the valid file
			expect(result.length).toBeGreaterThanOrEqual(1);

			// Look for any structure containing valid.md
			const hasValidFile = result.some(
				(r) =>
					r.name === 'valid.md' ||
					r.path.includes('valid.md') ||
					(r.children && r.children.some((child: any) => child.name === 'valid.md')),
			);
			expect(hasValidFile).toBe(true);
		});

		it('should handle complex folder nesting', () => {
			const uris = [
				createMockUri('/workspace-root/a/b/c/d/e/file.md'),
				createMockUri('/workspace-root/a/b/x/y/z/other.md'),
			];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			const cFolder = result[0];
			const xFolder = result[1];
			expect(cFolder.name).toBe('c');
			expect(xFolder.name).toBe('x');

			// Navigate through the c structure
			let current = cFolder;
			expect(current.children).toHaveLength(1);
			current = current.children![0]; // d
			expect(current.children).toHaveLength(1);
			current = current.children![0]; // e
			expect(current.children).toHaveLength(1);
			expect(current.children![0].name).toBe('file.md');
		});

		it('should maintain correct parent-child relationships', () => {
			const uris = [
				createMockUri('/workspace-root/docs/api/users.md'),
				createMockUri('/workspace-root/docs/guides/intro.md'),
			];
			const result = buildTree(uris);

			expect(result).toHaveLength(2);
			const apiFolder = result[0];
			const guidesFolder = result[1];

			expect(apiFolder.name).toBe('api');
			expect(guidesFolder.name).toBe('guides');

			expect(apiFolder.children).toHaveLength(1);
			expect(guidesFolder.children).toHaveLength(1);
		});
	});
});

describe('sortNodes', () => {
	const createMockNode = (type: 'file' | 'folder', title: string, isReadme = false): MockTreeNode => ({
		type,
		name: title,
		title,
		path: `/path/to/${title}`,
		isReadme,
		...(type === 'folder' && { children: [] }),
	});

	describe('README priority', () => {
		it('should always place README files first', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('file', 'zzzfile'),
				createMockNode('file', 'readme.md', true),
				createMockNode('file', 'aaa-file'),
			];

			sortNodes(nodes as any, 'alphabetical');

			expect(nodes[0].isReadme).toBe(true);
			expect(nodes[0].title).toBe('readme.md');
		});

		it('should handle multiple README files correctly', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('file', 'zzzfile'),
				createMockNode('file', 'readme.md', true),
				createMockNode('file', 'README.txt', true),
				createMockNode('file', 'aaa-file'),
			];

			sortNodes(nodes as any, 'alphabetical');

			expect(nodes[0].isReadme).toBe(true);
			expect(nodes[1].isReadme).toBe(true);
		});
	});

	describe('alphabetical sorting', () => {
		it('should sort alphabetically when directorySort is alphabetical', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('file', 'zebra'),
				createMockNode('folder', 'apple'),
				createMockNode('file', 'banana'),
			];

			sortNodes(nodes as any, 'alphabetical');

			expect(nodes.map((n) => n.title)).toEqual(['apple', 'banana', 'zebra']);
		});
	});

	describe('files-first sorting', () => {
		it('should place files before folders with files-first', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('folder', 'folder-a'),
				createMockNode('file', 'file-z'),
				createMockNode('folder', 'folder-b'),
				createMockNode('file', 'file-a'),
			];

			sortNodes(nodes as any, 'files-first');

			expect(nodes[0].type).toBe('file');
			expect(nodes[1].type).toBe('file');
			expect(nodes[2].type).toBe('folder');
			expect(nodes[3].type).toBe('folder');
		});

		it('should sort alphabetically within same type for files-first', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('folder', 'zebra-folder'),
				createMockNode('file', 'zebra-file'),
				createMockNode('folder', 'apple-folder'),
				createMockNode('file', 'apple-file'),
			];

			sortNodes(nodes as any, 'files-first');

			expect(nodes.map((n) => n.title)).toEqual(['apple-file', 'zebra-file', 'apple-folder', 'zebra-folder']);
		});
	});

	describe('folders-first sorting', () => {
		it('should place folders before files with folders-first', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('file', 'file-a'),
				createMockNode('folder', 'folder-z'),
				createMockNode('file', 'file-z'),
				createMockNode('folder', 'folder-a'),
			];

			sortNodes(nodes as any, 'folders-first');

			expect(nodes[0].type).toBe('folder');
			expect(nodes[1].type).toBe('folder');
			expect(nodes[2].type).toBe('file');
			expect(nodes[3].type).toBe('file');
		});

		it('should sort alphabetically within same type for folders-first', () => {
			const nodes: MockTreeNode[] = [
				createMockNode('file', 'zebra-file'),
				createMockNode('folder', 'zebra-folder'),
				createMockNode('file', 'apple-file'),
				createMockNode('folder', 'apple-folder'),
			];

			sortNodes(nodes as any, 'folders-first');

			expect(nodes.map((n) => n.title)).toEqual(['apple-folder', 'zebra-folder', 'apple-file', 'zebra-file']);
		});
	});
});

describe('processNode', () => {
	const createMockNode = (type: 'file' | 'folder', title: string, children?: MockTreeNode[]): MockTreeNode => ({
		type,
		name: title,
		title,
		path: `/path/to/${title}`,
		...(type === 'folder' && { children: children || [] }),
	});

	it('should do nothing for file nodes', () => {
		const fileNode = createMockNode('file', 'test.md');
		const originalNode = { ...fileNode };

		processNode(fileNode as any, 'alphabetical');

		expect(fileNode).toEqual(originalNode);
	});

	it('should sort children of folder nodes', () => {
		const folderNode = createMockNode('folder', 'docs', [
			createMockNode('file', 'zebra.md'),
			createMockNode('file', 'apple.md'),
			createMockNode('folder', 'banana'),
		]);

		processNode(folderNode as any, 'alphabetical');

		expect(folderNode.children!.map((n) => n.title)).toEqual(['apple.md', 'banana', 'zebra.md']);
	});

	it('should recursively process nested folder children', () => {
		const nestedFolder = createMockNode('folder', 'nested', [
			createMockNode('file', 'zebra.md'),
			createMockNode('file', 'apple.md'),
		]);

		const parentFolder = createMockNode('folder', 'parent', [createMockNode('file', 'readme.md'), nestedFolder]);

		processNode(parentFolder as any, 'alphabetical');

		// Check that nested children are also sorted
		expect(nestedFolder.children!.map((n) => n.title)).toEqual(['apple.md', 'zebra.md']);
	});

	it('should handle empty folder children', () => {
		const emptyFolder = createMockNode('folder', 'empty', []);

		expect(() => processNode(emptyFolder as any, 'alphabetical')).not.toThrow();
		expect(emptyFolder.children).toEqual([]);
	});

	it('should pass directorySort parameter to sortNodes', () => {
		const folderNode = createMockNode('folder', 'docs', [
			createMockNode('folder', 'images'),
			createMockNode('file', 'config.js'),
			createMockNode('file', 'readme.md'),
		]);

		processNode(folderNode as any, 'files-first');

		// Files should come before folders
		expect(folderNode.children![0].type).toBe('file');
		expect(folderNode.children![1].type).toBe('file');
		expect(folderNode.children![2].type).toBe('folder');
	});
});
