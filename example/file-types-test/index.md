# File Types Testing Directory

This directory contains one small file per format, so the Workspace Wiki extension can be checked against a wide spread of file types in a single folder.

## Purpose

This directory validates that the extension:

- Correctly identifies and displays supported file types
- Handles both enabled and disabled file extensions according to settings
- Maintains proper ordering regardless of file type
- Shows appropriate icons and context for each file type

Every file is a minimal, genuine example of its format — a "hello world" equivalent — not a placeholder. Sizes stay tiny even for formats that are enormous in practice: the alignment fixtures hold a single read.

## Shown in the tree

These match `workspaceWiki.supportedExtensions`, which this workspace sets in [`.vscode/settings.json`](../.vscode/settings.json) to `md`, `markdown`, `mdx`, `txt`, `html`, `htm`, and `pdf`.

- **Markdown** (`test-md.md`, `test-markdown.markdown`) — the primary documentation format; `test-md.md` also carries YAML front matter
- **MDX** (`test-mdx.mdx`) — Markdown with component syntax, front matter included
- **Copilot prompt file** (`test-prompt.prompt.md`) and **instructions file** (`test-instructions.instructions.md`) — Markdown underneath, so both appear in the tree
- **Plain text** (`test-txt.txt`)
- **HTML** (`test-html.html`, `test-htm.htm`)
- **PDF** (`test-pdf.pdf`) — preview only

## Not shown by default

Everything below is present to prove the tree leaves it alone. Any of it can be pulled in through `supportedExtensions`, or file by file through `workspaceWiki.includeGlobs` — see [`include-globs-test/`](../include-globs-test/).

### Documentation and markup

- **AsciiDoc** (`test-asciidoc.adoc`) — used for technical documentation by Apache, Eclipse, and Spring
- **LaTeX** (`test-latex.tex`) — the academic and scientific typesetting standard
- **Quarto** (`test-quarto.qmd`) — the successor to R Markdown for computational documents
- **R Markdown** (`test-rmd.Rmd`), **reStructuredText** (`test-rst.rst`)
- **Jupyter Notebook** (`test-jupyter.ipynb`)
- **Word** (`test-doc.doc`, `test-docx.docx`), **EPUB** (`test-epub.epub`), **Excel** (`test-xlsx.xlsx`)
- **Citation File Format** (`test-cff.cff`)

### Diagrams and drawing

- **Mermaid** (`test-mermaid.mmd`), **PlantUML** (`test-plantuml.puml`), **draw.io** (`test-drawio.drawio`)
- **SVG** (`test-svg.svg`)

### Note-taking and cloud documents

- **Obsidian Canvas** (`test-canvas.canvas`) — the JSON Canvas spec — and **Obsidian Bases** (`test-base.base`)
- **Excalidraw** (`test-excalidraw.excalidraw`)
- **Google Drive pointers** (`test-gdoc.gdoc`, `test-gsheet.gsheet`) — small JSON stubs that reference a document rather than containing one

Notion is absent deliberately: it has no proprietary file extension and exports to Markdown, CSV, and HTML, all of which are already covered here.

### Programming languages

- **JavaScript** (`test-js.js`), **ES modules** (`test-mjs.mjs`), **CommonJS** (`test-cjs.cjs`), **JSX** (`test-jsx.jsx`)
- **TypeScript** (`test-ts.ts`, `test-tsx.tsx`)
- **Python** (`test-python.py`, `test-python-cgi.cgi`), **Perl** (`test-perl.pl`), **PHP** (`test-php.php`), **Lua** (`test-lua.lua`)
- **Java** (`test-java.java`), **Kotlin** (`test-kotlin.kt`), **Swift** (`test-swift.swift`), **C#** (`test-cs.cs`), **Visual Basic** (`test-vb.vb`), **Go** (`test-go.go`)
- **R** (`test-r.r`), **SQL** (`test-sql.sql`), **Shell** (`test-shell.sh`)
- **CSS** (`test-css.css`, used by the HTML fixtures), **SCSS** (`test-scss.scss`)

### Game development

- **Unity scene** (`test-scene.unity`) and **prefab** (`test-prefab.prefab`) — Unity serialises both as YAML
- **Godot GDScript** (`test-gdscript.gd`)
- **Shader** (`test-shader.shader`)

### Data, config, and schemas

- **JSON** (`test-json.json`), **JSON with comments** (`test-jsonc.jsonc`), **XML** (`test-xml.xml`), **DTD** (`test-dtd.dtd`)
- **YAML** (`test-yaml.yaml`, `test-yml.yml`), **CSV** (`test-csv.csv`)
- **Java properties** (`test-properties.properties`), **generic config** (`test-conf.conf`)
- **Protocol Buffers** (`test-proto.proto`), **ANTLR grammar** (`test-antlr.g4`), **Mustache template** (`test-mustache.mustache`)
- **Terraform** (`test-tf.tf`), **Makefile** (`Makefile`)

### Health informatics

- **FHIR Shorthand** (`test-fsh.fsh`), **FHIRPath** (`test-fhirpath.fhirpath`)

### Science

- **FASTA** (`test-fasta.fasta`) and **FASTQ** (`test-fastq.fastq`) — sequences, with per-base quality in the FASTQ
- **SAM** (`test-sam.sam`) and **BAM** (`test-bam.bam`) — the same alignment in text and in BGZF-compressed binary form; the BAM is a real BGZF file, not a stub
- **VCF** (`test-vcf.vcf`) — variant calls; **GFF3** (`test-gff.gff`) and **BED** (`test-bed.bed`) — genome annotation
- **PDB** (`test-pdb.pdb`) — the Protein Data Bank structure format, not Windows debug symbols, which share the extension — and **mmCIF** (`test-cif.cif`)
- **GenBank** (`test-genbank.gb`) — annotated sequence; **Newick** (`test-newick.nwk`) — phylogenetic tree
- **SBML** (`test-sbml.sbml`) — systems biology model
