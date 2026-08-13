# Utilities

The Utilities module provides helper functions for title normalization, YAML front matter parsing, and file type detection.

## Implementation

The utilities are implemented across multiple modules:

- [`src/utils/textUtils.ts`](../../src/utils/textUtils.ts) - Text processing functions like `normalizeTitle()` and `extractFrontMatterTitle()`
- [`src/tree/buildTree.ts`](../../src/tree/buildTree.ts) - Tree building and processing functions like `buildTree()`, `sortNodes()`, `processNode()`

## YAML Front Matter Support

The extension parses YAML front matter from Markdown and MDX files to extract custom titles.

### How Front Matter Works

When a `.md`, `.markdown`, or `.mdx` file contains YAML front matter with a `title` field, that title will be used in the tree view instead of the normalized filename. Files of any other type, including those pulled in by `includeGlobs`, are titled from their name.

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

### Supported Front Matter Format

YAML front matter delimited by `---` is the only supported format. [`extractFrontMatter`](../../src/utils/textUtils.ts) splits the leading block with a regular expression that tolerates a UTF-8 byte order mark and CRLF line endings, then parses it with [js-yaml](https://github.com/nodeca/js-yaml).

js-yaml follows the YAML specification, which forbids tab characters in indentation. A front matter block indented with tabs does not parse, and the file falls back to its filename-derived title.

### Implementation Details

1. **Markdown-Derived Files Only**: Front matter parsing only applies to `.md`, `.markdown`, and `.mdx` files
2. **Title & Description Fields**: The `title` field is used for tree item display names, and the `description` field (when present) is extracted and shown as the tree item tooltip when hovering in the tree view
3. **Fallback**: If no front matter title exists, falls back to filename-based normalization
4. **File Access**: Files are read asynchronously through `vscode.workspace.fs` and decoded with `TextDecoder`, so parsing works against any file system provider, and are parsed during tree building
5. **Missing Files**: A `FileNotFound` or `ENOENT` error returns null values without logging, so a file deleted mid-scan does not produce noise

## Title Normalization

Converts file names like `userGuide.md` to `User Guide` for display in the tree.

### How Title Normalization Works

The `normalizeTitle()` function performs several transformations:

1. **Extension Removal**: Strips whatever trailing extension the name carries, so a file included by name (`doc.go`) reads like any other document. Nothing is stripped when no characters would remain (`.env`), and the caller can turn stripping off entirely, which [`buildTree`](../../src/tree/buildTree.ts) does for folder names so `docs.v2` keeps its suffix.
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
normalizeTitle('api_reference.md', ['API']); // → 'API Reference'
normalizeTitle('userGuide.md'); // → 'User Guide'
normalizeTitle('htmlParser.md', ['HTML']); // → 'HTML Parser'
normalizeTitle('README.md'); // → 'README'
normalizeTitle('doc.go'); // → 'Doc'
normalizeTitle('docs.v2', [], false); // → 'Docs.V2' (a folder name, kept whole)
```

### Acronym Casing

The function accepts an optional `acronyms` parameter to preserve proper casing:

```typescript
const acronyms = ['HTML', 'CSS', 'JS', 'API', 'URL', 'JSON', 'XML'];
normalizeTitle('htmlCssGuide.md', acronyms); // → 'HTML CSS Guide'
```

## File Type Detection

[`getFileExtension`](../../src/utils/textUtils.ts) reads the extension from the final path segment only, so a dotted directory name such as `/docs.v2/README` does not yield a spurious extension. [`previewController.ts`](../../src/controllers/previewController.ts) passes it `uri.path` to choose the command for a file, `extractFrontMatter` uses it to restrict parsing to Markdown and MDX, and `normalizeTitle` uses it to decide what to strip.

## Include Pattern Normalization

[`toSearchGlob`](../../src/utils/fileUtils.ts) prefixes a pattern with `**/` when it names a file rather than a path, because both `findFiles` and [`matchesGlobPattern`](../../src/utils/fileUtils.ts) anchor a slashless pattern to the start of the path. Without it, `doc.go` in `includeGlobs` would match only at the workspace root. The [scanner](./scanner.md) applies it when building search patterns and the [sync module](./sync.md) applies it when deciding whether to reveal the active file, so both agree on what a pattern means.

Separators are normalized before that decision, through `normalizePath`. The setting is typed by hand, so a Windows user may write `docs\notes\*.adoc`; left alone it holds no forward slash, would be read as a bare file name, and would then match nothing, since `findFiles` understands only forward slashes.

```typescript
toSearchGlob('doc.go'); // → '**/doc.go'
toSearchGlob('*.guide.ts'); // → '**/*.guide.ts'
toSearchGlob('docs/notes/*.adoc'); // → 'docs/notes/*.adoc'
toSearchGlob('docs\\notes\\*.adoc'); // → 'docs/notes/*.adoc'
```

See also: [Settings Manager](./settings.md)

## Utilities Usage

```mermaid
flowchart TD
  accTitle: Utilities Module Relationships
  accDescr: Shows how the utility functions are consumed by other modules. The title normalizer feeds the TreeDataProvider, while the file type detector feeds both the Scanner/Indexer and the Preview/Open Controller.
  A[Title Normalizer] --> B[TreeDataProvider]
  C[File Type Detector] --> D[Scanner/Indexer]
  C --> E[Preview/Open Controller]
```

This diagram shows how utility functions are used by other modules for title normalization and file type detection.
