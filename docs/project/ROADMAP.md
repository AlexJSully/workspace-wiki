# Workspace Wiki Extension Roadmap

This roadmap breaks down the implementation plan from the design doc into granular milestones, features, and actionable tasks. Each phase is a milestone, each feature is a sub-milestone, and each feature is further decomposed into small, trackable steps.

---

## Milestone 0 — Scaffolding

### 0.1. Create Project Structure

- [x] Initialize project

---

## Milestone 1 — Core MVP

### 1.1. Scanner Module

- [x] Implement workspace scanning for `.md`, `.markdown`, `.txt` files
- [x] Respect `excludeGlobs` and `.gitignore`

### 1.2. TreeDataProvider

- [x] Implement tree view in Explorer
- [x] Convert file system entries to tree nodes
- [x] Apply ordering rules (README, root files, alphabetical dirs)

### 1.3. Title Normalization

- [x] Normalize file names to human-friendly titles

### 1.4. Preview/Open Controller

- [x] Open files in preview mode on single click
- [x] Open files in editor mode on double click
- [x] Implement context menu actions

### 1.5. Settings Manager

- [x] Implement settings for supported extensions, excludes, open mode

---

## Milestone 2 — UX Polish & Features

### 2.1. Sync Module

- [x] Reveal active file in tree on editor change
- [x] Implement auto-reveal delay setting

---

## Milestone 3 — Formatters & Integration

### 3.1. Markdown Preview Integration

- [x] Integrate with VS Code Markdown preview

---

## Milestone 4 — Polishing, i18n, and Release

### 4.1. UI Polish

- [ ] Polish labels and icons (codicons)
- [ ] Add accessibility roles and keyboard navigation

### 4.2. Documentation

- [x] Write user documentation
- [x] Add extension marketplace metadata

### 4.3. Release Pipeline

- [x] Run full CI (build, lint, test)
- [x] Package VSIX
- [x] Publish to Marketplace

---

## Edge Cases & Quality

- [ ] Handle very large repos (maxSearchDepth, lazy loading)
- [x] Treat README.md/readme.md as equivalent
- [ ] Avoid opening binary files as text
- [ ] Do not follow symlinks by default
- [x] Respect all excludes
