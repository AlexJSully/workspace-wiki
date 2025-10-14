import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: ['out/test/**/*.test.js', 'out/test/**/*.e2e.test.js'],
	mocha: {
		ui: 'bdd',
		timeout: 20000,
	},
});
