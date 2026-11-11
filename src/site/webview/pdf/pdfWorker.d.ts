/**
 * pdf.js ships its worker without type declarations. The viewer only hands the module to pdf.js,
 * which reads `WorkerMessageHandler` from it.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
	export const WorkerMessageHandler: unknown;
}
