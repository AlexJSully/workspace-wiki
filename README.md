# Workspace Wiki

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/alexjsully.workspace-wiki?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=alexjsully.workspace-wiki)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/alexjsully.workspace-wiki)](https://marketplace.visualstudio.com/items?itemName=alexjsully.workspace-wiki)
[![Open VSX Version](https://img.shields.io/open-vsx/v/alexjsully/workspace-wiki)](https://open-vsx.org/extension/alexjsully/workspace-wiki)
[![Follow on Twitter](https://img.shields.io/twitter/follow/alexjsully?style=social)](https://twitter.com/alexjsully)
[![GitHub repo size](https://img.shields.io/github/repo-size/AlexJSully/workspace-wiki)](https://github.com/AlexJSully/workspace-wiki)
[![GitHub](https://img.shields.io/github/license/AlexJSully/workspace-wiki)](https://github.com/AlexJSully/workspace-wiki)
[![Build Status](https://github.com/AlexJSully/workspace-wiki/actions/workflows/code-qa-js.yaml/badge.svg)](https://github.com/AlexJSully/workspace-wiki/actions)

Workspace Wiki is a VS Code extension that scans your workspace for documentation files (Markdown, MDX, and plain text by default) and presents them in a sidebar tree view for fast preview and editing. It emphasizes readability, predictable ordering (README/index handling, alphabetical directories), and fast access via preview or edit. All operations are local-first and privacy-friendly.

![Example gif and user flow of the Workspace Wiki extension](https://github.com/AlexJSully/workspace-wiki/blob/main/media/example.gif?raw=true)

## Features

- **Workspace Wiki Tree View:** Discover all documentation files in a single sidebar tree.
- **Smart and Human Readable Title Display**: Automatically converts file names (e.g., `user-guide.md`) to readable titles (`User Guide`)
- **YAML Front Matter Support**: Markdown and MDX files with YAML front matter `title` fields display that title instead of the filename
- **Flexible File Types**: Supports `.md`, `.mdx`, `.txt` and other files with configurable extension filtering
- **Include Files by Name**: Pull in individual documentation files such as `doc.go` by name or pattern, without showing every file that shares their extension
- **Intelligent Ordering**: README files appear first, index files represent their folders, alphabetical sorting for others
- **Acronym Case Preservation:** Technical terms like HTML, CSS, API maintain proper casing in titles.
- **Intelligent File Exclusion:** Respects `.gitignore` patterns, including nested files and negation rules, plus configurable exclude globs to hide unwanted files.
- **Preview & Edit:** By default, single-click opens the best surface for the file type (`workspaceWiki.defaultOpenMode: "preview"`), and double-click opens the source in the full editor.
- **Refresh:** Update the tree on demand with the Refresh action; it also re-scans automatically when `workspaceWiki` settings change.
- **Configurable:** Supported file types, excludes, open modes, and title formatting are configurable via settings.
- **Multi-root Support:** Works with multi-root workspaces, scoping each folder's `.gitignore` rules and search depth to that folder.
- **Privacy:** No telemetry, no cloud sync, local-only by default.

## Requirements

- VS Code 1.105.0+

## Extension Settings

This extension contributes the following settings under the `workspaceWiki` namespace:

### File Discovery & Filtering

#### `workspaceWiki.supportedExtensions`

Array of file extensions to include in the workspace wiki (default: `md`, `markdown`, `mdx`, `txt`).

**Special Case:** If `md`, `markdown`, or `mdx` is included, files named `README` (with no extension, case-insensitive) are also included and treated as Markdown.

```json
{
	"workspaceWiki.supportedExtensions": ["md", "markdown", "mdx", "txt", "html", "pdf"]
}
```

#### `workspaceWiki.includeGlobs`

File names or glob patterns to include **in addition to** `supportedExtensions` (default: none). Use this when a single file is documentation but its extension is not: adding `go` to `supportedExtensions` would show every Go source file, while `doc.go` here shows only that file.

A pattern containing no `/` matches at any depth; a pattern with a `/` is matched as written.

```json
{
	"workspaceWiki.includeGlobs": ["doc.go", "*.guide.ts", "docs/notes/*.adoc", "CHANGELOG"]
}
```

Included files are filtered exactly like extension matches: `excludeGlobs`, `.gitignore`, the hidden-file rule, and `maxSearchDepth` all still apply. Their titles come from the file name, since front matter is read only from Markdown and MDX files.

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

Any extension you add here that is not already in `supportedExtensions` is added to it, and the updated list is written to your workspace settings.

```json
{
	"workspaceWiki.openWith": {
		"md": "workspace-wiki.openMarkdown",
		"markdown": "workspace-wiki.openMarkdown",
		"mdx": "workspace-wiki.openMarkdown",
		"txt": "vscode.open",
		"pdf": "vscode.open",
		"html": "otherExtension.preview"
	}
}
```

##### How Markdown files open

`workspace-wiki.openMarkdown` is the default for Markdown, and picks the best surface the running VS Code offers:

1. **Markdown Editor:** VS Code's built-in rendered, in-place-editable Markdown surface, added in VS Code 1.131. It only claims `.md` files.
2. **Markdown Preview** (`markdown.showPreview`), used for `.mdx`, `.markdown`, an extensionless `README`, and on any VS Code that predates the Markdown Editor.
3. **A plain open** (`vscode.open`), which follows whatever your `workbench.editorAssociations` says, when neither of the above is available.

To always use the read-only preview instead, set the extensions you care about back to `markdown.showPreview`:

```json
{
	"workspaceWiki.openWith": {
		"md": "markdown.showPreview"
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
		"FHIR"
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
