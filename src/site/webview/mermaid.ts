import { loadScript } from './loadScript';

/** The global the Mermaid browser bundle defines. */
interface MermaidApi {
	initialize(config: Record<string, unknown>): void;
	run(options: { nodes: HTMLElement[]; suppressErrors?: boolean }): Promise<void>;
}

declare global {
	// eslint-disable-next-line no-unused-vars
	interface Window {
		/** Set by the Mermaid bundle once {@link loadMermaid} has added it to the page. */
		mermaid?: MermaidApi;
	}
}

/**
 * Loads the Mermaid bundle once, on the first page that has a diagram.
 *
 * @param src URL of the Mermaid bundle
 * @param nonce The page's script nonce
 * @returns The Mermaid API
 */
async function loadMermaid(src: string, nonce: string | undefined): Promise<MermaidApi> {
	await loadScript(src, nonce);
	if (!window.mermaid) {
		throw new Error('Mermaid did not load');
	}
	return window.mermaid;
}

/**
 * Draws every Mermaid block in a container, one at a time.
 *
 * Diagrams render with `securityLevel: 'strict'`, which keeps them from running script or loading
 * links. A block that fails keeps its source text and gains the error, rather than vanishing.
 *
 * @param container The rendered page
 * @param src URL of the Mermaid bundle
 * @param nonce The page's script nonce
 * @param dark Whether to use Mermaid's dark palette
 * @returns Stops drawing the remaining diagrams; the caller calls it when the page is replaced
 */
export function renderMermaid(
	container: HTMLElement,
	src: string | undefined,
	nonce: string | undefined,
	dark: boolean,
): () => void {
	const blocks = [...container.querySelectorAll<HTMLElement>('pre.mermaid')];
	let cancelled = false;
	if (blocks.length === 0 || !src) {
		return () => undefined;
	}

	void (async () => {
		try {
			const mermaid = await loadMermaid(src, nonce);
			if (cancelled) {
				return;
			}
			mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
			for (const block of blocks) {
				if (cancelled) {
					return;
				}
				try {
					await mermaid.run({ nodes: [block] });
					block.classList.add('mermaid-rendered');
				} catch (error) {
					markFailed(block, error);
				}
			}
		} catch (error) {
			if (!cancelled) {
				blocks.forEach((block) => markFailed(block, error));
			}
		}
	})();

	return () => {
		cancelled = true;
	};
}

/**
 * Notes a diagram's failure under its source.
 *
 * @param block The diagram's block
 * @param error What went wrong
 */
function markFailed(block: HTMLElement, error: unknown): void {
	block.classList.add('mermaid-failed');
	const note = document.createElement('p');
	note.className = 'mermaid-error';
	note.textContent = `This diagram could not be drawn: ${error instanceof Error ? error.message : String(error)}`;
	block.after(note);
}
