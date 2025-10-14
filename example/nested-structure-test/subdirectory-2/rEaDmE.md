# README for Subdirectory 2

This README file tests how the extension handles directories that contain README files instead of index files.

## Purpose

This directory validates:

- **README vs index behavior** - Directories without index.md should show their actual folder name
- **README positioning** - This file should appear at the top of the subdirectory's file list
- **Case sensitivity** - Testing mixed case "rEaDmE.md" to validate case handling
- **Folder naming** - Directory should display as "subdirectory-2" since there's no index.md

## Expected Tree Behavior

Since this directory has a README.md but no index.md:

1. **Directory name**: Should display as "subdirectory-2" (the actual folder name)
2. **README position**: This README should appear first in the expanded directory listing
3. **Case handling**: "rEaDmE.md" should be recognized as a README file despite mixed case
4. **Expansion behavior**: Directory should be expandable with this README at the top

## Testing Scenarios

- **No index file**: Directory retains original name without index.md present
- **README priority**: README files always appear first within directory listings
- **Case insensitivity**: Mixed case README files are handled correctly
- **Nested README**: README behavior is consistent at any directory level

This validates the extension's differentiation between index files (which replace folder names) and README files (which provide top-priority content within folders).
