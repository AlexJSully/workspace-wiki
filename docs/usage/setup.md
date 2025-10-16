# Setup

This guide explains how to install and configure the Workspace Wiki extension.

## Installation

### From VS Code Marketplace

1. Open VS Code and go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
2. Search for `Workspace Wiki` and click Install.
3. Reload VS Code if prompted.

**Direct Link:** [VS Code Marketplace - Workspace Wiki](https://marketplace.visualstudio.com/items?itemName=alexjsully.workspace-wiki)

## Configuration

The extension works out-of-the-box, but you can customize it via settings:

- `workspaceWiki.supportedExtensions`: File types to include (default: `md`, `markdown`, `txt`).
- `workspaceWiki.excludeGlobs`: Glob patterns to exclude (e.g., `**/node_modules/**`).
- `workspaceWiki.defaultOpenMode`: `preview` or `editor`.
- `workspaceWiki.syncWithActiveEditor`: Auto-reveal active file in tree.
- `workspaceWiki.showIgnoredFiles`: Show files/folders listed in .gitignore and excludeGlobs (default: false).
- `workspaceWiki.showHiddenFiles`: **Show hidden files and folders** (those starting with a dot, e.g. `.github`, `.env`) in the Workspace Wiki tree, unless excluded by .gitignore or excludeGlobs. Default is false (hidden files are not shown).

To change settings:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Type `Preferences: Open Settings (UI)`.
3. Search for `Workspace Wiki`.

## Example Settings

```json
{
	"workspaceWiki.supportedExtensions": ["md", "markdown", "txt"],
	"workspaceWiki.excludeGlobs": ["**/node_modules/**", "**/.git/**"],
	"workspaceWiki.defaultOpenMode": "preview",
	"workspaceWiki.showHiddenFiles": true
}
```
