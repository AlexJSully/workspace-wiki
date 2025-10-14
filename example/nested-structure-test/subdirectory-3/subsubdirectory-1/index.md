# Deep Nested Directory

This is the deepest level in the test structure, validating the extension's handling of deeply nested documentation.

## Purpose

This sub-subdirectory tests:

- **Deep nesting limits** - How the extension handles maximum configured depth
- **Performance at depth** - Resource usage and scanning time with deep structures
- **Index files at depth** - Proper index file handling at multiple nesting levels
- **Tree navigation** - User experience navigating through deep hierarchies

## Expected Position

This directory should appear within the "Level Three Directory" tree node, demonstrating:

- **Proper nesting display** - Clear hierarchical representation
- **Index replacement** - Shows as "Deep Nested Directory" instead of "subsubdirectory-1"
- **Navigation flow** - Intuitive expansion and collapse behavior
- **Consistent ordering** - Same ordering rules apply at all depths

## Testing Validation

- **Depth handling**: Extension respects `maxSearchDepth` configuration
- **Memory efficiency**: Reasonable performance with nested scanning
- **User experience**: Tree remains navigable and responsive
- **Feature consistency**: All extension features work at any nesting level

This represents the deepest level of the test structure, validating that the Workspace Wiki extension maintains full functionality regardless of directory depth.
