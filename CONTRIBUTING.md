# Contributing to openrouter-image

Thank you for your interest in contributing to openrouter-image! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Development Setup

### Prerequisites

- **Node.js >= 20** (uses ES modules)
- **npm** (included with Node.js)

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/mindbreaker81/openrouter-image.git
cd openrouter-image

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env and add your OPENROUTER_API_KEY
# For CLI usage, you only need OPENROUTER_API_KEY
# For MCP server, you also need AUTH_TOKEN
```

### Development Workflow

```bash
# Run CLI locally (development mode)
npm run cli -- generate "A test image" -o test.png

# Run MCP server locally
npm start

# Run MCP server in stdio mode (for Claude Code)
npm run cli -- server --stdio
```

## Running Tests

The project uses Node.js built-in test runner (`node:test`).

```bash
# Run all tests
npm test

# Run a specific test file
node --test tests/cli.test.js

# Run with verbose output
node --test --verbose tests/cli.test.js
```

### Test Structure

Tests are located in the `tests/` directory:

- `tests/cli.test.js` - CLI argument validation and integration tests
- Future: `tests/core.test.js` - Core module tests
- Future: `tests/client.test.js` - Library client tests

### Writing Tests

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('My Feature', () => {
  it('should do something', async () => {
    const result = await myFunction();
    assert.strictEqual(result, 'expected');
  });
});
```

## Code Style

This project follows these conventions:

### JavaScript

- **ES Modules** - Use `import`/`export` (type: "module" in package.json)
- **JSDoc Comments** - Document public APIs with JSDoc
- **Async/Await** - Prefer async/await over promises
- **Error Handling** - Always handle errors appropriately

Example:

```javascript
/**
 * Process an image and return the result
 * @param {string} inputPath - Path to the input image
 * @param {Object} options - Processing options
 * @returns {Promise<ImageResult>} Processing result
 * @throws {Error} If input path is invalid
 */
export async function processImage(inputPath, options = {}) {
  try {
    const result = await doSomething(inputPath, options);
    return result;
  } catch (error) {
    throw new Error(`Failed to process image: ${error.message}`);
  }
}
```

### File Organization

- `src/core.js` - Shared business logic (no interface-specific code)
- `src/server.js` - MCP HTTP server implementation
- `src/mcp-stdio.js` - MCP stdio server implementation
- `src/client.js` - Library client class
- `src/cli.js` - Command-line interface
- `tests/` - All test files

### Naming Conventions

- **Files**: `kebab-case.js` (e.g., `image-processor.js`)
- **Variables/Functions**: `camelCase` (e.g., `processImage`)
- **Classes**: `PascalCase` (e.g., `OpenRouterImageClient`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `OPENROUTER_API_KEY`)

### Import Order

```javascript
// 1. Node.js built-in modules
import fs from 'node:fs/promises';
import path from 'node:path';

// 2. External dependencies
import express from 'express';

// 3. Internal modules
import { processImage } from './core.js';
```

## Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements

### Examples

```
feat(cli): add --filter option for list command

Fixes #123

The new --filter option allows users to filter images
by MIME type when listing output images.
```

```
fix(core): correct path traversal check

This update fixes a potential issue where paths with
multiple consecutive slashes could bypass the safety check.
```

## Pull Request Process

### 1. Fork and Branch

```bash
# Create a feature branch
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bugfix
```

### 2. Make Changes

- Write clear, descriptive commit messages
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass: `npm test`

### 3. Submit PR

- Push to your fork
- Create a pull request to `main`
- Fill in the PR template
- Link related issues

### PR Checklist

- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] PR description clearly explains changes

### Review Process

- Maintainers will review your PR
- Address review comments
- Keep the conversation focused and constructive
- Once approved, maintainers will merge

## Reporting Issues

### Bug Reports

Include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Minimal reproduction steps
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: Node.js version, OS, etc.
- **Logs**: Relevant error messages or logs

### Feature Requests

Include:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: How you envision the feature working
- **Alternatives**: Other approaches you considered
- **Impact**: Who would benefit and how

## Questions?

- Check existing [Issues](https://github.com/mindbreaker81/openrouter-image/issues)
- Start a [Discussion](https://github.com/mindbreaker81/openrouter-image/discussions)
- Read the [Documentation](README.md)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
