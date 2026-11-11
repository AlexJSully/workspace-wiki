/** Scripts already loading or loaded, by URL, so each is added to the page once. */
const loading = new Map<string, Promise<void>>();

/**
 * Adds a script to the page once and waits for it to run.
 *
 * Used for the large libraries the site needs only on some pages, Mermaid and pdf.js, which are
 * separate bundles so pages without a diagram or a PDF never fetch them.
 *
 * @param src URL of the script
 * @param nonce The page's script nonce, which the Content Security Policy requires
 * @returns Resolves once the script has run; a failed load is forgotten, so a later page can retry
 */
export function loadScript(src: string, nonce: string | undefined): Promise<void> {
	let pending = loading.get(src);
	if (!pending) {
		pending = new Promise<void>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = src;
			if (nonce) {
				script.nonce = nonce;
			}
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`${src} could not be loaded`));
			document.head.appendChild(script);
		});
		pending.catch(() => loading.delete(src));
		loading.set(src, pending);
	}
	return pending;
}
