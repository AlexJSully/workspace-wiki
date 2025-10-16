# GitHub Copilot Agents for Workspace Wiki Extension

This directory contains specialized AI agent configurations for the Workspace Wiki VS Code extension. **All agents and contributors must treat the `docs/` directory as the canonical, up-to-date source of truth for all project documentation, architecture, usage, and workflows (with the sole exception of `design-doc.md`, which is preserved for historical reference only).**

Whenever you implement a code or documentation change, or update an agent, you must:

- Update the relevant files in `docs/` to reflect the current implementation, usage, and best practices.
- Reference `docs/` in all agent instructions, code reviews, and workflow guidance.
- Use mermaid diagrams, code snippets, and examples in `docs/` as much as possible to ensure clarity and maintainability.
- **Update or add unit tests and E2E tests (e.g., `src/extension.test.ts`, `src/extension.e2e.test.ts`) to ensure reproducibility, idempotency, and prevent regression.**
- Never delete a unit or E2E test unless the method or feature it tests has been deleted or is no longer applicable. This is critical for regression and breaking change prevention.
- Never modify `docs/project/design-doc.md` (the original design doc) except to move or reference it.

**If there is ever a discrepancy between code, agent instructions, and `docs/`, the `docs/` directory (except `design-doc.md`) must be updated to match the current implementation.**

## Available Agents

### 🔧 [Extension Developer](./extension-developer.md)

**Primary Role**: VS Code Extension Development Expert

- VS Code Extension API mastery (TreeDataProvider, commands, configuration)
- TypeScript best practices and strict typing
- Extension architecture patterns and performance
- Project-specific knowledge of workspace wiki functionality

**Use When**: Implementing core extension features, working with VS Code APIs, architecting extension components.

### 🧪 [Tester](./tester.md)

**Primary Role**: Quality Assurance & Testing Specialist

- Jest unit testing and VS Code integration testing
- Test strategy design and coverage analysis
- E2E testing and regression prevention
- Performance testing and benchmarking

**Use When**: Writing tests, improving test coverage, debugging test failures, ensuring code quality.

### 🔒 [Security](./security.md)

**Primary Role**: Security & Vulnerability Expert

- Extension security best practices and threat modeling
- Input validation and sanitization
- File system security and path traversal prevention
- Dependency security and vulnerability management

**Use When**: Security reviews, handling user input, file operations, dependency updates.

### ♿ [Accessibility](./accessibility.md)

**Primary Role**: Accessibility & Inclusive Design Specialist

- WCAG 2.1 compliance and Section 508 standards
- Screen reader compatibility and keyboard navigation
- VS Code accessibility features integration
- Inclusive design principles

**Use When**: Implementing UI components, ensuring inclusive design, accessibility testing.

### ⚡ [Performance](./performance.md)

**Primary Role**: Performance Optimization Expert

- Extension startup and runtime performance
- Memory management and CPU optimization
- Caching strategies and I/O optimization
- Profiling and benchmarking techniques

**Use When**: Optimizing extension performance, reducing memory usage, improving responsiveness.

### 📝 [Documentation](./documentation.md)

**Primary Role**: Technical Documentation Specialist

- Clear, comprehensive documentation writing
- API documentation and user guides
- Code commenting and inline documentation
- Accessibility-focused documentation

**Use When**: Writing documentation, improving code comments, creating user guides.

## How to Use These Agents

### Single Agent Approach

When you need focused expertise in one area:

```text
@agent-name: Help me implement secure file path validation for the workspace scanner.
```

### Multi-Agent Collaboration

For complex tasks that span multiple domains:

```text
@extension-developer @security: Implement a new file watching feature that safely monitors workspace changes.

@tester @performance: Create benchmarks for the file discovery system and write performance regression tests.

@accessibility @documentation: Ensure the tree view is fully accessible and document the accessibility features.
```

### Agent Workflow Integration

For comprehensive feature development:

1. **Planning Phase**: @extension-developer for architecture design
2. **Implementation Phase**: @extension-developer + domain-specific agents
3. **Security Review**: @security for vulnerability assessment
4. **Testing Phase**: @tester for comprehensive test coverage
5. **Performance Review**: @performance for optimization opportunities
6. **Accessibility Review**: @accessibility for inclusive design validation
7. **Documentation Phase**: @documentation for user and developer guides

## Agent Interaction Patterns

### Code Review Workflow

```text
@security @tester: Review this pull request for security vulnerabilities and test coverage gaps.
```

### Feature Development

```text
@extension-developer: Design the architecture for a new markdown preview feature.
@accessibility: Ensure the preview feature is accessible to all users.
@performance: Optimize the preview rendering for large files.
@tester: Create comprehensive test cases for the preview functionality.
@documentation: Document the new preview feature for users.
```

### Bug Investigation

```text
@extension-developer @performance: Investigate why the tree view is slow to refresh in large workspaces.
```

## Best Practices

### Agent Selection

- **Start Specific**: Choose the most relevant agent for your immediate need
- **Expand Scope**: Add additional agents as complexity increases
- **Include Testing**: Always involve @tester for quality assurance
- **Security First**: Include @security for any user-facing features

### Communication Style

- **Be Specific**: Provide clear context about your goals and constraints
- **Include Code**: Share relevant code snippets and error messages
- **State Requirements**: Mention any specific requirements (performance, accessibility, etc.)
- **Ask for Examples**: Request code examples and implementation patterns

### Quality Assurance

- Always run `npm run validate` after implementing agent suggestions
- Include multiple agents in reviews for comprehensive feedback
- Test accessibility and performance implications of changes
- Document new features and architectural decisions

## Contributing to Agents

These agent configurations are living documents that should evolve with the project:

- **Update Knowledge**: Keep agent knowledge current with extension changes
- **Add Expertise**: Expand agent capabilities based on project needs
- **Improve Examples**: Add better code examples and patterns
- **Refine Instructions**: Clarify agent roles and capabilities

The goal is to have AI agents that provide increasingly helpful and contextually appropriate assistance for maintaining and extending the Workspace Wiki extension.
