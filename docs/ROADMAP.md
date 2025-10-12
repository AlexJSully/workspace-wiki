# Workspace Wiki Extension Roadmap

This roadmap breaks down the implementation plan from the design doc into granular milestones, features, and actionable tasks. Each phase is a milestone, each feature is a sub-milestone, and each feature is further decomposed into small, trackable steps.

---

## Milestone 0 — Scaffolding

### 0.1. Create Project Structure

- [ ] Create `.github` folder
- [ ] Add Copilot instructions file
- [ ] Add initial README
- [ ] Add initial ROADMAP.md
- [ ] Add initial CHANGELOG.md
- [ ] Add `docs/` folder
- [ ] Add `src/` folder
- [ ] Add `test/` folder

### 0.2. Setup Tooling

- [ ] Setup ESLint with TypeScript plugin
- [ ] Setup Prettier
- [ ] Setup Jest for unit tests
- [ ] Setup Husky and lint-staged for pre-commit/push
- [ ] Add VS Code launch and tasks config
- [ ] Add esbuild bundler config

---

## Milestone 1 — Core MVP

### 1.1. Scanner Module

- [ ] Implement workspace scanning for `.md`, `.markdown`, `.txt` files
- [ ] Respect `excludeGlobs` and `.gitignore`
- [ ] Implement file system watcher for live updates
- [ ] Cache metadata (title, path, mtime)

### 1.2. TreeDataProvider

- [ ] Implement tree view in Explorer
- [ ] Convert file system entries to tree nodes
- [ ] Apply ordering rules (README, root files, alphabetical dirs)
- [ ] Implement folder-as-index behavior
- [ ] Support multi-root workspaces

### 1.3. Title Normalization

- [ ] Normalize file names to human-friendly titles
- [ ] Parse frontmatter for custom titles

### 1.4. Preview/Open Controller

- [ ] Open files in preview mode on single click
- [ ] Open files in editor mode on double click
- [ ] Implement context menu actions

### 1.5. Settings Manager

- [ ] Read config from `workspaceWiki` namespace
- [ ] Expose typed settings to modules
- [ ] Implement settings for supported extensions, excludes, open mode

### 1.6. Unit Tests

- [ ] Write unit tests for normalization logic
- [ ] Write unit tests for ordering logic
- [ ] Write integration tests for tree view

---

## Milestone 2 — UX Polish & Features

### 2.1. Index Handling

- [ ] Implement index.md handling for folder nodes
- [ ] Add setting to show/hide index child file

### 2.2. Sync Module

- [ ] Reveal active file in tree on editor change
- [ ] Implement auto-reveal delay setting

### 2.3. Context Menu & Open With

- [ ] Add context menu actions for preview/editor
- [ ] Integrate with Markdown preview extension
- [ ] Add plumbing for `Open With...`

---

## Milestone 3 — Formatters & Integration

### 3.1. Markdown Preview Integration

- [ ] Integrate with VS Code Markdown preview
- [ ] Provide consistent styling via webview (optional)

### 3.2. PDF & HTML Support

- [ ] Detect PDF files and enable preview
- [ ] Add settings for enabling HTML preview
- [ ] Implement extension-to-handler mapping

### 3.3. Settings Expansion

- [ ] Add settings for enableHtml, includePdf, maxSearchDepth

---

## Milestone 4 — Polishing, i18n, and Release

### 4.1. UI Polish

- [ ] Polish labels and icons (codicons)
- [ ] Add accessibility roles and keyboard navigation

### 4.2. Documentation

- [ ] Write user documentation
- [ ] Add extension marketplace metadata

### 4.3. Release Pipeline

- [ ] Run full CI (build, lint, test)
- [ ] Package VSIX
- [ ] Publish to Marketplace

---

## Milestone 5 — Stretch Goals

### 5.1. Search & Tagging

- [ ] Implement content search across docs
- [ ] Add tagging support for docs
- [ ] Extract headings outline

### 5.2. Unified Reading Experience

- [ ] Optional webview with TOC, search, unified theme

### 5.3. Summarization Assistant

- [ ] Add privacy-optional summarization for long docs

---

## Edge Cases & Quality

- [ ] Handle very large repos (maxSearchDepth, lazy loading)
- [ ] Treat README.md/readme.md as equivalent
- [ ] Avoid opening binary files as text
- [ ] Do not follow symlinks by default
- [ ] Respect all excludes

---

_This roadmap should be updated as features are completed or new requirements emerge._
