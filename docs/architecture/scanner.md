# Scanner

The scanner discovers documentation files in the workspace and returns matching URIs. It does not cache metadata or watch for changes.

## Implementation

The Scanner/Indexer is implemented in [`src/scanner/workspaceScanner.ts`](../../src/scanner/workspaceScanner.ts) with the main function `scanWorkspaceDocs()`.

## How It Works

- Uses `workspace.findFiles` to locate files matching supported extensions (e.g., `.md`, `.markdown`, `.txt`).
- If Markdown is a supported extension, also scans for files named `README` (with no extension, case-insensitive) and treats them as Markdown.
- Applies exclude patterns from settings and `.gitignore`.
- Filters hidden files/folders (starting with dot) based on `showHiddenFiles` setting.
- Filters ignored files based on `showIgnoredFiles` setting and exclude patterns.
- Returns matching URIs to the tree provider, which rebuilds the tree on refresh.

## File Filtering Logic

1. **Extension Matching**: Only includes files with supported extensions
2. **README (no extension) Matching**: If Markdown is supported, also includes files named `README` (no extension, case-insensitive) as Markdown
3. **Exclude Pattern Filtering**: Applies `excludeGlobs` and `.gitignore` patterns
4. **Hidden File Filtering**: Excludes files/folders starting with `.` unless `showHiddenFiles` is true
5. **Ignored File Filtering**: Excludes files in `.gitignore` unless `showIgnoredFiles` is true
6. **Depth Limiting**: Respects `maxSearchDepth` setting by calculating depth relative to workspace root

## Depth Calculation

The scanner calculates file depth relative to the workspace root for the `maxSearchDepth` feature:

- Uses `vscode.workspace.workspaceFolders[0]` to determine workspace root
- Normalizes all paths to use forward slashes for cross-platform compatibility
- Calculates relative path by removing workspace root prefix
- Counts directory separators to determine depth level
- Falls back gracefully when workspace root cannot be determined (skips depth filtering)

## Example

```ts
// Standard scan for supported extensions
const files = await vscode.workspace.findFiles('**/*.{md,markdown,txt}', '**/node_modules/**');
// Additionally, if Markdown is supported, scan for README (no extension)
const readmes = await vscode.workspace.findFiles('**/README', '**/node_modules/**');
```

## Edge Cases

- Large repos: Respects `maxSearchDepth` setting.
- Symlinks: Not followed by default.
- Binary files: Skipped.

See also: [Settings Manager](./settings.md)

## Scanner/Indexer Flow

```mermaid
flowchart TD
	A[Start Scan] --> B[Read Config]
	B -->|Get supportedExtensions| C[Set Extension Patterns]
	B -->|Get excludeGlobs| D[Set Exclude Patterns]
	B -->|Check showIgnoredFiles| E{Read .gitignore?}
	E -->|Yes| F[Parse .gitignore]
	E -->|No| G[Find Files]
	F --> H[Merge Exclude Patterns]
	H --> G
	C --> G
	D --> G
	G -->|Pattern Matching| I[Get File URIs]
	I -->|README Filter| J[Handle README Matching]
	I -->|Hidden Files Filter| K{showHiddenFiles?}
	K -->|No| L[Exclude Dot Files]
	K -->|Yes| M[Include All Files]
	J --> N{Depth OK?}
	N -->|Yes| O[Return Files]
	N -->|No| P[Skip Deep Files]
	P --> O
	L --> N
	M --> N
	O --> Q[Return Results]
```

This diagram shows the core scanning process: reading configuration, matching file patterns, filtering by various rules, and returning results.
