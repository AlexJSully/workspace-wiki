import { loadScript } from './loadScript';
import type { WikiPdfViewer } from './pdf/viewer';

/**
 * Shows a PDF in a container: loads the pdf.js bundle on first use, then draws the document's pages.
 *
 * pdf.js is a separate bundle, so pages that are not PDFs never fetch it. While it loads the
 * container says so; once open it carries the page count, and a document that cannot be read
 * says that instead, leaving the page's open buttons as the way to the file.
 *
 * @param container The element to fill
 * @param fileSrc Webview URL of the PDF
 * @param viewerSrc URL of the pdf.js bundle
 * @param nonce The page's script nonce
 */
export async function renderPdf(
	container: HTMLElement,
	fileSrc: string | undefined,
	viewerSrc: string | undefined,
	nonce: string | undefined,
): Promise<void> {
	const status = document.createElement('p');
	status.className = 'pdf-status';
	status.setAttribute('role', 'status');
	status.textContent = 'Opening the PDF…';
	const pages = document.createElement('div');
	pages.className = 'pdf-pages';
	container.replaceChildren(status, pages);

	try {
		if (!fileSrc || !viewerSrc) {
			throw new Error('the PDF viewer is not available');
		}
		await loadScript(viewerSrc, nonce);
		const viewer = (window as unknown as { wikiPdf?: WikiPdfViewer }).wikiPdf;
		if (!viewer) {
			throw new Error('the PDF viewer did not load');
		}
		const count = await viewer.render(pages, fileSrc);
		status.textContent = `${count} ${count === 1 ? 'page' : 'pages'}`;
		container.dataset.state = 'ready';
	} catch (error) {
		status.textContent = `This PDF could not be shown: ${error instanceof Error ? error.message : String(error)}. Open it to view it in its own editor.`;
		container.dataset.state = 'failed';
	}
}
