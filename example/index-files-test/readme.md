# readme

This is a test README file with lowercase naming to validate case-insensitive handling.

## Purpose

This file tests that the Workspace Wiki extension:

- Treats `readme.md` and `README.md` equivalently
- Maintains README priority positioning regardless of case
- Shows appropriate case handling in different filesystems
- Processes README files consistently within directories containing index files

## Key Testing Points

- **Case insensitivity**: Should be recognized as a README file despite lowercase naming
- **Priority positioning**: Should appear at the top of the file list within this directory
- **Title normalization**: Should display as "readme" or "README" consistently
- **Index interaction**: Should coexist properly with the index.md file in this directory

## Expected Behavior

This readme.md file should:

1. Appear at the top of this directory's file listing (after the index file serves as folder node)
2. Be treated the same as if it were named README.md
3. Display with appropriate README file context and behavior
4. Maintain proper alphabetical ordering with other files in the directory

This validates the extension's robust handling of README files regardless of case conventions used in different projects.
