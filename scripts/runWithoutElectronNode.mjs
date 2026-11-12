// Runs a command with ELECTRON_RUN_AS_NODE removed from its environment, and exits with the command's exit code.
//
// A terminal inside VS Code inherits ELECTRON_RUN_AS_NODE=1, which makes Cypress's Electron start as plain Node and
// fail. The npm scripts that start Electron run through this script, so they work from any terminal:
//
//     node scripts/runWithoutElectronNode.mjs <command> [arguments...]
import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
	process.stderr.write('Usage: node scripts/runWithoutElectronNode.mjs <command> [arguments...]\n');
	process.exit(1);
}

const { ELECTRON_RUN_AS_NODE: _removed, ...env } = process.env;
// Windows starts the .cmd shims npm puts on the PATH only through a shell, which splits unquoted arguments.
const windows = process.platform === 'win32';
const child = spawn(windows ? `"${command}"` : command, windows ? args.map((arg) => `"${arg}"`) : args, {
	env,
	stdio: 'inherit',
	shell: windows,
});

child.on('error', (error) => {
	process.stderr.write(`Could not start ${command}: ${error.message}\n`);
	process.exit(1);
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
