# Workspace Wiki — Design Document

**Author:** Alex

**Date:** 2025-10-11

**Purpose:** Design document (TDD / DD hybrid) describing the Workspace Wiki VS Code extension: goals, UX, architecture, tech stack, features, settings, implementation plan, and security/privacy considerations.

---

## 1. Summary / Elevator Pitch

**Workspace Wiki** is a VS Code extension that scans the current workspace for documentation files (Markdown and plain text by default) and presents them in a single tree-style sidebar view that acts like a lightweight project wiki. The view emphasizes readability (file names converted to human-friendly titles), predictable ordering (README / index handling, root files, alphabetical directories), and fast access via preview or edit. It is local-first, respects user settings, and is extensible.

---

## 2. Goals & Non-Goals

### Goals

- Provide a single discoverable tree of documentation across the workspace.
- Treat `README.md`, `readme.md`, and `index.md` as semantic landing pages for folders.
- Display readable titles from file names (e.g. `userGuide.md` → `User Guide`).
- Open files in VS Code preview mode by default; allow edit/open in full editor on double-click or explicit action.
- Keep configuration minimal but flexible via VS Code settings.
- Live-update (auto-refresh) the tree when files change.
- Keep everything local (no external telemetry or cloud sync by default).

### Non-Goals

- Replace full-featured documentation sites (Docusaurus, MkDocs).
- Provide heavy WYSIWYG editing for non-Markdown formats (e.g., Word). PDFs and .docx are preview-only.

---

## 3. Scope & Supported File Types

**MVP (enabled by default):**

- `.md`, `.markdown`, `.txt`

**Optional (configurable):**

- `.pdf` (preview only)
- `.html`, `.htm` (OFF by default — can be enabled in settings)

**Future / Nice-to-have:**

- `.doc`/`.docx` (preview via OS or installed extensions)

---

## 4. UX & Behavior

### Sidebar Tree View

- A new tree view placed in the Explorer area: `Workspace Wiki`.
- Tree root = workspace folders (multi-root workspaces supported).
- Node types: Folder, File (doc), and Virtual Landing Page (if `index.md` exists).

### Ordering Rules

