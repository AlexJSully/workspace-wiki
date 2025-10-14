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
3. **Index File Testing** (`index-files-test/`) - Tests index.md behavior and README handling
4. **Nested Directories** (`nested-structure-test/`) - Tests deep directory structures and hierarchical organization

## File Type Support

The extension supports these file types with the following default behavior:

- `.md`, `.markdown` - Primary documentation format (enabled by default)
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

```text
Workspace Wiki
├── README                    (this file)
├── File Types Test          (from file-types-test/index.md)
│   ├── Test Document        (from test-document.md)
│   ├── Test Document Alt    (from test-document.markdown)
│   ├── Test Notes          (from test-notes.txt)
│   ├── Test Page           (from test-page.html)
│   ├── Test Page Alt       (from test-page.htm)
│   └── [Other file types as configured]
├── Index Files Test        (from index-files-test/index.md)
│   ├── readme              (from readme.md)
│   ├── Index HTML          (from index.html)
│   └── Index Text          (from index.txt)
└── Nested Structure Test   (from nested-structure-test/index.md)
    ├── Test File           (from test-file.md)
    ├── Level One           (subdirectory-1/)
    │   ├── Level One Doc   (from level-one.md)
    ├── Level Two           (subdirectory-2/)
    │   └── README          (from rEaDmE.md)
    └── Level Three         (subdirectory-3/)
        ├── Deep Nested     (from subsubdirectory-1/index.md)
```

This structure validates that the Workspace Wiki extension correctly implements all the ordering and display rules specified in the design document.
