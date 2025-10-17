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
		'^@types$': '<rootDir>/src/types',
		'^@scanner$': '<rootDir>/src/scanner',
		'^@scanner/(.*)$': '<rootDir>/src/scanner/$1',
		'^@controllers$': '<rootDir>/src/controllers',
		'^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
		'^@tree$': '<rootDir>/src/tree',
		'^@tree/(.*)$': '<rootDir>/src/tree/$1',
		'^@utils$': '<rootDir>/src/utils',
		'^@utils/(.*)$': '<rootDir>/src/utils/$1',
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
