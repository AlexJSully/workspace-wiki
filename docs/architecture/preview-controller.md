# Preview/Open Controller

This module manages how files are opened from the Workspace Wiki tree.

## Implementation

The Preview/Open Controller is implemented in [`src/controllers/previewController.ts`](../../src/controllers/previewController.ts) with the following key functions:

- `handleFileClick()` - Handles file clicks with double-click detection
- `openInPreview()` - Opens files in preview mode
- `openInEditor()` - Opens files in editor mode

## Features

- Single-click: Opens file in preview mode.
- Double-click: Opens file in full editor mode.
- Context menu: Additional actions (e.g., open to the side).
- Uses VS Code commands like `vscode.openWith` and `window.showTextDocument`.

## Double-Click Detection

The controller includes sophisticated double-click detection with a 500ms threshold:

```typescript
// Track last click times for double-click detection
const lastClickTimes: Map<string, number> = new Map();
const DOUBLE_CLICK_THRESHOLD = 500; // milliseconds
```

## Example

```ts
vscode.commands.executeCommand('vscode.openWith', uri, 'vscode.markdown.preview');
```

## Customization

- Default open mode can be set in settings (`preview` or `editor`).
- File type handlers can be customized (e.g., open `.pdf` with a specific extension).

See also: [Settings Manager](./settings.md)

## File Open Flow

```mermaid
sequenceDiagram
	participant User as User
	participant Tree as Workspace Wiki Tree
	participant Controller as Preview/Open Controller
	participant Editor as VS Code Editor
	User->>Tree: Click file
	Tree->>Controller: Request open (preview/editor)
	Controller->>Editor: Open file (preview or editor)
```

This diagram shows how user actions in the tree trigger file opening in preview or editor mode.
