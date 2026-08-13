# Example Directory - Workspace Wiki Test Structure

This `/example` directory contains a comprehensive test structure for the Workspace Wiki VS Code extension. It demonstrates the expected file organization, ordering, and display behavior for various file types and directory structures.

## Purpose

This directory serves as:

- Test data for end-to-end tests in `extension.e2e.test.ts`
- Reference implementation of the file sorting and display rules
- Validation that the extension properly handles different file types and structures

## Structure Overview

The example follows the ordering rules defined in the design document:

1. **README.md** (this file) - Always appears at the top of root directory
2. **File Type Testing** (`file-types-test/`) - Tests various supported file extensions
3. **Front Matter Testing** (`front-matter-test/`) - Tests YAML front matter titles and descriptions, including byte order marks, CRLF endings, and malformed blocks
4. **Ignore File Testing** (`ignore-files-test/`) - Tests hidden-file and ignore handling
5. **Include Glob Testing** (`include-globs-test/`) - Tests `workspaceWiki.includeGlobs`: `doc.go` and `api.guide.ts` are pulled in by the patterns in [`.vscode/settings.json`](.vscode/settings.json), while `other.go` stays out
6. **Index File Testing** (`index-files-test/`) - Tests index.md behavior and README handling
7. **Nested Directories** (`nested-structure-test/`) - Tests deep directory structures and hierarchical organization

## File Type Support

The extension supports these file types with the following default behavior:

- `.md`, `.markdown` - Primary documentation format (enabled by default)
- `.mdx` - Markdown with component syntax (enabled by default)
- `.prompt.md`, `.instructions.md` - Copilot prompt and instructions files; Markdown underneath, so enabled by default
- `.txt` - Plain text files (enabled by default)
- `.html`, `.htm` - HTML files (disabled by default, configurable)
- `.pdf` - PDF files (preview only, configurable)
- `.doc`, `.docx` - Word documents (future support)
- `.epub` - eBook format (future support)

## Ordering Rules Demonstrated

1. README files always appear at the top of their respective directories
2. Root-level files appear after README, sorted alphabetically
3. Directories appear after files, sorted alphabetically
4. Within directories: index.md files replace the directory name in display
5. Files within directories are sorted alphabetically, with README.md at the top

## Expected Tree Display

With the settings in [`.vscode/settings.json`](.vscode/settings.json), the tree reads:

```text
Workspace Wiki
├── README                             (from README.md)
├── File Types Test                    (file-types-test/)
│   ├── Index                          (from index.md)
│   ├── MDX Fixture                    (from test-mdx.mdx front matter)
│   ├── Test Htm                       (from test-htm.htm)
│   ├── Test HTML                      (from test-html.html)
│   ├── Test Instructions.Instructions (from test-instructions.instructions.md)
│   ├── Test Markdown                  (from test-markdown.markdown)
│   ├── Test Markdown `.md` File       (from test-md.md front matter)
│   ├── Test Pdf                       (from test-pdf.pdf)
│   ├── Test Prompt.Prompt             (from test-prompt.prompt.md)
│   └── Test Txt                       (from test-txt.txt)
├── Front Matter Test                  (front-matter-test/)
│   └── [one entry per front matter fixture, titled from its front matter]
├── Ignore Files Test                  (ignore-files-test/)
│   ├── Display                        (from display.md)
│   └── Index                          (from index.md)
├── Include Globs Test                 (include-globs-test/)
│   ├── API.Guide                      (from api.guide.ts, matched by *.guide.ts)
│   └── Doc                            (from doc.go, matched by doc.go)
├── Index Files Test                   (index-files-test/)
│   ├── README                         (from readme.md)
│   ├── Index                          (from index.md)
│   ├── Index                          (from index.txt)
│   └── Index                          (from index.html)
└── Nested Structure Test              (nested-structure-test/)
    ├── Index                          (from index.md)
    ├── Test File                      (from test-file.md)
    ├── Subdirectory 1                 (subdirectory-1/)
    │   ├── Index                      (from index.md)
    │   └── Level One                  (from level-one.md)
    ├── Subdirectory 2                 (subdirectory-2/)
    │   └── README                     (from rEaDmE.md)
    └── Subdirectory 3                 (subdirectory-3/)
        ├── Index                      (from index.md)
        ├── README                     (from README, no extension)
        └── Subsubdirectory 1          (subsubdirectory-1/)
            └── Index                  (from index.md)
```

Note what the fixtures prove: `other.go` sits beside `doc.go` and stays out of the tree, and the hidden `.hidden.md` in `ignore-files-test/` is absent while `showHiddenFiles` is false.

This structure validates that the Workspace Wiki extension correctly implements all the ordering and display rules specified in the design document.
