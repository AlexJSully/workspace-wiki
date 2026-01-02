# Architecture Overview

This section explains the overall architecture of the Workspace Wiki extension, including its main modules, data flow, and integration points with VS Code.

## Main Components

- **[Scanner](../../src/scanner/workspaceScanner.ts)**: Discovers documentation files using `workspace.findFiles`, respects `.gitignore` and exclude patterns, filters hidden files, and returns URIs.
- **[Tree Provider](../../src/tree/treeProvider.ts)**: Implements VS Code's `TreeDataProvider` interface, builds hierarchical tree structure, applies ordering rules, manages node mapping for sync.
- **[Tree Builder](../../src/tree/buildTree.ts)**: Constructs hierarchical tree from flat file list, calculates common base path, sorts nodes, handles folder/file relationships.
- **[Preview Controller](../../src/controllers/previewController.ts)**: Handles file opening with double-click detection (500ms threshold), manages preview vs editor modes, respects `openWith` configuration.
- **[Configuration Utilities](../../src/utils/configUtils.ts)**: Provides typed access to extension settings with default values.
- **[Text Utilities](../../src/utils/textUtils.ts)**: Normalizes file names to human-readable titles, preserves acronym casing, handles special cases (README).
- **[File Utilities](../../src/utils/fileUtils.ts)**: Path manipulation, hidden file detection, glob pattern matching.
- **[Sync Module](../../src/extension.ts)**: Integrated into main extension activation, reveals active file in tree with configurable delay, respects visibility state.

## Source Code Structure

```text
src/
├── extension.ts              # Extension activation, command registration, sync logic
├── controllers/
│   ├── index.ts
│   └── previewController.ts  # File opening, double-click detection
├── scanner/
│   ├── index.ts
│   └── workspaceScanner.ts   # File discovery, filtering
├── tree/
│   ├── index.ts
│   ├── buildTree.ts          # Tree construction, sorting
│   └── treeProvider.ts       # VS Code TreeDataProvider implementation
├── types/
│   ├── index.ts
│   ├── treeNode.ts           # TreeNode interface
│   └── workspaceLike.ts      # Workspace abstraction for testing
└── utils/
    ├── index.ts
    ├── configUtils.ts        # Configuration access
    ├── fileUtils.ts          # Path utilities
    └── textUtils.ts          # Title normalization
```

## Subpages

- [Scanner](./scanner.md) - File discovery and filtering logic
- [Tree Data Provider](./tree-data-provider.md) - Tree view implementation
- [Preview Controller](./preview-controller.md) - File opening behavior
- [Settings](./settings.md) - Configuration options
- [Sync Module](./sync.md) - Active file revelation
- [Utilities](./utilities.md) - Helper functions

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Extension["Extension (src/extension.ts)"]
        A[activate]
        B[Command Registration]
        C[Sync Logic]
    end

    subgraph Scanner["Scanner (src/scanner/)"]
        D[scanWorkspaceDocs]
        E[Filter by Extensions]
        F[Apply .gitignore]
        G[Filter Hidden Files]
    end

    subgraph Tree["Tree (src/tree/)"]
        H[WorkspaceWikiTreeProvider]
        I[buildTree]
        J[sortNodes]
        K[Node Mapping]
    end

    subgraph Controllers["Controllers (src/controllers/)"]
        L[handleFileClick]
        M[openInPreview]
        N[openInEditor]
    end

    subgraph Utils["Utilities (src/utils/)"]
        O[normalizeTitle]
        P[configUtils]
        Q[fileUtils]
    end

    subgraph VSCode["VS Code API"]
        R[TreeView]
        S[Commands]
        T[Workspace]
        U[Window]
    end

    A --> B
    A --> C
    A --> H
    B --> S
    C --> R

    H --> D
    D --> E
    E --> F
    F --> G
    G --> I
    I --> J
    I --> O

    H --> K
    K --> C

    R --> H
    H --> L
    L --> M
    L --> N
    M --> S
    N --> S

    D --> T
    H --> P
    I --> O
    D --> Q
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant VSCode as VS Code
    participant Extension
    participant Scanner
    participant TreeProvider
    participant TreeView
    participant Controller

    User->>VSCode: Opens workspace
    VSCode->>Extension: activate()
    Extension->>TreeProvider: new WorkspaceWikiTreeProvider()
    Extension->>VSCode: createTreeView('workspaceWiki')
    VSCode->>TreeView: Create tree view

    TreeView->>TreeProvider: getChildren()
    TreeProvider->>Scanner: scanWorkspaceDocs()
    Scanner->>VSCode: workspace.findFiles()
    VSCode-->>Scanner: File URIs
    Scanner-->>TreeProvider: Filtered URIs
    TreeProvider->>TreeProvider: buildTree(uris)
    TreeProvider-->>TreeView: TreeItems
    TreeView-->>User: Display tree

    User->>TreeView: Click file
    TreeView->>Controller: handleFileClick(uri)
    Controller->>Controller: Detect single/double click
    Controller->>VSCode: executeCommand(openWith)
    VSCode-->>User: Show file in editor

    User->>VSCode: Change active editor
    VSCode->>Extension: onDidChangeActiveTextEditor
    Extension->>TreeProvider: findNodeByPath()
    TreeProvider-->>Extension: TreeNode
    Extension->>TreeView: reveal(node)
    TreeView-->>User: Highlight file in tree
```
