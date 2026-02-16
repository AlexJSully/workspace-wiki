# Utilities

The Utilities module provides helper functions for title normalization, YAML front matter parsing, and file type detection.

## Implementation

The utilities are implemented across multiple modules:

- [`src/utils/textUtils.ts`](../../src/utils/textUtils.ts) - Text processing functions like `normalizeTitle()` and `extractFrontMatterTitle()`
- [`src/tree/buildTree.ts`](../../src/tree/buildTree.ts) - Tree building and processing functions like `buildTree()`, `sortNodes()`, `processNode()`

## YAML Front Matter Support

The extension now supports parsing YAML front matter from Markdown files to extract custom titles.

### How Front Matter Works

When a Markdown file contains YAML front matter with a `title` field, that title will be used in the tree view instead of the normalized filename.

#### Example

**File: `accessibility.md`**

```markdown
---
title: 'Introduction to Accessibility'
description: 'Guidance for creating more accessible code'
---

# Accessibility

This document provides guidance on creating accessible software.
```

**Tree View Display:** "Introduction to Accessibility" (instead of "Accessibility")

### Supported Front Matter Formats

The extension uses the [gray-matter](https://github.com/jonschlinkert/gray-matter) library, which supports:

- **YAML** (default): Delimited by `---`
- **TOML**: Delimited by `+++`
- **JSON**: Delimited by `;;;`

### Implementation Details

1. **Markdown Files Only**: Front matter parsing only applies to `.md` and `.markdown` files
2. **Title & Description Fields**: The `title` field is used for tree item display names, and the `description` field (when present) is extracted and shown as the tree item tooltip when hovering in the tree view
3. **Fallback**: If no front matter title exists, falls back to filename-based normalization
4. **Performance**: Files are read asynchronously via VS Code workspace FS when available (with Node fallback for tests) and parsed during tree building
5. **Missing Files**: Missing file paths return null values without logging to avoid noisy errors during scans

## Title Normalization

Converts file names like `userGuide.md` to `User Guide` for display in the tree.

### How Title Normalization Works

The `normalizeTitle()` function performs several transformations:

1. **Extension Removal**: Strips file extensions (`.md`, `.markdown`, `.txt`, etc.)
2. **Special README Handling**: Returns "README" for README files
3. **Case Conversion**: Transforms various naming conventions to Title Case:
    - `dash-case` → `Dash Case`
    - `snake_case` → `Snake Case`
    - `camelCase` → `Camel Case`
    - `PascalCase` → `Pascal Case`
4. **Acronym Preservation**: Maintains proper casing for technical terms

### Title Normalization Examples

```typescript
normalizeTitle('getting-started.md'); // → 'Getting Started'
normalizeTitle('api_reference.md'); // → 'API Reference'
normalizeTitle('userGuide.md'); // → 'User Guide'
normalizeTitle('HTMLParser.md'); // → 'HTML Parser'
normalizeTitle('README.md'); // → 'README'
```

### Acronym Casing

The function accepts an optional `acronyms` parameter to preserve proper casing:

```typescript
const acronyms = ['HTML', 'CSS', 'JS', 'API', 'URL', 'JSON', 'XML'];
normalizeTitle('htmlCssGuide.md', acronyms); // → 'HTML CSS Guide'
```

### Title Normalization Implementation

```typescript
function normalizeTitle(fileName: string, acronyms: string[] = []): string {
	// Remove file extension
	let title = fileName.replace(/\.[^/.]+$/, '');

	// Handle README files specially
	if (title.toLowerCase() === 'readme') {
		return 'README';
	}

	// Convert various cases to Title Case
	// Split on word boundaries, capitalize each word
	// Apply acronym casing if provided
}
```

## File Type Detection

Determines how to handle files based on extension and mime type.

See also: [Settings Manager](./settings.md)

## Utilities Usage

```mermaid
flowchart TD
  A[Title Normalizer] --> B[TreeDataProvider]
  C[File Type Detector] --> D[Scanner/Indexer]
  C --> E[Preview/Open Controller]
```

This diagram shows how utility functions are used by other modules for title normalization and file type detection.
