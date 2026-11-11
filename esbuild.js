const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const harness = process.argv.includes('--harness');
const serve = process.argv.includes('--serve');

/** Port the Cypress harness is served on; `cypress.config.ts` and the `test:cypress` script use it too. */
const HARNESS_PORT = 5179;
/** Mermaid's prebuilt browser bundle, shipped as-is and loaded only by pages with a diagram. */
const MERMAID_BUNDLE = require.resolve('mermaid/dist/mermaid.min.js');

/**
 * Build targets: the Node extension host, and the Web Worker host used by vscode.dev.
 *
 * @type {{ name: string, platform: import('esbuild').Platform, outfile: string }[]}
 */
const targets = [
	{ name: 'desktop', platform: 'node', outfile: 'dist/extension.js' },
	{ name: 'web', platform: 'browser', outfile: 'dist/web/extension.js' },
];

/**
 * Targets currently building. The watch log brackets the whole set rather than each target, because
 * VS Code reads the first `build finished` as "the build is done" and would let a launch start while
 * the other bundle was still being written.
 */
let targetsBuilding = 0;

/**
 * Reports build start and end, formatting any errors for the VS Code problem matcher.
 *
 * @param {string} name The target being built
 * @returns {import('esbuild').Plugin} The plugin
 */
const esbuildProblemMatcherPlugin = (name) => ({
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			if (targetsBuilding === 0) {
				console.log('[watch] build started');
			}
			targetsBuilding++;
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				// esbuild leaves `location` null for errors not tied to a source position, and reading
				// through it would throw here, taking the watch process down with it.
				if (location) {
					console.error(`    ${location.file}:${location.line}:${location.column}:`);
				}
			});

			console.log(`[watch] ${name} built`);

			targetsBuilding--;
			if (targetsBuilding === 0) {
				console.log('[watch] build finished');
			}
		});
	},
});

/**
 * Builds one extension-host target, watching it instead when `--watch` was passed.
 *
 * @param {{ name: string, platform: import('esbuild').Platform, outfile: string }} target The target to build
 * @returns {Promise<void>} Resolves once the build completes, or watching has started
 */
async function build(target) {
	await run({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: target.platform,
		outfile: target.outfile,
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin(target.name),
		],
	});
}

/**
 * Builds the Wiki Site webview into `dist/webview`: its script and stylesheet, the pdf.js viewer as a
 * separate script loaded only for PDF pages, and a copy of the Mermaid bundle.
 *
 * @returns {Promise<void>} Resolves once the build completes, or watching has started
 */
async function buildWebview() {
	await fs.mkdir('dist/webview', { recursive: true });
	await fs.copyFile(MERMAID_BUNDLE, 'dist/webview/mermaid.js');
	await run({
		entryPoints: [
			{ in: 'src/site/webview/main.ts', out: 'site' },
			{ in: 'src/site/webview/site.css', out: 'site' },
			{ in: 'src/site/webview/pdf/viewer.ts', out: 'pdf' },
		],
		bundle: true,
		format: 'iife',
		target: 'es2022',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outdir: 'dist/webview',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin('webview')],
	});
}

/**
 * Builds the standalone page Cypress drives: the webview app on a fake host, its fixtures, the
 * site stylesheet, and Mermaid, into `out/harness`. With `--serve` it serves that folder instead
 * of exiting, rebuilding on each request.
 *
 * @returns {Promise<void>} Resolves once built, or once the server is listening
 */
async function buildHarness() {
	const outdir = 'out/harness';
	await fs.mkdir(outdir, { recursive: true });
	await fs.copyFile('src/site/webview/harness/index.html', path.join(outdir, 'index.html'));
	await fs.copyFile('src/site/webview/harness/harness.css', path.join(outdir, 'harness.css'));
	await fs.cp('src/site/webview/harness/fixtures/assets', path.join(outdir, 'fixtures'), { recursive: true });
	await fs.copyFile(MERMAID_BUNDLE, path.join(outdir, 'mermaid.js'));
	// Served beside the page so the accessibility specs can load axe as a script the harness's
	// Content Security Policy allows, rather than through the `eval` cypress-axe uses by default.
	await fs.copyFile(require.resolve('axe-core/axe.min.js'), path.join(outdir, 'axe.min.js'));

	const options = {
		entryPoints: [
			{ in: 'src/site/webview/harness/harness.ts', out: 'harness' },
			{ in: 'src/site/webview/site.css', out: 'site' },
			{ in: 'src/site/webview/pdf/viewer.ts', out: 'pdf' },
		],
		bundle: true,
		format: 'iife',
		target: 'es2022',
		sourcemap: true,
		platform: 'browser',
		outdir,
		logLevel: 'warning',
	};

	if (serve) {
		const ctx = await esbuild.context(options);
		await ctx.serve({ servedir: outdir, port: HARNESS_PORT });
		console.log(`Harness at http://localhost:${HARNESS_PORT}`);
		return;
	}
	await esbuild.build(options);
}

/**
 * Runs one esbuild build, or starts watching it when `--watch` was passed.
 *
 * @param {import('esbuild').BuildOptions} options The build
 * @returns {Promise<void>} Resolves once the build completes, or watching has started
 */
async function run(options) {
	const ctx = await esbuild.context(options);
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

async function main() {
	if (harness) {
		await buildHarness();
		return;
	}
	await Promise.all([...targets.map(build), buildWebview()]);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
