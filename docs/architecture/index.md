# Architecture Overview

**_Update File: /Users/joohyun/Documents/code/workspace-wiki/docs/architecture/scanner.md
This section explains the overall architecture of the Workspace Wiki extension, including its main modules, data flow, and integration points with VS Code.
_** Update File: /Users/joohyun/Documents/code/workspace-wiki/docs/architecture/treedataprovider.md

## Main Components

\*\*\* Update File: /Users/joohyun/Documents/code/workspace-wiki/docs/architecture/preview-controller.md

- **Scanner/Indexer**: Discovers documentation files in the workspace, caches metadata, and watches for changes.
- **TreeDataProvider**: Renders the documentation tree in the sidebar, applying ordering and title normalization.
- **Preview/Open Controller**: Handles file opening (preview/editor) and user interactions.
- **Settings Manager**: Reads and applies extension settings.
- **Sync Module**: Keeps the tree in sync with the active editor.
- **Utilities**: Helpers for title normalization, frontmatter parsing, and file type detection.
  **_Update File: /Users/joohyun/Documents/code/workspace-wiki/docs/architecture/settings.md
  _** Update File: /Users/joohyun/Documents/code/workspace-wiki/docs/architecture/sync.md

## Subpages

\*\*\* Update File: /Users/joohyun/Documents/code/workspace-wiki/docs/architecture/utilities.md

- [Scanner/Indexer](./scanner.md)
- [TreeDataProvider](./treedataprovider.md)
- [Preview/Open Controller](./preview-controller.md)
- [Settings Manager](./settings.md)
- [Sync Module](./sync.md)
- [Utilities](./utilities.md)
  \*\*\* End Patch

## Architecture Overview Diagram

```mermaid
flowchart TD
	A[Scanner/Indexer] -->|Discovers files| B[TreeDataProvider]
	B -->|Displays tree| C[VS Code Sidebar]
	B -->|Opens file| D[Preview/Open Controller]
	D -->|Uses| E[VS Code Editor]
	A -->|Reads| F[Settings Manager]
	D -->|Reads| F
	F -->|Syncs| G[Sync Module]
	B -->|Uses| H[Utilities]
	A -->|Uses| H
	D -->|Uses| H
```

This diagram shows the main modules and their interactions. The Scanner/Indexer discovers files, which are passed to the TreeDataProvider for display. The Preview/Open Controller manages file opening, and all modules use the Settings Manager and Utilities as needed. The Sync Module keeps the tree in sync with the active editor.
