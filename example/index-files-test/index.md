# Index Files Testing Directory

This directory tests the Workspace Wiki extension's handling of index files and their interaction with folder display behavior.

## Purpose

This directory validates that the extension:

- Recognizes `index.md` files as folder landing pages
- Uses index file titles to replace folder names in the tree display
- Handles case variations in README files (README.md vs readme.md)
- Correctly processes different index file extensions (index.html, index.txt)
- Maintains proper ordering with index files present

## Expected Behavior

When this directory contains an `index.md` file, the tree should display the folder using the index file's title rather than the raw directory name "index-files-test".

Files within this directory should be ordered with README files at the top, followed by other files alphabetically, while the index file itself serves as the folder representation.

## Testing Scenarios

- **Index file as folder node**: This index.md should be used as the folder title
- **Case-insensitive README handling**: readme.md should be treated equivalently to README.md
- **Multiple index types**: Different extensions for index files should be handled appropriately
- **Ordering consistency**: Files should maintain alphabetical order regardless of index file presence
