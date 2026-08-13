import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: ['out/test/**/*.test.js', 'out/**/*.e2e.test.js'],
	// Without a folder, findFiles returns nothing and the discovery tests assert nothing.
	workspaceFolder: 'example',
	mocha: {
		ui: 'bdd',
		timeout: 20000,
	},
});
