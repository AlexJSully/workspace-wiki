# Nested Structure Testing Directory

This directory validates the Workspace Wiki extension's handling of complex, nested directory structures and hierarchical organization.

## Purpose

This directory tests:

- **Deep nesting capabilities** - How the extension handles multiple directory levels
- **Recursive file discovery** - Proper scanning of subdirectories
- **Hierarchical ordering** - Consistent ordering rules applied at each level
- **Performance with depth** - Reasonable behavior with nested structures
- **Index file inheritance** - How index files work in nested contexts

## Structure Overview

This directory contains multiple subdirectories with varying structures:

- **subdirectory-1/**: Simple nested structure with index.md
- **subdirectory-2/**: Directory with README.md (testing README vs index behavior)
- **subdirectory-3/**: Multi-level nesting with sub-subdirectories

## Expected Tree Behavior

Each level should maintain the extension's ordering rules:

1. README files at the top of each directory level
2. Regular files in alphabetical order
3. Subdirectories after files, sorted alphabetically
4. Index files replace directory names in tree display
5. Proper handling of case variations and file types at all levels

## Testing Scenarios

- **Maximum depth handling** - Extension should respect `maxSearchDepth` setting
- **Memory efficiency** - Reasonable performance with nested structures
- **User navigation** - Intuitive tree expansion and file access
- **Consistency** - Same ordering rules apply regardless of nesting level
