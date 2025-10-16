# Setup

This guide explains how to install and configure the Workspace Wiki extension.

## Installation

1. Open VS Code and go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
2. Search for `Workspace Wiki` and click Install.
3. Reload VS Code if prompted.

## Configuration

The extension works out-of-the-box, but you can customize it via settings:

- `workspaceWiki.supportedExtensions`: File types to include (default: `md`, `markdown`, `txt`).
- `workspaceWiki.excludeGlobs`: Glob patterns to exclude (e.g., `**/node_modules/**`).
- `workspaceWiki.defaultOpenMode`: `preview` or `editor`.
- `workspaceWiki.syncWithActiveEditor`: Auto-reveal active file in tree.

To change settings:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Type `Preferences: Open Settings (UI)`.
3. Search for `Workspace Wiki`.

## Example Settings

```json
{
	"workspaceWiki.supportedExtensions": ["md", "markdown", "txt"],
	"workspaceWiki.excludeGlobs": ["**/node_modules/**", "**/.git/**"],
	"workspaceWiki.defaultOpenMode": "preview"
}
```

## Screenshots

[INSERT SCREENSHOT HERE]
