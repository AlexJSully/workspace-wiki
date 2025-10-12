# Workspace Wiki README

Workspace Wiki is a VS Code extension that scans your workspace for documentation files (Markdown and plain text by default) and presents them in a sidebar tree view for fast preview and editing. It emphasizes readability, predictable ordering (README/index handling, alphabetical directories), and fast access via preview or edit. All operations are local-first and privacy-friendly.

## Features

- **Workspace Wiki Tree View:** Discover all documentation files in a single sidebar tree.
- **Smart Ordering:** README at root is always top; index.md in folders replaces folder name; alphabetical sorting elsewhere.
- **Human-Friendly Titles:** File names are normalized to readable titles; frontmatter titles supported.
- **Preview & Edit:** Single-click to preview, double-click to edit in full editor.
- **Live Updates:** Tree auto-refreshes when files change.
- **Configurable:** Supported file types, excludes, and open modes are configurable via settings.
- **Multi-root Support:** Works with multi-root workspaces.
- **Privacy:** No telemetry, no cloud sync, local-only by default.

## Requirements

- VS Code 1.70+
- Node.js 18+

## Extension Settings

This extension contributes the following settings under the `workspaceWiki` namespace:

- `workspaceWiki.supportedExtensions`: Array of file extensions to include (default: ["md", "markdown", "txt"])
- `workspaceWiki.excludeGlobs`: Glob patterns to exclude from scanning
- `workspaceWiki.defaultOpenMode`: "preview" or "editor" (default: "preview")
- `workspaceWiki.enableHtml`: Enable HTML file support (default: false)
- `workspaceWiki.includePdf`: Enable PDF file support (default: false)
- `workspaceWiki.maxSearchDepth`: Maximum folder depth to scan
- `workspaceWiki.autoRevealDelayMs`: Delay in ms before auto-revealing active file

## Known Issues

- Large repos may require tuning `maxSearchDepth` for performance.
- PDF and HTML preview is opt-in and may require additional extensions.
- Binary files are not supported for text preview.

---

## Extension Guidelines

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

- [VS Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy using Workspace Wiki!**
