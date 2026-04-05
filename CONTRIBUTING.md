# Contributing to Purp SCL

Thank you for your interest in contributing to Purp! This document provides guidelines for contributing.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/purp-scl.git`
3. **Install** dependencies: `npm install`
4. **Build**: `npm run build`
5. **Create a branch**: `git checkout -b feature/your-feature`

## Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in dev mode (watch for changes)
npm run dev

# Run tests
npm test

# Link CLI for local testing
npm link
```

## What Can You Contribute?

### High Priority
- **Compiler improvements**: Better error messages, new language features
- **Bug fixes**: Fix issues in lexer, parser, semantic analysis, or codegen
- **Testing**: Add unit tests, integration tests, snapshot tests
- **Documentation**: Improve docs, add tutorials, fix typos

### Welcome
- **New stdlib modules**: Additional standard library functionality
- **Templates**: New project templates for common use cases
- **Examples**: New example .purp files demonstrating patterns
- **CLI features**: New commands or improved existing ones

### Future
- **LSP implementation**: Language Server Protocol for IDE support
- **VS Code extension**: Syntax highlighting, snippets, diagnostics
- **Frontend codegen**: Compile `frontend {}` blocks to React/Next.js

## Code Style

- TypeScript with strict mode
- Use `const` over `let` where possible
- Descriptive function and variable names
- Comments for non-obvious logic
- Keep functions focused — one responsibility per function

## Commit Messages

Use conventional commits:
```
feat: add PDA validation to semantic analyzer
fix: handle empty program body in parser
docs: update CLI reference with new commands
test: add lexer tests for string escapes
refactor: extract token reader into separate class
```

## Pull Request Process

1. **Update** your branch with latest `main`
2. **Ensure** `npm run build` passes
3. **Run** `npm test` and ensure all tests pass
4. **Add** tests for new functionality
5. **Update** documentation if needed
6. **Submit** the PR with a clear description

### PR Template
- What does this PR do?
- Why is this change needed?
- How was it tested?
- Screenshots (if UI-related)

## Reporting Issues

Use GitHub Issues with the appropriate template:
- **Bug Report**: For bugs and unexpected behavior
- **Feature Request**: For new feature ideas
- **Question**: For usage questions

## Code of Conduct

By contributing, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
