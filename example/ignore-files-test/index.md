# Ignore Files Test

This directory is used to test the Workspace Wiki extension's handling of ignored and hidden files.

- `ignore-me.md`: Should be ignored (listed in .gitignore and/or excludeGlobs).
- `display.md`: Should be displayed in the Workspace Wiki tree.
- `.hidden.md`: Should only be displayed if `showHiddenFiles` is enabled.
- `.hidden/`: Hidden directory containing two markdown files, only visible if `showHiddenFiles` is enabled.
