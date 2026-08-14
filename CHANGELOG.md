# Change Log

All notable changes to the Workspace Wiki extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

To see tags and releases, please go to [Tags](https://github.com/AlexJSully/workspace-wiki/tags) on [GitHub](https://github.com/AlexJSully/workspace-wiki).

## [1.2.0] - 2026-08-14

Features:

- **VS Code for the Web**: The extension now runs in the browser on [vscode.dev](https://vscode.dev) and [github.dev](https://github.dev), including virtual workspaces such as remotely opened repositories
- **Untrusted Workspaces**: The documentation tree now works in workspaces you have not marked as trusted
- **MDX Support**: `.mdx` files are included by default, have their YAML front matter `title` read, and open the same way `.md` files do
- **Include Files by Name**: The new `workspaceWiki.includeGlobs` setting pulls individual documentation files into the tree by name or pattern, such as `doc.go` or `*.guide.ts`, without showing every other file that shares their extension
- **Markdown Editor**: Markdown now opens in VS Code's built-in Markdown Editor when the running version offers it (VS Code 1.131+, `.md` only), falling back to Markdown Preview and then to a plain open

Configuration:

- The default `workspaceWiki.openWith` command for Markdown changed from `markdown.showPreview` to `workspace-wiki.openMarkdown`, which chooses between the Markdown Editor, Markdown Preview, and a plain open based on what your VS Code supports. To always get the read-only preview, set `"md": "markdown.showPreview"`. If you have already customised `openWith`, your entries are untouched.

Update:

- Workspace Wiki now requires VS Code 1.105.0 or newer, up from 1.99.3.

Bug Fixes:

- `.gitignore` rules are now applied across every workspace folder, including nested `.gitignore` files and `!` negation patterns. Previously only the first folder's top-level `.gitignore` was read, and its patterns were converted approximately.
- `excludeGlobs` patterns are now matched as real globs rather than by substring, so a pattern no longer hides unrelated files whose path merely contains it
- `maxSearchDepth` is now counted from each workspace folder in a multi-root workspace, instead of from the first folder for every file
- `README` files with no extension now sort to the top of their folder, the way `README.md` already did
- File titles now drop whatever extension a file has, so entries such as `.adoc`, `.mdx`, and `doc.go` read as clean titles
- Folder names containing a dot, such as `docs.v2`, now keep their full name in the tree

## [1.1.0] - 2026-02-20

Feature:

- **YAML Front Matter Support**: Markdown files with YAML front matter can now use a `title` field to customize how files appear in the tree view, providing better control over document display names

## [1.0.4] - 2025-10-30

Bug Fix:

- Fixed a bug where README files with no extension were not appearing in the Workspace Wiki tree even when Markdown was a supported extension.

## [1.0.3] - 2025-10-28

Features:

- Reduce VS Code engine requirements to v1.99.3 to make the Workspace Wiki extension compatible with Cursor

## [1.0.2] - 2025-10-18

Optimization:

- Made extension smaller (from 1.7mb to 40kb)
- Optimized SVG icon to be smaller and made PNG icon white instead of black for better visibility

## [1.0.1] - 2025-10-17

Minor update to README documentation.

## [1.0.0] - 2025-10-17

**The first stable release of the Workspace Wiki VS Code extension is here!**

New feature:

- Added auto-reveal sync functionality that automatically highlights the active file in the documentation tree as you switch editors

UI/UX:

- Added extension icon and gallery banner for improved marketplace presentation and branding
- Enhanced tree view with automatic file revelation and configurable delay settings

Architecture:

- Modular architecture refactoring moving key logic from main extension file into dedicated modules

Configuration:

- Added `workspaceWiki.autoReveal` setting to control automatic file revelation in the tree (default: true)
- Added `workspaceWiki.autoRevealDelay` setting to control delay before revealing files (default: 500ms)
- Added extension homepage and contributors information to `package.json`

Documentation:

- Comprehensive documentation updates including sync feature implementation details, configuration guides, and usage instructions
- Updated architecture documentation to reflect modular structure and new components
- Established `docs/` directory as canonical source of truth for all project knowledge

Update:

- Updated VS Code engine requirement to ^1.105.0
- Updated build configuration
- Updated marketplace metadata and branding elements

Bug fix:

- Fixed extension activation and initialization issues
- Improved file handling and tree synchronization reliability

## [0.1.0] - 2025-10-13

- Initial release
