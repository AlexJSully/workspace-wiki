import { defineConfig } from 'cypress';

/** Configures Cypress end-to-end runs against the Wiki Site harness at localhost:5179. */
export default defineConfig({
	e2e: {
		// The harness serves the webview bundle standalone, on a fake extension host.
		baseUrl: 'http://localhost:5179',
		// Wide enough for all three columns: navigation, page, and "On this page".
		viewportWidth: 1280,
		viewportHeight: 800,
		video: false,
		// Headless runs retry a failed test twice, so a slow shared runner does not fail a timing check; a real failure still fails every attempt.
		retries: { runMode: 2, openMode: 0 },
		setupNodeEvents(on) {
			// Opens the headless window larger than the viewport so screenshots show the whole page without scrollbars.
			on('before:browser:launch', (browser, launchOptions) => {
				if (browser.name === 'electron') {
					launchOptions.preferences.width = 1400;
					launchOptions.preferences.height = 900;
				}
				return launchOptions;
			});
			// Prints accessibility violations in the terminal, where headless runs are read.
			on('task', {
				log(message: string) {
					console.log(message);
					return null;
				},
			});
		},
	},
});
