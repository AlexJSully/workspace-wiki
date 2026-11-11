import { loadScript } from './loadScript';

/** The global the Mermaid browser bundle defines. */
interface MermaidApi {
	initialize(config: Record<string, unknown>): void;
	run(options: { nodes: HTMLElement[]; suppressErrors?: boolean }): Promise<void>;
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
	const api = (window as unknown as { mermaid?: MermaidApi }).mermaid;
	if (!api) {
		throw new Error('Mermaid did not load');
	}
	return api;
}

/**
 * Draws every Mermaid block in a container.
 *
 * Diagrams render with `securityLevel: 'strict'`, which keeps them from running script or loading
 * links. A block that fails keeps its source text and gains the error, rather than vanishing.
 *
 * @param container The rendered page
 * @param src URL of the Mermaid bundle
 * @param nonce The page's script nonce
 * @param dark Whether to use Mermaid's dark palette
 */
export async function renderMermaid(
	container: HTMLElement,
	src: string | undefined,
	nonce: string | undefined,
	dark: boolean,
): Promise<void> {
	const blocks = [...container.querySelectorAll<HTMLElement>('pre.mermaid')];
	if (blocks.length === 0 || !src) {
		return;
	}

	try {
		const mermaid = await loadMermaid(src, nonce);
		mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
		for (const block of blocks) {
			try {
				await mermaid.run({ nodes: [block] });
				block.classList.add('mermaid-rendered');
			} catch (error) {
				markFailed(block, error);
			}
		}
	} catch (error) {
		blocks.forEach((block) => markFailed(block, error));
	}
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
