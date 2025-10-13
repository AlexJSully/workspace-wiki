# Test File in Nested Directory

This is a regular Markdown file within the nested structure testing directory.

## Purpose

This file serves as a control document to test:

- **Standard file handling** within nested directory contexts
- **Alphabetical ordering** alongside subdirectories
- **File vs directory sorting** - This file should appear before subdirectories
- **Title normalization** in nested contexts ("test-file.md" → "Test File")

## Position in Tree

According to the extension's ordering rules, this file should appear:

1. After any README files in this directory (there are none)
2. Before the subdirectories (subdirectory-1, subdirectory-2, subdirectory-3)
3. In alphabetical order with any other root-level files in this directory

## Content

This document contains standard Markdown content to ensure the extension handles regular documentation files properly within nested directory structures:

- **Lists and formatting** should work correctly
- **Links and references** should be functional
- **Code blocks** should render properly

```typescript
// Example code block in nested file
interface NestedTest {
	level: number;
	content: string;
}
```

This validates that the extension maintains full Markdown functionality regardless of directory nesting depth.
