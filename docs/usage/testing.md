# Testing Guide

This guide explains how to run and write tests for the Workspace Wiki extension.

## Test Types

- **Unit Tests**: Test individual functions and modules (Jest).
- **E2E/Integration Tests**: Validate extension behavior in a running VS Code instance (`@vscode/test-electron`).

## Running Tests

- **Unit tests:**

    ```sh
    npm run test:jest
    ```

- **E2E tests:**

    ```sh
    npm run test:extension
    ```

- **Watch mode:**

    ```sh
    npm run watch-tests
    ```

## Test Locations

- Unit tests: `src/*.test.ts`
- E2E tests: `src/*.e2e.test.ts`
- Test utilities: `src/test/`

## Example Directory for Testing

The `example/` directory contains a variety of files and folders used to test and demonstrate the Workspace Wiki extension's features. Use these files to verify:

- File type support and filtering (see `file-types-test/`)
- Handling of ignored and hidden files (see `ignore-files-test/`)
- Tree structure, index/README handling, and nested folders

You can toggle extension settings (such as `showHiddenFiles`) and observe how the Workspace Wiki tree updates to reflect these changes using the files in `example/`.

## Example Unit Test

```ts
import { normalizeTitle } from './utils/title';

test('normalizeTitle converts file names to titles', () => {
	expect(normalizeTitle('userGuide.md')).toBe('User Guide');
});
```

## Example E2E Test

```ts
import * as vscode from 'vscode';

test('Workspace Wiki tree appears', async () => {
  const tree = vscode.window.createTreeView('workspaceWiki', { treeDataProvider: ... });
  expect(tree).toBeDefined();
});
```

## Test Workflow Diagram

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as Command Line
    participant Jest as Jest Runner
    participant VSCode as VS Code Test Runner
    Dev->>CLI: Run npm run test:jest
    CLI->>Jest: Start unit tests
    Jest-->>CLI: Test results
    Dev->>CLI: Run npm run test:extension
    CLI->>VSCode: Launch VS Code test instance
    VSCode-->>CLI: E2E test results
```

This diagram shows the flow for running both unit and E2E tests.
