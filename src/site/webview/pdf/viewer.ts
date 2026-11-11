/**
 * The PDF viewer bundle, loaded by the site only when a PDF page is opened.
 *
 * pdf.js normally parses in a Web Worker it starts from a URL. A webview cannot start a worker from
 * an extension resource, so the worker's code is bundled here and handed to pdf.js as
 * `globalThis.pdfjsWorker`, which pdf.js then runs on the page's own thread.
 *
 * The legacy build is used because the modern one calls `Uint8Array.prototype.toHex`, which only
 * Chromium 140 and later provide; the VS Code versions this extension supports ship older ones.
 */
import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs' with { 'resolution-mode': 'import' };
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

/**
 * pdf.js, loaded through `require` because it ships only as an ES module, which this CommonJS source
 * cannot `import` under `module: Node16`. The type comes from its own declarations; esbuild bundles
 * the `require` like any import.
 */
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs') as typeof import('pdfjs-dist/legacy/build/pdf.mjs', {
	with: { 'resolution-mode': 'import' },
});

(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfjsWorker;

/** What the viewer exposes on `window.wikiPdf` for the site to call. */
export interface WikiPdfViewer {
	/**
	 * Renders a PDF into a container, one canvas per page, drawing each page as it nears the view.
	 *
	 * @param container The element to fill
	 * @param url Webview URL of the PDF
	 * @returns The page count, once the document has opened; rejects when it cannot be read
	 */
	render(container: HTMLElement, url: string): Promise<number>;
}

/** Margin around the visible area within which pages are drawn ahead of being scrolled to. */
const PRELOAD_MARGIN = '600px 0px';

/**
 * Draws one page at the container's width and the screen's pixel density.
 *
 * @param page The pdf.js page
 * @param canvas The canvas to draw into
 * @param width CSS pixels the page should span
 */
async function drawPage(page: PDFPageProxy, canvas: HTMLCanvasElement, width: number): Promise<void> {
	const base = page.getViewport({ scale: 1 });
	const viewport = page.getViewport({ scale: width / base.width });
	const ratio = window.devicePixelRatio || 1;

	canvas.width = Math.floor(viewport.width * ratio);
	canvas.height = Math.floor(viewport.height * ratio);
	canvas.style.width = `${Math.floor(viewport.width)}px`;
	canvas.style.height = `${Math.floor(viewport.height)}px`;

	await page.render({
		canvas,
		viewport,
		transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
	}).promise;
}

const viewer: WikiPdfViewer = {
	async render(container, url) {
		const document = await pdfjs.getDocument({ url }).promise;
		const width = Math.max(240, container.clientWidth);
		const drawn = new Set<number>();

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const canvas = entry.target as HTMLCanvasElement;
					const number = Number(canvas.dataset.page);
					if (!entry.isIntersecting || drawn.has(number)) {
						continue;
					}
					drawn.add(number);
					observer.unobserve(canvas);
					void document
						.getPage(number)
						.then((page) => drawPage(page, canvas, width))
						.then(() => canvas.setAttribute('data-rendered', ''))
						.catch(() => canvas.setAttribute('data-failed', ''));
				}
			},
			{ rootMargin: PRELOAD_MARGIN },
		);

		// Reserve each page's space up front from the first page's size, so the scrollbar is right
		// before any page has been drawn.
		const first = (await document.getPage(1)).getViewport({ scale: 1 });
		const placeholderHeight = Math.floor((first.height / first.width) * width);

		for (let number = 1; number <= document.numPages; number++) {
			const canvas = window.document.createElement('canvas');
			canvas.className = 'pdf-page';
			canvas.dataset.page = String(number);
			canvas.setAttribute('role', 'img');
			canvas.setAttribute('aria-label', `Page ${number} of ${document.numPages}`);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${placeholderHeight}px`;
			container.append(canvas);
			observer.observe(canvas);
		}

		return document.numPages;
	},
};

(window as unknown as { wikiPdf: WikiPdfViewer }).wikiPdf = viewer;
