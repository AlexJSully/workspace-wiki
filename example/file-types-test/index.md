# File Types Testing Directory

This directory contains various file types to test the Workspace Wiki extension's ability to handle different documentation formats and file extensions.

## Purpose

This directory validates that the extension:

- Correctly identifies and displays supported file types
- Handles both enabled and disabled file extensions according to settings
- Maintains proper ordering regardless of file type
- Shows appropriate icons and context for each file type

## Files Included

- **Markdown files** (`.md`, `.markdown`) - Primary documentation format
- **Text files** (`.txt`) - Plain text documentation
- **HTML files** (`.html`, `.htm`) - Web-based documentation
- **Binary formats** (`.pdf`, `.doc`, `.docx`, `.epub`) - Preview-only formats

### Scripting and Programming Files (should NOT appear by default)

The following files are included to validate that the Workspace Wiki extension does **not** display unsupported code/script formats:

- **JavaScript** (`test-js.js`): Basic hello world function
- **TypeScript** (`test-ts.ts`): Basic hello world export
- **Python** (`test-python.py`): Basic hello world function
- **Jupyter Notebook** (`test-jupyter.ipynb`): Python hello world cell
- **Go** (`test-go.go`): Basic hello world main
- **C#** (`test-cs.cs`): Basic hello world program
- **Visual Basic** (`test-vb.vb`): Basic hello world module
- **R** (`test-r.r`): Basic hello world function
- **R Markdown** (`test-rmd.Rmd`): R markdown hello world chunk
- **CSS** (`test-css.css`): Basic style (used by test-page.html)
- **SCSS** (`test-scss.scss`): Basic style
- **SQL** (`test-sql.sql`): Basic hello world query
- **PHP** (`test-php.php`): Basic hello world function

These files are present to ensure that only documentation formats (Markdown, text, HTML, PDF, etc.) are shown in the Workspace Wiki tree, and that code/script files are properly excluded.
