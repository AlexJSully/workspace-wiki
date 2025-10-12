# Copilot Instructions for Workspace Wiki Extension

This guide enables AI coding agents to be immediately productive in the Workspace Wiki VS Code extension codebase. It summarizes architecture, workflows, conventions, and integration points unique to this project.

## Agent Mode Workflow Requirements

**Todo Checklist Enforcement:**

- Whenever you receive a prompt in Agent mode, always break down the prompt into a granular Todo checklist before starting work. Each checklist item should be actionable and specific, making progress easy to follow.
- After completing each Todo item, run `npm run validate` to ensure all validations pass before marking the item as complete or moving to the next item. Do not proceed to the next Todo or consider the work complete unless all validations pass.
- Display the current checklist and status to the user at every step.

**Example Workflow:**

1. Receive prompt.
2. Break down into Todo checklist items.
3. Mark one item as in-progress, complete the work.
4. Run `npm run validate`.
5. If validation passes, mark item as complete and move to next. If not, fix issues before proceeding.
6. Repeat until all items are complete and validated.

**Note:** This workflow applies to all Agent mode prompts and should be followed strictly for every coding session.

## Big Picture Architecture

- **Purpose:** Presents workspace documentation files in a sidebar tree view for fast preview and editing.
- **Main Components:**
    - **Scanner/Indexer:** Uses `workspace.findFiles` and file system watchers to discover docs. Caches metadata for performance.
    - **TreeDataProvider:** Implements VS Code's tree view, applies ordering rules (README/index, alphabetical, folder-as-index).
    - **Preview/Open Controller:** Handles user interactions, opens files in preview/editor modes.
    - **Settings Manager:** Reads extension config from `workspaceWiki` namespace.
    - **Sync Module:** Reveals active file in the tree.
    - **Utilities:** Title normalization, frontmatter parsing, mime-type detection.

## Developer Workflows

**Testing Requirements:** - Whenever any changes are made within the codebase, both unit tests and end-to-end (e2e) tests must be created or updated. - For example, changes to `src/extension.ts` require: - Unit tests in `src/extension.test.ts` - E2E tests in `src/extension.e2e.test.ts` - Test files should be located in the same directory as the file being tested (e.g., `src/extension.test.ts` for `src/extension.ts`). - The `src/test` directory is reserved for testing utilities and setup scripts (e.g., `setupTests.ts`). - Unit tests should cover all exported functions and logic. - E2E tests should validate extension behavior in a running VS Code environment. - Use `npm run test:jest` for Jest unit tests. - Use `npm run test:extension` for integration/e2e tests (via `vscode-test`). - Use `npm run watch-tests` for live test compilation. - Test files must match `**.test.ts` (unit) and `**.e2e.test.ts` (e2e) and reside in `src/test/`.

- **Lint:**
    - Use `npm run lint` (TypeScript ESLint config in `eslint.config.mjs`).
- **Debug:**
    - Launch with VS Code's "Run Extension" config (`.vscode/launch.json`).
    - Set breakpoints in `src/extension.ts`.

## Project-Specific Conventions

- **Ordering:** README at root is always top; index.md in folders replaces folder name; alphabetical sorting elsewhere.
- **Supported File Types:** `.md`, `.markdown`, `.txt` by default; `.pdf`, `.html` opt-in via settings.
- **Settings:** All config under `workspaceWiki` namespace (see design doc for full schema).
- **Excludes:** Respects `excludeGlobs` and `.gitignore` for scanning.
- **Strict TypeScript:** Enforced via `tsconfig.json`.
- **ESLint:** Custom rules for naming conventions and code style.

## Integration Points

- **VS Code API:** TreeDataProvider, commands, workspace, window, configuration.
- **External Libraries:**
    - `gray-matter` for frontmatter parsing (optional).
    - `esbuild` for bundling.
    - `@vscode/test-electron` for integration tests.
- **Extension Settings:**
    - Add new settings via `contributes.configuration` in `package.json`.

## Key Files & Directories

- `src/extension.ts`: Main extension logic.
- `esbuild.js`: Build pipeline.
- `eslint.config.mjs`: Linting rules.
- `src/test/extension.test.ts`: Example test.
- `.vscode/launch.json`, `.vscode/tasks.json`: Debug and build tasks.
- `docs/design-doc.md`: Architecture and implementation details.

## Examples

- **Tree Ordering:** See design doc for expected tree structure and ordering rules.
- **Settings Schema:** See design doc section 7 for example config.

## Edge Cases

- Large repos: Use `maxSearchDepth` setting.
- Case-insensitive filesystems: Treat `README.md` and `readme.md` as equivalent.
- Binary files: Avoid opening as text.
- Symlinks: Do not follow by default.

---

For unclear or incomplete sections, please provide feedback to improve these instructions.
