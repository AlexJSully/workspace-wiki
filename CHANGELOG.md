# Change Log

All notable changes to the Workspace Wiki extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

To see tags and releases, please go to [Tags](https://github.com/AlexJSully/workspace-wiki/tags) on [GitHub](https://github.com/AlexJSully/workspace-wiki).

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
