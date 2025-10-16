# CI/CD Workflows

The project uses GitHub Actions for continuous integration and code quality assurance. All workflows are located in [`.github/workflows/`](../../.github/workflows/).

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
- `**/*.ts`, `**/*.tsx` - TypeScript files
- `**/*.json` - Configuration files
- `esbuild.js` - Build configuration
- `jest.config.js` - Test configuration
- `package*.json` - Dependencies
- `src/**` - Source code directory
- `tsconfig*.json` - TypeScript configuration

**Quality Checks:**

- **TypeScript Compilation:** Validates TypeScript syntax and types
- **ESLint:** Code style and potential bug detection
- **Jest Unit Tests:** Runs all unit tests in `src/**/*.test.ts`
- **Extension E2E Tests:** Tests extension behavior in VS Code environment
- **Build Validation:** Ensures the extension bundles correctly with esbuild

**Node.js Version:** 22.x

### Markdown Quality Assurance

**File:** [`.github/workflows/code-qa-markdown.yaml`](../../.github/workflows/code-qa-markdown.yaml)

**Purpose:** Maintains consistent markdown formatting and quality across documentation.

**Triggers:**

- Push to `main` branch
- Pull requests to `main` branch
- Changes to markdown files or linting configuration

**File Patterns Monitored:**

- `**/*.md` - All markdown files
- `.markdownlint.json` - Linting configuration
- `.markdownlintignore` - Files to exclude from linting
- `package*.json` - Dependencies for markdown tools

**Quality Checks:**

- **Markdownlint:** Validates markdown syntax and formatting
- **Link Validation:** Ensures internal links work correctly
- **Formatting Consistency:** Enforces uniform style across documentation

**Node.js Version:** 22.x

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
npm install

# Run all validation checks (same as CI)
npm run validate

# Individual checks
npm run lint              # ESLint validation
npm run test:jest         # Jest unit tests
npm run test:extension    # E2E tests
npm run compile           # TypeScript compilation
npm run build             # Extension bundling
```

## Workflow Configuration

### Permissions

Both workflows use minimal permissions:

- `contents: read` - Read repository contents only

### Strategy

- **Operating System:** Ubuntu Latest (Linux)
- **Node.js Version:** 22.x (matrix strategy for future multi-version support)
- **Dependency Caching:** Automatic npm cache management

### Performance Optimizations

- **Path-based Triggers:** Workflows only run when relevant files change
- **Dependency Caching:** npm dependencies are cached between runs
- **Parallel Execution:** Multiple quality checks run concurrently when possible

## Best Practices

1. **Always validate locally** before pushing using `npm run validate`
2. **Fix workflow failures immediately** - broken CI blocks all development
3. **Keep workflow files updated** when adding new tools or dependencies
4. **Monitor workflow performance** and optimize slow steps
5. **Use meaningful commit messages** that help identify what triggers workflows

See also:

- [Testing Guide](./testing.md)
- [Development Setup](./setup.md)
