# Test Document Alternative

This is a test Markdown document with `.markdown` extension.

## Purpose

This file validates that the extension properly handles the alternative `.markdown` file extension, treating it equivalently to `.md` files.

## Key Testing Points

- File should be discovered and displayed in the tree
- Extension should treat `.markdown` and `.md` files identically
- Preview and editing functionality should work the same
- File ordering should be alphabetical regardless of extension

## Sample Content

This document demonstrates that both `.md` and `.markdown` extensions work seamlessly:

**Features to test:**

- Markdown rendering
- Syntax highlighting
- Link navigation
- Code block display

```javascript
// Sample code to test syntax highlighting
const greeting = 'Hello from .markdown file!';
console.log(greeting);
```

The extension's file scanner should include this file in the workspace documentation tree alongside other supported formats.
