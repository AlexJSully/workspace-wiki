import type { HostToView, ViewToHost } from '@site/protocol';

/**
 * The webview's only route to its host.
 *
 * In VS Code it wraps `acquireVsCodeApi()`; in the Cypress harness a fake host implements it, so
 * the same app code runs in both.
 */
export interface HostBridge {
	/** Sends a message to the host. */
	post(message: ViewToHost): void;
	/** Listens for host messages; returns the function that stops listening. */
	subscribe(listener: (message: HostToView) => void): () => void;
	/** Reads the state saved for this tab, which survives the tab being hidden. */
	getState(): unknown;
	/** Saves state for this tab. */
	setState(state: unknown): void;
}

/** The part of the object `acquireVsCodeApi()` returns that the bridge uses. */
export interface VsCodeApi {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
}

/**
 * Wraps the VS Code webview API in a {@link HostBridge}.
 *
 * @param api The object `acquireVsCodeApi()` returned
 * @param target The window host messages arrive on
 * @returns The bridge
 */
export function createVscodeBridge(api: VsCodeApi, target: Window = window): HostBridge {
	return {
		post: (message) => api.postMessage(message),
		subscribe(listener) {
			const handler = (event: MessageEvent) => {
				const data = event.data as { type?: unknown } | undefined;
				if (data && typeof data.type === 'string') {
					listener(data as HostToView);
				}
			};
			target.addEventListener('message', handler);
			return () => target.removeEventListener('message', handler);
		},
		getState: () => api.getState(),
		setState: (state) => api.setState(state),
	};
}
