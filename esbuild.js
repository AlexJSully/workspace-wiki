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
 * @returns {Promise<import('esbuild').Metafile | undefined>} The bundle's inputs, or undefined when watching
 */
async function build(target) {
	return run({
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
 * Options shared by the two webview builds, the extension's and the Cypress harness's: the site
 * stylesheet and a given script entry, bundled as a browser IIFE. Each build adds its own fields.
 *
 * @param {{ in: string, out: string }} script The script entry
 * @param {string} outdir The output folder
 * @returns {import('esbuild').BuildOptions} The shared options
 */
function webviewOptions(script, outdir) {
	return {
		entryPoints: [script, { in: 'src/site/webview/site.css', out: 'site' }],
		bundle: true,
		format: 'iife',
		target: 'es2022',
		platform: 'browser',
		outdir,
	};
}

/**
 * Builds the Wiki Site webview into `dist/webview`: its script and stylesheet, and a copy of the
 * Mermaid bundle that pages with a diagram load.
 *
 * @returns {Promise<import('esbuild').Metafile | undefined>} The bundle's inputs, or undefined when watching
 */
async function buildWebview() {
	await fs.mkdir('dist/webview', { recursive: true });
	await fs.copyFile(MERMAID_BUNDLE, 'dist/webview/mermaid.js');
	return run({
		...webviewOptions({ in: 'src/site/webview/main.ts', out: 'site' }, 'dist/webview'),
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
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
		...webviewOptions({ in: 'src/site/webview/harness/harness.ts', out: 'harness' }, outdir),
		sourcemap: true,
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
 * @returns {Promise<import('esbuild').Metafile | undefined>} The bundle's inputs, or undefined when watching
 */
async function run(options) {
	const ctx = await esbuild.context({ ...options, metafile: true });
	if (watch) {
		await ctx.watch();
		return undefined;
	}
	const result = await ctx.rebuild();
	await ctx.dispose();
	return result.metafile;
}

/**
 * Finds the npm packages a bundle includes, from the `node_modules` paths among its inputs.
 *
 * @param {import('esbuild').Metafile} metafile The bundle's inputs
 * @returns {Map<string, string>} Each package's name, scoped ones as `@scope/name`, and its folder
 */
function bundledPackages(metafile) {
	const packages = new Map();
	for (const input of Object.keys(metafile.inputs)) {
		const match = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(input);
		if (match) {
			packages.set(match[2], path.resolve(match[1]));
		}
	}
	return packages;
}

/**
 * Writes `dist/THIRD_PARTY_NOTICES.txt`: the licence of every package the bundles include, plus
 * Mermaid, which is copied in whole. Minifying drops most licence headers from the bundles, so the
 * extension package carries the notices in this file instead.
 *
 * @param {(import('esbuild').Metafile | undefined)[]} metafiles The inputs of each bundle built
 * @returns {Promise<void>} Resolves once the file is written
 */
async function writeNotices(metafiles) {
	const packages = new Map([['mermaid', path.resolve(MERMAID_BUNDLE, '..', '..')]]);
	for (const metafile of metafiles) {
		if (metafile) {
			bundledPackages(metafile).forEach((folder, name) => packages.set(name, folder));
		}
	}

	const sections = [];
	for (const [name, folder] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
		const manifest = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf8'));
		const licenceFile = (await fs.readdir(folder)).find((file) => /^licen[cs]e/i.test(file));
		const text = licenceFile
			? await fs.readFile(path.join(folder, licenceFile), 'utf8')
			: `License: ${manifest.license}`;
		const heading = `${name} ${manifest.version}`;
		sections.push(`${heading}\n${'-'.repeat(heading.length)}\n\n${text.trim()}\n`);
	}

	await fs.writeFile(
		'dist/THIRD_PARTY_NOTICES.txt',
		`Workspace Wiki bundles the following third-party packages.\n\n${sections.join('\n\n')}`,
	);
}

async function main() {
	if (harness) {
		await buildHarness();
		return;
	}
	const metafiles = await Promise.all([...targets.map(build), buildWebview()]);
	if (!watch) {
		await writeNotices(metafiles);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
