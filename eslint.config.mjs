import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

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
		// `types` for the tests. A Node import is caught by the browser build instead.
		files: ['src/**/*.ts'],
		ignores: ['src/**/*.test.ts', 'src/test/**/*.ts'],
		rules: {
			'no-restricted-globals': [
				'error',
				{ name: 'Buffer', message: 'Not defined in the web extension host. Use TextDecoder/TextEncoder.' },
				{ name: 'process', message: 'Not defined in the web extension host.' },
				{ name: '__dirname', message: 'Not defined in the web extension host.' },
				{ name: '__filename', message: 'Not defined in the web extension host.' },
			],
		},
	},
];
