# Workspace Wiki

Workspace Wiki is a VS Code extension that scans your workspace for documentation files (Markdown and plain text by default) and presents them in a sidebar tree view for fast preview and editing. It emphasizes readability, predictable ordering (README/index handling, alphabetical directories), and fast access via preview or edit. All operations are local-first and privacy-friendly.

## Features

- **Workspace Wiki Tree View:** Discover all documentation files in a single sidebar tree.
- **Smart Ordering:** README at root is always top; index.md in folders replaces folder name; alphabetical sorting elsewhere.
- **Human-Friendly Titles:** File names are normalized to readable titles (e.g., "test-htm.htm" → "Test Htm"); frontmatter titles supported.
- **Acronym Case Preservation:** Technical terms like HTML, CSS, API maintain proper casing in titles.
- **Intelligent File Exclusion:** Respects .gitignore patterns and configurable exclude globs to hide unwanted files.
- **Preview & Edit:** Single-click to preview, double-click to edit in full editor.
- **Live Updates:** Tree auto-refreshes when files change.
- **Configurable:** Supported file types, excludes, open modes, and title formatting are configurable via settings.
- **Multi-root Support:** Works with multi-root workspaces.
- **Privacy:** No telemetry, no cloud sync, local-only by default.

## Requirements

- VS Code 1.105+

## Extension Settings

This extension contributes the following settings under the `workspaceWiki` namespace:

### File Discovery & Filtering

- `workspaceWiki.supportedExtensions`: Array of file extensions to include (default: ["md", "markdown", "txt"])
- `workspaceWiki.excludeGlobs`: Glob patterns to exclude from scanning (default: ["**/node_modules/**", "**/.git/**"])
- `workspaceWiki.maxSearchDepth`: Maximum folder depth to scan (default: 10)
- `workspaceWiki.showIgnoredFiles`: Show files listed in .gitignore and excludeGlobs (default: false)

### File Opening & Display

- `workspaceWiki.defaultOpenMode`: "preview" or "editor" (default: "preview")
- `workspaceWiki.openWith`: Commands to use for opening different file types (default: md/markdown → markdown.showPreview, txt → vscode.open)
- `workspaceWiki.directorySort`: How to sort files and folders - "files-first", "folders-first", or "alphabetical" (default: "files-first")

### Title Formatting

- `workspaceWiki.acronymCasing`: Array of acronyms to preserve proper casing in file titles (default: ["HTML", "CSS", "JS", "TS", "API", "URL", "JSON", "XML", "HTTP", "HTTPS", "REST", "SQL", "CSV", "FHIR"])

## File Exclusion

The extension automatically excludes files based on:

1. **Default excludes:** `node_modules` and `.git` directories
2. **Custom excludes:** Patterns defined in `workspaceWiki.excludeGlobs` setting
3. **GitIgnore patterns:** Files and folders listed in your workspace's `.gitignore` file

To show ignored files in the tree, set `workspaceWiki.showIgnoredFiles` to `true`.

## Known Issues

- Large repos may require tuning `maxSearchDepth` for performance.
- Binary files are not supported for text preview.

**Enjoy using Workspace Wiki!**