1. **README (at root) at the very top** of the workspace root. If `README.md` and `readme.md` both exist, prefer case-insensitive match and prefer `README.md`.
2. **Root-level docs** (files in workspace root) appear immediately after README.
3. **Directories** appear alphabetically (case-insensitive), except that directories containing an `index.md` will render their node using the index file's readable title.
4. Within a directory: `index.md` shows as the directory node; other files sorted alphabetically; `README.md` inside a directory gets special placement (top of that directory's listing) but still below the directory node.

#### Example Workspace & Expected Tree

**Workspace structure:**

```text
/my-project
├── README.md
├── CONTRIBUTING.md
├── changelog.md
├── docs/
│   ├── index.md
│   ├── gettingStarted.md
│   ├── API.md
│   └── README.md
├── tutorials/
│   ├── index.md
│   ├── firstSteps.md
│   └── advanced.md
└── notes.txt
```

**Expected Workspace Wiki tree:**

```text
Workspace Wiki
├── README           (from README.md at root)
├── Changelog        (from changelog.md)
├── Contributing     (from CONTRIBUTING.md)
├── Notes            (from notes.txt)
├── Docs             (folder node from docs/index.md)
│   ├── README       (from docs/README.md)
│   ├── API          (from API.md)
│   └── Getting Started (from gettingStarted.md)
├── Tutorials        (folder node from tutorials/index.md)
│   ├── Advanced     (from advanced.md)
│   └── First Steps  (from firstSteps.md)
```

Notes:

- `README.md` at root is always top.
- Root-level files after README are alphabetical.
- `index.md` in a folder replaces the folder name in the tree.
- Other files inside directories sorted alphabetically; `README.md` inside a folder is listed at top below folder node.

---

## 5. Architecture & Components

### High-level components

- **Scanner / Indexer Module**
    - Uses `workspace.findFiles` and a file system watcher (FileSystemWatcher / chokidar) to discover docs.
    - Caches metadata (title, path, mtime) for performance.

- **TreeDataProvider**
    - Implements VS Code `TreeDataProvider` to populate the `Workspace Wiki` tree view.
    - Responsible for converting file system entries to readable nodes and ordering.

- **Preview/Open Controller**
    - Handles user interactions (single-click, double-click, context menu).
    - Uses `commands.executeCommand('vscode.openWith' ...)` or `workspace.openTextDocument` + `window.showTextDocument`.

- **Settings Manager**
    - Reads extension configuration from `configuration.get('workspaceWiki')` and exposes typed settings to other modules.

- **Sync Module**
    - Listens to `window.onDidChangeActiveTextEditor` and reveals the active file in the tree.

- **Utilities**
    - Title normalizer, frontmatter parser (`gray-matter`), mime-type detection, extension-to-handler mapping.

---

## 6. Tech Stack & Tooling

- **Language:** TypeScript (strict mode).
- **VS Code API** for extension lifecycle, TreeDataProvider, commands, workspace, window.
- **Bundler:** esbuild or webpack (VSIX build pipeline) — prefer `esbuild` for faster builds.
- **Testing:** Jest (unit tests for utils; integration tests with `vscode-test`/`@vscode/test-electron`).
- **Linting:** ESLint with TypeScript plugin. Enable recommended rules + Prettier integration.
- **Formatting:** Prettier.
- **Package manager:** npm
- **Optional libs:**
    - `jsdom` (if parsing HTML to detect documentation-like HTML)

---

## 7. VS Code Settings (suggested)

Use `contributes.configuration` to add these settings under `workspaceWiki` namespace.

```json
{
	"workspaceWiki.supportedExtensions": ["md", "markdown", "txt"],
	"workspaceWiki.defaultOpenMode": "preview",
	"workspaceWiki.syncWithActiveEditor": true,
	"workspaceWiki.openWith": {
		"pdf": "my-pdf-viewer-extension-id",
		"md": "vscode.markdown.preview"
	},
	"workspaceWiki.scanOnStartup": true,
	"workspaceWiki.maxSearchDepth": 10,
	"workspaceWiki.excludeGlobs": ["**/node_modules/**", "**/.git/**"]
}
```

---

## 8. Developer Experience (DX) & Quality

- **TypeScript Strict**: `strict: true` in tsconfig.
- **ESLint + Prettier**: Pre-commit `lint-staged` + Husky for pre-push guards.
- **Testing**: Jest unit tests, and smoke tests with `@vscode/test-electron` to validate TreeDataProvider behavior.
- **CI**: GitHub Actions pipeline: `build`, `lint`, and `test`.

---

## 9. Security & Privacy

- **Local-only operations by default**: all scanning, caching, and metadata storage happens in the workspace and optionally the extension global storage folder. No telemetry, no external APIs.
- **Extensions**: If `openWith` points to another extension, inform the user and allow disabling auto `openWith` behavior.
- **Sensitive files**: Respect `excludeGlobs` and workspace `.gitignore`. Default excludes: `.git`, `node_modules`, `.vscode`.
- **Storage**: If caching metadata to disk, encrypt/obfuscate nothing — keep simple JSON in the extension storage path, but provide a setting to disable persistent cache.
- **Permissions**: No elevated permissions required.

---

## 10. Edge Cases & Considerations

- **Very large repos**: allow a `maxSearchDepth` and lazy-loading per-folder to avoid scanning entire repo at startup.
- **Case-insensitive filesystems**: treat `README.md` and `readme.md` as equivalent; prefer one canonical version.
- **Binary files detection**: avoid attempting to open heavy binary files as text.
- **Circular references**: do not follow symlinks by default to prevent loops.

---

## 11. APIs & VS Code Contributes

- `contributes.views` to add `workspaceWiki` to Explorer view container.
- `contributes.configuration` for settings.
- Commands to `revealInWorkspaceWiki`, `workspaceWiki.openInPreview`, `workspaceWiki.openInEditor`, `workspaceWiki.refresh`.

---

## 12. Final Recommendations

- **Start small**: ship MD + TXT support and the tree with README/index behavior. This unlocks the majority of value.
- **Make HTML opt-in**: it prevents noise in web projects.
- **Keep it local-first & privacy-friendly**: makes adoption easier in corporate settings.
- **Prioritize developer DX**: fast scan, minimal UI friction, keyboard navigable.
