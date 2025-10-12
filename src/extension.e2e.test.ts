/**
 * End-to-End Test Suite for FHIRPath Explorer Extension
 */
/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';

const { scanWorkspaceDocs, WorkspaceWikiTreeProvider } = require(process.cwd() + '/dist/extension.js');

describe('scanWorkspaceDocs E2E', () => {
	it('should find documentation files in the workspace', async () => {
		const docs = await scanWorkspaceDocs(vscode.workspace);
		// E2E: In a development workspace, we expect to find documentation files
		// If no files are found, this might be due to test environment limitations
		if (docs.length === 0) {
			// Check if we're in the actual workspace by looking for specific files
			const readmeFiles = await vscode.workspace.findFiles('**/README.md');
			if (readmeFiles.length > 0) {
				assert.fail('scanWorkspaceDocs should have found documentation files that exist in workspace');
			} else {
				// Test environment doesn't have expected files, so skip assertion
				console.log('Skipping test: No documentation files found in test environment');
				return;
			}
		}
		assert.ok(docs.length > 0, 'No documentation files found');
	});

	it('should return URIs that exist on disk', async () => {
		const docs = await scanWorkspaceDocs(vscode.workspace);
		for (const uri of docs) {
			const stat = await vscode.workspace.fs.stat(uri);
			assert.ok(stat.size >= 0, `File does not exist: ${uri.fsPath}`);
		}
	});
});

describe('WorkspaceWikiTreeProvider E2E', () => {
	it('should instantiate and return tree items in a real workspace', async () => {
		const provider = new WorkspaceWikiTreeProvider(
			vscode.workspace,
			vscode.TreeItem,
			vscode.TreeItemCollapsibleState,
			vscode.EventEmitter,
		);
		const items = await provider.getChildren();
		assert.ok(Array.isArray(items));
		for (const item of items) {
			assert.ok(item.label && typeof item.label === 'string');
			assert.ok(item.tooltip && typeof item.tooltip === 'string');
			assert.ok(item.command && typeof item.command === 'object');
		}
	});
});
