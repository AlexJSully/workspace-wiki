import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** Node globals absent from the web extension host and the webview. */
const NODE_GLOBALS = [
	{ name: 'Buffer', message: 'Not defined in the web extension host. Use TextDecoder/TextEncoder.' },
	{ name: 'process', message: 'Not defined in the web extension host.' },
	{ name: '__dirname', message: 'Not defined in the web extension host.' },
	{ name: '__filename', message: 'Not defined in the web extension host.' },
];

/** Browser-page globals absent from both extension hosts. */
const DOM_GLOBALS = [
	'window',
	'document',
	'localStorage',
	'sessionStorage',
	'alert',
	'confirm',
	'prompt',
	'getComputedStyle',
	'HTMLElement',
	'Element',
	'DOMParser',
	'MutationObserver',
	'IntersectionObserver',
	'customElements',
];

export default [
	{
		ignores: ['**/proto/**'], // Ignore generated protobuf files
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		plugins: {
			'@typescript-eslint': typescriptEslint,
		},

		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: 'module',
		},

		rules: {
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: 'import',
					format: ['camelCase', 'PascalCase'],
				},
			],
			'no-throw-literal': 'warn',
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			curly: 'warn',
			eqeqeq: 'warn',
			radix: 'off',
			semi: 'warn',
		},
	},
	{
		// Node globals are invisible to both the browser build and tsc, which keeps `node` in
		// `types` for the tests. A Node import is caught by the browser build instead. The webview
		// runs in a browser page, so it is held to the same rule.
		files: ['src/**/*.ts'],
		ignores: ['src/**/*.test.ts', 'src/test/**/*.ts'],
		rules: {
			'no-restricted-globals': ['error', ...NODE_GLOBALS],
		},
	},
	{
		// The extension host runs in Node or a Web Worker, neither of which has a DOM. `tsconfig.json`
		// carries the `DOM` lib for the webview, so the compiler cannot flag a DOM global here; this does.
		files: ['src/**/*.ts'],
		ignores: ['src/**/*.test.ts', 'src/test/**/*.ts', 'src/site/webview/**/*.ts'],
		rules: {
			'no-restricted-globals': [
				'error',
				...NODE_GLOBALS,
				...DOM_GLOBALS.map((name) => ({
					name,
					message: 'Not defined in the extension host. Only the webview has a DOM.',
				})),
			],
		},
	},
	{
		ignores: ['out/**', 'dist/**', 'cypress/screenshots/**', 'cypress/videos/**', 'cypress/downloads/**'],
	},
];
