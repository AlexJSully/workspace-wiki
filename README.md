# Workspace Wiki

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/alexjsully.workspace-wiki?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=alexjsully.workspace-wiki)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/alexjsully.workspace-wiki)](https://marketplace.visualstudio.com/items?itemName=alexjsully.workspace-wiki)
[![Open VSX Version](https://img.shields.io/open-vsx/v/alexjsully/workspace-wiki)](https://open-vsx.org/extension/alexjsully/workspace-wiki)
[![Follow on Twitter](https://img.shields.io/twitter/follow/alexjsully?style=social)](https://twitter.com/alexjsully)
[![GitHub repo size](https://img.shields.io/github/repo-size/AlexJSully/alexjsully-portfolio)](https://github.com/AlexJSully/alexjsully-portfolio)
[![GitHub](https://img.shields.io/github/license/AlexJSully/alexjsully-portfolio)](https://github.com/AlexJSully/alexjsully-portfolio)
[![Build Status](https://github.com/AlexJSully/workspace-wiki/actions/workflows/code-qa-js.yaml/badge.svg)](https://github.com/AlexJSully/workspace-wiki/actions)

Workspace Wiki is a VS Code extension that scans your workspace for documentation files (Markdown and plain text by default) and presents them in a sidebar tree view for fast preview and editing. It emphasizes readability, predictable ordering (README/index handling, alphabetical directories), and fast access via preview or edit. All operations are local-first and privacy-friendly.

![Example gif and user flow of the Workspace Wiki extension](https://github.com/AlexJSully/workspace-wiki/blob/main/media/example.gif?raw=true)

## Features

- **Workspace Wiki Tree View:** Discover all documentation files in a single sidebar tree.
- **Smart and Human Readable Title Display**: Automatically converts file names (e.g., `user-guide.md`) to readable titles (`User Guide`)
- **Flexible File Types**: Supports `.md`, `.txt` and other files with configurable extension filtering
- **Intelligent Ordering**: README files appear first, index files represent their folders, alphabetical sorting for others
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

#### `workspaceWiki.supportedExtensions`

Array of file extensions to include in the workspace wiki.

```json
{
	"workspaceWiki.supportedExtensions": ["md", "markdown", "txt", "html", "pdf"]
}
```

#### `workspaceWiki.excludeGlobs`

Glob patterns to exclude from scanning.

```json
{
	"workspaceWiki.excludeGlobs": [
		"**/node_modules/**",
		"**/.git/**",
		"**/dist/**",
		"**/build/**",
		"**/coverage/**",
		"**/.next/**"
	]
}
```

#### `workspaceWiki.maxSearchDepth`

Maximum folder depth to scan (default: 10). If you have a large repository, you may want to adjust this value to best suit your performance needs and workspace/codebase structure.

```json
{
	"workspaceWiki.maxSearchDepth": 15
}
```

#### `workspaceWiki.showIgnoredFiles`

Show files listed in .gitignore and excludeGlobs (default: false).

#### `workspaceWiki.showHiddenFiles`

Show hidden files and folders (those starting with a dot, e.g. .github, .env) in the Workspace Wiki tree (default: false).

### File Opening & Display

#### `workspaceWiki.defaultOpenMode`

Default mode for opening files: "preview" or "editor" (default: "preview").

#### `workspaceWiki.openWith`

Commands to use for opening different file types. This supports adding other extensions' commands for specialized previews.

```json
{
	"workspaceWiki.openWith": {
		"md": "markdown.showPreview",
		"markdown": "markdown.showPreview",
		"txt": "vscode.open",
		"pdf": "vscode.open",
		"html": "otherExtension.preview"
	}
}
```

#### `workspaceWiki.directorySort`

How to sort files and folders within directories. Options are:

- `files-first`: Show files before folders
- `folders-first`: Show folders before files
- `alphabetical`: Sort files and folders alphabetically

```json
{
	"workspaceWiki.directorySort": "folders-first"
}
```

### Title Formatting

#### `workspaceWiki.acronymCasing`

Array of acronyms to preserve proper casing in file titles.

```json
{
	"workspaceWiki.acronymCasing": [
		"HTML",
		"CSS",
		"JS",
		"TS",
		"API",
		"URL",
		"JSON",
		"XML",
		"HTTP",
		"HTTPS",
		"REST",
		"SQL",
		"CSV",
		"FHIR",
		"BFF",
		"MFE",
		"PDF",
		"VSC"
	]
}
```

### Sync & Auto-Reveal

#### `workspaceWiki.autoReveal`

Automatically reveal the active file in the Workspace Wiki tree when the editor changes (default: true).

#### `workspaceWiki.autoRevealDelay`

Delay in milliseconds before revealing the active file in the tree (default: 500).

```json
{
	"workspaceWiki.autoRevealDelay": 1000
}
```

## File Exclusion

The extension automatically excludes files based on:

1. **Default excludes:** `node_modules` and `.git` directories
2. **Custom excludes:** Patterns defined in `workspaceWiki.excludeGlobs` setting
3. **GitIgnore patterns:** Files and folders listed in your workspace's `.gitignore` file

To show ignored files in the tree, set `workspaceWiki.showIgnoredFiles` to `true`.

To show hidden files (those starting with a dot), set `workspaceWiki.showHiddenFiles` to `true`.

**Enjoy using Workspace Wiki!**
