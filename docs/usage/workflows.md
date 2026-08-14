# CI/CD Workflows

The project uses GitHub Actions for continuous integration and code quality assurance. The workflows are [`code-qa-js.yaml`](../../.github/workflows/code-qa-js.yaml) and [`code-qa-markdown.yaml`](../../.github/workflows/code-qa-markdown.yaml).

## Available Workflows

### JavaScript/TypeScript Quality Assurance

**File:** [`.github/workflows/code-qa-js.yaml`](../../.github/workflows/code-qa-js.yaml)

**Purpose:** Ensures code quality for all JavaScript and TypeScript files in the project.

**Triggers:**

- Push to `main` branch
- Pull requests to `main` branch
- Changes to JS/TS files, configs, or the workflow itself

**File Patterns Monitored:**

- `**/*.css` - Stylesheets
- `**/*.js`, `**/*.jsx` - JavaScript files
- `**/*.mjs` - ECMAScript module files
- `**/*.ts`, `**/*.tsx` - TypeScript files
- `**/*.json` - Configuration files
- [`esbuild.js`](../../esbuild.js) - Build configuration
- [`jest.config.js`](../../jest.config.js) - Test configuration
- `package*.json` - Dependencies
- `src/**` - Source code directory
- `tsconfig*.json` - TypeScript configuration

**Quality Checks:**

- **Build Extension:** Runs `npm run compile`
- **Code Formatting Check:** Runs `npm run prettier:check`
- **TypeScript Type Check:** Runs `npm run check-types`
- **ESLint Check:** Runs `npm run lint`
- **Unit Tests:** Runs `npm run test:jest`
- **Desktop Extension Tests:** Runs `xvfb-run -a npm run test:extension`
- **Web Extension Tests:** Runs `npm run test:web`

**Node.js Version:** 24.x

### Markdown Quality Assurance

**File:** [`.github/workflows/code-qa-markdown.yaml`](../../.github/workflows/code-qa-markdown.yaml)

**Purpose:** Maintains consistent markdown formatting and quality across documentation.

**Triggers:**

- Push to `main` branch
- Pull requests to `main` branch
- Changes to markdown files or linting configuration

**File Patterns Monitored:**

- `**/*.md` - All `.md` files
- [`.markdownlint.json`](../../.markdownlint.json) - Rule configuration
- [`.markdownlint-cli2.jsonc`](../../.markdownlint-cli2.jsonc) - CLI configuration: lint globs and explicitly excluded files
- [`.gitignore`](../../.gitignore) - Ignored paths are also excluded from linting (the config's `gitignore` option)
- `package*.json` - Dependencies for markdown tools

**Quality Checks:**

- **Markdownlint:** Runs `npm run lint:markdown` using `markdownlint-cli2`

**Node.js Version:** 24.x

## Workflow Integration

Both workflows work together to ensure:

1. **Code Quality:** All TypeScript code meets style guidelines and passes tests
2. **Documentation Quality:** All markdown documentation is properly formatted
3. **Build Integrity:** The extension can be successfully built and tested
4. **Continuous Validation:** Every change is automatically verified

## Running Workflows Locally

To run the same checks locally before pushing:

```bash
# Install dependencies
npm ci

# Run all validation checks (same as CI)
npm run validate

# Individual checks
npm run lint              # ESLint validation
npm run lint:markdown     # Markdown linting
npm run test:jest         # Jest unit tests
npm run test:extension    # E2E tests
npm run compile           # TypeScript compilation
npm run package           # Production extension bundle
```

## Workflow Configuration

### Permissions

Both workflows use minimal permissions:

- `contents: read` - Read repository contents only

### Strategy

- **Operating System:** Ubuntu Latest (Linux)
- **Node.js Version:** 24.x (configured through a matrix with one entry)
- **Dependency Caching:** Automatic npm cache management

### Performance Optimizations

- **Path-based Triggers:** Workflows only run when relevant files change
- **Dependency Caching:** npm dependencies are cached between runs
- **Parallel Execution:** The two workflows run concurrently when a change triggers both

## Best Practices

1. **Always validate locally** before pushing using `npm run validate`
2. **Fix workflow failures immediately** - broken CI blocks all development
3. **Keep workflow files updated** when adding new tools or dependencies
4. **Monitor workflow performance** and optimize slow steps
5. **Use meaningful commit messages** that help identify what triggers workflows

See also:

- [Testing Guide](./testing.md)
- [Development Setup](./setup.md)
