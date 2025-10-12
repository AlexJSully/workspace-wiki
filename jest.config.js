module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/src'],
	testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
	testPathIgnorePatterns: [
		'/node_modules/',
		'.*\\.e2e\\.test\\.(ts|tsx)$', // Exclude E2E tests from Jest
	],
	setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
	verbose: true,
	transform: {
		'^.+\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
			},
		],
	},
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
		'!src/**/*.test.{ts,tsx}',
		'!src/**/*.spec.{ts,tsx}',
		'!src/**/*.integration.test.{ts,tsx}',
		'!tests/**/*',
	],
};
