/**
 * Entry point of the Wiki Site webview bundle.
 */
import { startApp } from './app';
import { type VsCodeApi, createVscodeBridge } from './bridge';

declare function acquireVsCodeApi(): VsCodeApi;

const root = document.getElementById('app');
if (root) {
	const script = document.currentScript as HTMLScriptElement | null;
	startApp(root, createVscodeBridge(acquireVsCodeApi()), {
		mermaidSrc: root.dataset.mermaidSrc,
		nonce: script?.nonce || undefined,
	});
}
