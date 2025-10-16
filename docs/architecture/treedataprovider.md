# TreeDataProvider

The TreeDataProvider module powers the Workspace Wiki sidebar tree, converting file system entries into readable, ordered nodes.

## Responsibilities

- Implements VS Code's `TreeDataProvider` interface.
- Applies ordering rules:
    - `README.md` at root always first
    - Root-level docs next (alphabetical)
    - Folders (with `index.md` as folder node)
    - Files inside folders (alphabetical, with `README.md` at top)
- Normalizes file names to human-friendly titles.

## Example

```ts
class WikiTreeDataProvider implements vscode.TreeDataProvider<WikiNode> {
	// ...
}
```

## Example Tree

```text
Workspace Wiki
├── README
├── Changelog
├── Docs
│   ├── README
│   └── API
```

See also: [Scanner/Indexer](./scanner.md)

## TreeDataProvider Ordering Logic

```mermaid
flowchart TD
    A[All Files] --> B{Root?}
    B -- Yes --> C[README.md First]
    B -- No --> D[Folder Node]
    C --> E[Other Root Docs (A-Z)]
    D --> F{index.md?}
    F -- Yes --> G[Folder Named by index.md]
    F -- No --> H[Folder Name]
    G --> I[README.md in Folder]
    I --> J[Other Files (A-Z)]
    H --> J
```

This diagram shows how files are ordered and displayed in the tree.
