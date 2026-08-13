/**
 * A minimal test runner for the Web Worker extension host.
 *
 * `--extensionTestsPath` only requires a module exporting `run(): Promise<void>` that rejects on
 * failure, so bundling Mocha into a worker — which needs polyfills for several Node globals —
 * would add weight without adding capability.
 */

/** A single registered test case. */
interface TestCase {
	name: string;
	fn: () => void | Promise<void>;
}

/** Tests registered by the suite module, in declaration order. */
const cases: TestCase[] = [];

/**
 * Registers a test case.
 *
 * @param name What the case proves
 * @param fn The case body; throwing marks it failed
 */
export function test(name: string, fn: () => void | Promise<void>): void {
	cases.push({ name, fn });
}

/**
 * Asserts that a value is truthy. Node's `assert` does not resolve in a browser bundle.
 *
 * @param value The value to check
 * @param message What was expected
 */
export function ok(value: unknown, message: string): asserts value {
	if (!value) {
		throw new Error(message);
	}
}

/**
 * Asserts that two values are strictly equal.
 *
 * @param actual The observed value
 * @param expected The expected value
 * @param message What was expected
 */
export function strictEqual<T>(actual: T, expected: T, message: string): void {
	if (actual !== expected) {
		throw new Error(`${message} (expected ${String(expected)}, received ${String(actual)})`);
	}
}

/**
 * Runs every registered case, reporting results to the console.
 *
 * @returns Resolves when all cases pass
 * @throws When any case fails, listing each failure
 */
export async function runRegistered(): Promise<void> {
	const failures: string[] = [];

	for (const testCase of cases) {
		try {
			await testCase.fn();
			console.log(`  ✓ ${testCase.name}`);
		} catch (error: any) {
			failures.push(`${testCase.name}: ${error?.message ?? String(error)}`);
			console.error(`  ✗ ${testCase.name}`);
			console.error(`    ${error?.stack ?? error}`);
		}
	}

	console.log(`\n${cases.length - failures.length}/${cases.length} web tests passed`);

	if (failures.length > 0) {
		throw new Error(`${failures.length} web test(s) failed:\n${failures.join('\n')}`);
	}
}
