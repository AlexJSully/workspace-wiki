const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

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
 * Reports build start and end, formatting any errors for the VS Code problem matcher.
 *
 * @param {string} name The target being built
 * @returns {import('esbuild').Plugin} The plugin
 */
const esbuildProblemMatcherPlugin = (name) => ({
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log(`[watch] build started (${name})`);
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log(`[watch] build finished (${name})`);
		});
	},
});

/**
 * Builds one target, watching it instead when `--watch` was passed.
 *
 * @param {{ name: string, platform: import('esbuild').Platform, outfile: string }} target The target to build
 * @returns {Promise<void>} Resolves once the build completes, or watching has started
 */
async function build(target) {
	const ctx = await esbuild.context({
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
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

async function main() {
	await Promise.all(targets.map(build));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
