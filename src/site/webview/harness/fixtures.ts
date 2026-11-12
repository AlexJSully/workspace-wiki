/**
 * The workspace the Cypress harness pretends to be: a small docs tree and the page each node renders.
 */
import type { PageData, SiteNode } from '@site/protocol';

/** Root of the pretend workspace. */
const ROOT = 'file:///workspace-root';

/** A file node at a workspace-relative path. */
function file(path: string, title: string, extra: Partial<SiteNode> = {}): SiteNode {
	return { type: 'file', name: path.split('/').pop() ?? path, title, path, uri: `${ROOT}/${path}`, ...extra };
}

/** A folder node holding children. */
function folder(path: string, title: string, children: SiteNode[]): SiteNode {
	return { type: 'folder', name: path.split('/').pop() ?? path, title, path, uri: `${ROOT}/${path}`, children };
}

const README = `# Atlas Docs

Atlas is a sample workspace for exercising the Wiki Site.

## Install

Run \`npm install\`, then read the [getting started guide](getting-started.md).

## Links

- [Architecture overview](docs/architecture.md#overview)
- [The docs folder](docs/)
- [Example site](https://example.com/docs)
- [Jump to install](#install)
- [A script link](javascript:window.__xss=5)

## Settings

| Setting | Default |
| --- | --- |
| theme | vscode |
| logo | (detected) |
`;

const GETTING_STARTED = `# Getting Started

Install Atlas and open the wiki.

## Requirements

You need Node.js 24.

## First run

Open the command palette and run **Open Wiki Site**.
`;

const ARCHITECTURE = `# Architecture

## Overview

Atlas has two parts, a scanner and a renderer. See [getting started](../getting-started.md).

![Data flow](images/diagram.svg)

![Root-relative diagram](/docs/images/diagram.svg)

<picture>
  <source srcset="images/diagram.svg 1x, /docs/images/diagram.svg 2x">
  <img src="images/diagram.svg" srcset="images/diagram.svg 1x,/docs/images/diagram.svg 2x" alt="Responsive diagram">
</picture>

### Scanner

The scanner finds documents.

### Renderer

The renderer draws them.

## Data flow

\`\`\`mermaid
flowchart LR
    Scanner --> Renderer
\`\`\`

## Code

\`\`\`ts
export function scan(root: string): string[] {
	return [root];
}
\`\`\`

## Unsafe content

<img src="missing.png" onerror="window.__xss = 1" alt="broken">
<script>window.__xss = 2;</script>
<style>body { display: none; }</style>
<p data-testid="inline-html">Inline <strong>HTML</strong> survives.</p>
`;

const API_HTML = `<!doctype html>
<html>
<head><title>API</title><script>window.__xss = 3;</script><style>.page { display: none; }</style></head>
<body>
<h1>API reference</h1>
<p onclick="window.__xss = 4" data-testid="api-paragraph">Every endpoint returns JSON.</p>
<h2>Endpoints</h2>
<ul><li><code>GET /docs</code></li></ul>
<h2>Errors</h2>
<p>Errors use <a href="../README.md">the shared format</a>.</p>
</body>
</html>`;

const DOC_GO = `// Package atlas scans documentation.
package atlas

// Scan returns the documents under root.
func Scan(root string) []string {
	return []string{root}
}
`;

/** The full tree, as the extension would send it for the pretend workspace. */
export function fullTree(): SiteNode[] {
	return [
		file('README.md', 'README', { isReadme: true }),
		file('getting-started.md', 'Getting Started', { description: 'Install and first run' }),
		folder('docs', 'Docs', [
			file('docs/index.md', 'Index', { isIndex: true }),
			file('docs/api.html', 'API'),
			file('docs/architecture.md', 'Architecture'),
		]),
		folder('src', 'Src', [
			file('src/data.xlsx', 'Data'),
			file('src/diagram.svg', 'Diagram'),
			file('src/doc.go', 'Doc'),
			file('src/manual.pdf', 'Manual'),
			file('src/notes.txt', 'Notes'),
		]),
	];
}

/** Trees the harness can load with `?fixture=`. */
export const TREES: Record<string, () => SiteNode[]> = {
	default: fullTree,
	noReadme: () => fullTree().filter((node) => !node.isReadme),
	empty: () => [],
};

/**
 * The page the extension would send for each document.
 *
 * @param origin The harness's origin, where fixture images are served
 * @returns Pages keyed by URI
 */
export function pages(origin: string): Map<string, PageData> {
	const base = `${origin}/fixtures`;
	const page = (path: string, title: string, data: Partial<PageData>): [string, PageData] => {
		const folderPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
		return [
			`${ROOT}/${path}`,
			{
				uri: `${ROOT}/${path}`,
				title,
				path,
				kind: 'markdown',
				resourceBase: folderPath ? `${base}/${folderPath}` : base,
				rootBase: base,
				...data,
			},
		];
	};

	return new Map([
		page('README.md', 'README', { content: README }),
		page('getting-started.md', 'Getting Started', {
			content: GETTING_STARTED,
			description: 'Install and first run',
		}),
		page('docs/index.md', 'Index', { content: 'Start with the [architecture](architecture.md).\n' }),
		page('docs/architecture.md', 'Architecture', { content: ARCHITECTURE }),
		page('docs/api.html', 'API', { kind: 'html', content: API_HTML }),
		page('src/doc.go', 'Doc', { kind: 'code', language: 'go', content: DOC_GO }),
		page('src/manual.pdf', 'Manual', { kind: 'pdf', fileSrc: `${base}/src/manual.pdf` }),
		page('src/data.xlsx', 'Data', { kind: 'binary' }),
		page('src/diagram.svg', 'Diagram', { kind: 'image', fileSrc: `${base}/src/diagram.svg` }),
		page('src/notes.txt', 'Notes', {
			kind: 'code',
			language: 'txt',
			content: 'First line of a long file.\n',
			truncated: true,
		}),
	]);
}
