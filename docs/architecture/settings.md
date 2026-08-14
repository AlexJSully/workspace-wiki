# Settings Manager

The Settings Manager reads and applies user configuration for the Workspace Wiki extension.

## Supported Settings

### File Discovery & Filtering

- `workspaceWiki.supportedExtensions`: File types to scan (default: `md`, `markdown`, `mdx`, `txt`).
    - If `md`, `markdown`, or `mdx` is included, files named `README` (no extension, case-insensitive) are also included and treated as Markdown.
- `workspaceWiki.includeGlobs`: File names or glob patterns to include in addition to `supportedExtensions` (default: none), for documentation whose extension should not be scanned wholesale, such as `doc.go`. A pattern containing no `/` matches at any depth. Matches are filtered by `excludeGlobs`, `.gitignore`, the hidden-file rule, and `maxSearchDepth` like every other match; see [Scanner](./scanner.md).
- `workspaceWiki.excludeGlobs`: Glob patterns to exclude files and folders (default: `**/node_modules/**`, `**/.git/**`).
- `workspaceWiki.maxSearchDepth`: Maximum directory depth to search for documentation files (default: `10`).
- `workspaceWiki.showIgnoredFiles`: Show files listed in `.gitignore` and matched by `excludeGlobs` patterns (default: `false`). When `false`, every `.gitignore` in every workspace folder applies, nested files and negation rules included; see [Scanner](./scanner.md).
- `workspaceWiki.showHiddenFiles`: Show hidden files and folders starting with a dot (e.g., `.github`, `.env`) (default: `false`).

### File Opening & Display

- `workspaceWiki.defaultOpenMode`: `preview` or `editor` (default: `preview`).
- `workspaceWiki.openWith`: Commands to use for opening different file types (default: `workspace-wiki.openMarkdown` for `.md`/`.markdown`/`.mdx`, `vscode.open` for `.txt`). `workspace-wiki.openMarkdown` is a command this extension registers, not a VS Code one; it picks the best Markdown surface the running VS Code offers, described in [Preview/Open Controller](./preview-controller.md). An extension with no entry opens with `vscode.open`.
- `workspaceWiki.directorySort`: How to sort files and folders: `files-first`, `folders-first`, or `alphabetical` (default: `files-first`).

### Title Formatting

- `workspaceWiki.acronymCasing`: Acronyms to preserve proper casing in file titles (default: `HTML`, `CSS`, `JS`, `TS`, `API`, `URL`, `JSON`, `XML`, `HTTP`, `HTTPS`, `REST`, `SQL`, `CSV`, `FHIR`).

### Sync & Auto-Reveal

- `workspaceWiki.autoReveal`: Automatically reveal the active file in the Workspace Wiki tree when the editor changes (default: `true`).
- `workspaceWiki.autoRevealDelay`: Delay in milliseconds before revealing the active file (default: `500`). Set to `0` for immediate reveal.

## Example

```ts
const config = vscode.workspace.getConfiguration('workspaceWiki');
const extensions = config.get<string[]>('supportedExtensions');
```

## How to Change Settings

- Open Command Palette → Preferences: Open Settings (UI)
- Search for "Workspace Wiki"

See also: [Usage/Setup](../usage/setup.md)

## Settings Flow

```mermaid
flowchart TD
	accTitle: Settings Application Flow
	accDescr: Shows how user settings flow from VS Code Settings through the Settings Manager and are applied to each module - Scanner, TreeDataProvider, Preview Controller, and Sync Module.
	A[User] -->|Updates Settings| B[VS Code Settings]
	B -->|Read by| C[Settings Manager]
	C -->|Applies to| D[Scanner/Indexer]
	C -->|Applies to| E[TreeDataProvider]
	C -->|Applies to| F[Preview/Open Controller]
	C -->|Applies to| G[Sync Module]
```

This diagram shows how user settings are read and applied by the Settings Manager to all major modules.
