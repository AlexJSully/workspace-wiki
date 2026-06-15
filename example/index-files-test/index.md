# Index Files Testing Directory

This directory tests the Workspace Wiki extension's handling of index files and their interaction with folder display behavior.

## Purpose

This directory validates that the extension:

- Recognizes `index.md` files within a folder
- Lists `index.md` as a child file while the folder keeps its own name
- Handles case variations in README files (README.md vs readme.md)
- Correctly processes different index file extensions (index.html, index.txt)
- Maintains proper ordering with index files present

## Expected Behavior

When this directory contains an `index.md` file, the tree displays the folder using its own normalized name ("Index Files Test"); the `index.md` appears as a child file, flagged internally as an index file.

Files within this directory are ordered with README files at the top, followed by other files alphabetically, including the `index.md` itself.

## Testing Scenarios

- **Index file as a child**: This index.md is listed as a child of the folder, not as the folder's title
- **Case-insensitive README handling**: readme.md should be treated equivalently to README.md
- **Multiple index types**: Different extensions for index files should be handled appropriately
- **Ordering consistency**: Files should maintain alphabetical order regardless of index file presence
