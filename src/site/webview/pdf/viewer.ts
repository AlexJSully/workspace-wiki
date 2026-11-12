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
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs' with {
	'resolution-mode': 'import',
};
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

/** A PDF shown in the page, and the way to let go of it. */
export interface PdfView {
	/** The page count, once the document has opened; rejects when it cannot be read. */
	pages: Promise<number>;
	/**
	 * Stops drawing and frees the document: disconnects the page observer, cancels page renders and
	 * text reads in progress, and destroys the pdf.js document. Called when the page is replaced.
	 */
	dispose(): void;
}

/** What the viewer exposes on `window.wikiPdf` for the site to call. */
export interface WikiPdfViewer {
	/**
	 * Shows a PDF in a container, one page group per page. Each group holds a canvas, drawn as it
	 * nears the view, and the page's text in reading order for assistive technology.
	 *
	 * @param container The element to fill
	 * @param url Webview URL of the PDF
	 * @returns The view, whose `dispose` must be called once the PDF is no longer shown
	 */
	open(container: HTMLElement, url: string): PdfView;
}

/** Margin around the visible area within which pages are drawn ahead of being scrolled to. */
const PRELOAD_MARGIN = '600px 0px';

/** Thrown into `pages` when the view was disposed before the document opened. */
const DISPOSED = 'The PDF was closed';

/**
 * Draws one page at the container's width and the screen's pixel density.
 *
 * @param page The pdf.js page
 * @param canvas The canvas to draw into
 * @param width CSS pixels the page should span
 * @returns The render task, which the view cancels if it is disposed mid-draw
 */
function drawPage(page: PDFPageProxy, canvas: HTMLCanvasElement, width: number): RenderTask {
	const base = page.getViewport({ scale: 1 });
	const viewport = page.getViewport({ scale: width / base.width });
	const ratio = window.devicePixelRatio || 1;

	canvas.width = Math.floor(viewport.width * ratio);
	canvas.height = Math.floor(viewport.height * ratio);
	canvas.style.width = `${Math.floor(viewport.width)}px`;
	canvas.style.height = `${Math.floor(viewport.height)}px`;

	return page.render({
		canvas,
		viewport,
		transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
	});
}

/**
 * Reads a page's text in reading order, one line per line of the PDF.
 *
 * @param page The pdf.js page
 * @returns The text, empty for a page with none (a scanned image, for example)
 */
async function readPageText(page: PDFPageProxy): Promise<string> {
	const content = await page.getTextContent();
	return content.items
		.map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : ''))
		.join('')
		.trim();
}

/**
 * Builds the page groups and starts drawing and reading them.
 *
 * @param document The opened document
 * @param container The element to fill
 * @param isDisposed Reports whether the view has been disposed, which stops the text reads
 * @param renders Render tasks in progress, which `dispose` cancels
 * @returns The observer that draws pages as they near the view
 */
async function layOutPages(
	document: PDFDocumentProxy,
	container: HTMLElement,
	isDisposed: () => boolean,
	renders: Set<RenderTask>,
): Promise<IntersectionObserver> {
	const width = Math.max(240, container.clientWidth);
	const total = document.numPages;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) {
					continue;
				}
				const group = entry.target as HTMLElement;
				const canvas = group.querySelector('canvas');
				observer.unobserve(group);
				if (!canvas) {
					continue;
				}
				void document
					.getPage(Number(group.dataset.page))
					.then(async (page) => {
						const render = drawPage(page, canvas, width);
						renders.add(render);
						try {
							await render.promise;
						} finally {
							renders.delete(render);
						}
					})
					.then(() => group.setAttribute('data-rendered', ''))
					.catch(() => {
						if (!isDisposed()) {
							group.setAttribute('data-failed', '');
						}
					});
			}
		},
		{ rootMargin: PRELOAD_MARGIN },
	);

	// Reserve each page's space up front from the first page's size, so the scrollbar is right
	// before any page has been drawn.
	const first = (await document.getPage(1)).getViewport({ scale: 1 });
	const placeholderHeight = Math.floor((first.height / first.width) * width);

	const texts: HTMLElement[] = [];
	for (let number = 1; number <= total; number++) {
		const group = window.document.createElement('div');
		group.className = 'pdf-page';
		group.dataset.page = String(number);
		group.setAttribute('role', 'group');
		group.setAttribute('aria-label', `Page ${number} of ${total}`);

		// The canvas is a picture of the text below it, so assistive technology reads the text instead.
		const canvas = window.document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		canvas.style.width = `${width}px`;
		canvas.style.height = `${placeholderHeight}px`;

		const text = window.document.createElement('div');
		text.className = 'pdf-page-text';
		texts.push(text);

		group.append(canvas, text);
		container.append(group);
		observer.observe(group);
	}

	// Text is read for every page, not only drawn ones, since a screen reader moves through the
	// document without scrolling it. One page at a time, so a long PDF does not stall the page.
	void (async () => {
		for (let number = 1; number <= total && !isDisposed(); number++) {
			try {
				texts[number - 1].textContent = await readPageText(await document.getPage(number));
			} catch {
				// A page whose text cannot be read keeps its label; the canvas still shows it.
			}
		}
	})();

	return observer;
}

const viewer: WikiPdfViewer = {
	open(container, url) {
		const task = pdfjs.getDocument({ url });
		const renders = new Set<RenderTask>();
		let observer: IntersectionObserver | undefined;
		let disposed = false;
		const isDisposed = () => disposed;

		const pages = task.promise.then(async (document) => {
			if (disposed) {
				throw new Error(DISPOSED);
			}
			observer = await layOutPages(document, container, isDisposed, renders);
			if (disposed) {
				observer.disconnect();
				throw new Error(DISPOSED);
			}
			return document.numPages;
		});

		return {
			pages,
			dispose() {
				if (disposed) {
					return;
				}
				disposed = true;
				observer?.disconnect();
				renders.forEach((render) => render.cancel());
				renders.clear();
				// Destroying the loading task destroys the document it opened, or aborts the open.
				void task.destroy();
			},
		};
	},
};

(window as unknown as { wikiPdf: WikiPdfViewer }).wikiPdf = viewer;
