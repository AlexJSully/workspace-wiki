import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: ['out/test/**/*.test.js', 'out/test/**/*.e2e.test.js'],
	workspaceFolder: './example', // Open the example folder as the workspace for E2E tests
	mocha: {
		ui: 'bdd',
		timeout: 20000,
	},
});
