# Level Three Directory

This directory tests multi-level nesting and demonstrates the extension's handling of deep directory structures.

## Purpose

This directory validates:

- **Deep nesting capabilities** - Multiple levels of subdirectories
- **Performance with depth** - Reasonable scanning and display performance
- **Recursive index files** - Index files at multiple nesting levels
- **Navigation complexity** - User experience with deep trees

## Structure

This directory contains:

- This index.md (replaces "subdirectory-3" in tree display)
- A sub-subdirectory with its own index file for further nesting testing

## Expected Behavior

- **Directory display**: Should show as "Level Three Directory" instead of "subdirectory-3"
- **Nested expansion**: Should contain expandable sub-subdirectories
- **Performance**: Should handle multiple nesting levels efficiently
- **Consistency**: All ordering rules should apply at every level

## Testing Scenarios

- **Maximum depth**: Validates extension behavior at configured `maxSearchDepth`
- **Memory usage**: Ensures reasonable resource consumption with nested structures
- **User experience**: Intuitive navigation through multiple tree levels
- **Index inheritance**: Proper handling of index files at various depths
