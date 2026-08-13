---
title: 'Front Matter Test'
description: 'Fixtures covering how YAML front matter affects the tree'
---

# Front Matter Test

Each file here demonstrates one front matter behaviour. Open this folder in the Extension
Development Host and compare the tree against the table: the label is what Workspace Wiki displays,
and the tooltip is what appears on hover.

| File                       | What it contains                             | Label in the tree | Tooltip         |
| -------------------------- | -------------------------------------------- | ----------------- | --------------- |
| `title-and-description.md` | `title` and `description`                    | A Custom Title    | the description |
| `title-only.md`            | `title` only                                 | Just A Title      | the path        |
| `description-only.md`      | `description` only                           | Description Only  | the description |
| `no-front-matter.md`       | no front matter block                        | No Front Matter   | the path        |
| `crlf-line-endings.md`     | CRLF line endings                            | CRLF Line Endings | the description |
| `byte-order-mark.md`       | a leading UTF-8 byte order mark              | Byte Order Mark   | the description |
| `delimiter-in-body.md`     | a valid block, plus a `---` rule in the body | Delimiter In Body | the path        |
| `tab-indented.md`          | indentation using tab characters             | Tab Indented      | the path        |

Two of these are worth explaining.

`tab-indented.md` is the one case where front matter is present but does not apply. YAML forbids tab
characters in indentation, so the block fails to parse and the file falls back to the title derived
from its name. The label happens to read the same either way, which is why the file also logs a
parse failure to the extension host console.

`delimiter-in-body.md` guards the opposite mistake. Only the block at the very top of the file is
front matter, so the `---` rule further down stays part of the rendered document.
