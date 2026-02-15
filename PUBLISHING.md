<!-- markdownlint-disable MD032 MD040 -->

# Publishing Checklist

This document provides step-by-step instructions for publishing `@mindbreaker81/openrouter-image` to npm.

## Pre-Publishing Checklist

- [x] All tests passing (10/10)
- [x] Syntax check passed for all files
- [x] Library exports verified working
- [x] CLI functionality verified
- [x] npm pack produces correct file list
- [x] CHANGELOG.md updated with v0.5.0 changes
- [x] LICENSE file added (MIT)
- [x] package.json configured for public publishing
- [x] .npmignore excludes development files
- [x] README.md documents all usage modes
- [x] LIBRARY.md with API reference
- [x] CLAUDE_SKILL.md with installation guide

## Publishing Steps

### 1. Update Package Name (Optional)

If you want to publish under a scoped package name:

```bash
# Edit package.json name field
# From: "name": "@mindbreaker81/openrouter-image"
# To: "name": "@your-org/openrouter-image"
```

### 2. Create npm Account (if needed)

```bash
npm login
# Follow prompts to create account or login
```

### 3. Verify Package Contents

```bash
npm pack
tar -tzf mindbreaker81-openrouter-image-0.5.0.tgz
```

Expected files:
- CHANGELOG.md
- LICENSE
- package.json
- README.md
- src/cli.js
- src/client.js
- src/core.js
- src/index.js
- src/mcp-stdio.js
- src/server.js

### 4. Test Local Installation

```bash
# Install globally to test CLI
npm install -g ./mindbreaker81-openrouter-image-0.5.0.tgz

# Test CLI
openrouter-image --version
openrouter-image --help

# Test as library in a temporary project
mkdir /tmp/test-library && cd /tmp/test-library
npm install ../mindbreaker81-openrouter-image-0.5.0.tgz
node -e "import('./node_modules/@mindbreaker81/openrouter-image/src/index.js').then(m => console.log('Version:', m.version))"
```

### 5. Publish to npm

```bash
# For unscoped package
npm publish --access public

# For scoped package (@your-org/openrouter-image)
npm publish --access public
```

### 6. Verify Published Package

```bash
# View package info
npm view @mindbreaker81/openrouter-image

# Test installation from npm
npm install -g @mindbreaker81/openrouter-image
openrouter-image --version
```

### 7. Update Repository Tags

```bash
git tag v0.5.0
git push origin v0.5.0
```

## Post-Publishing Tasks

### Test Library Installation

```bash
# In a new project
npm install @mindbreaker81/openrouter-image
```

```javascript
import { OpenRouterImageClient } from '@mindbreaker81/openrouter-image';
const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY
});
// ...
```

### Test CLI Installation

```bash
npm install -g @mindbreaker81/openrouter-image
openrouter-image generate "test" -o test.png
```

### Test Claude Code Installation

```bash
npm install -g @mindbreaker81/openrouter-image
./scripts/install-claude.sh
```

Then restart Claude Code and test: "Generate an image of a sunset"

### Update GitHub Repository

- Update README with installation instructions from npm
- Add npm badge: `[![npm version](https://badge.fury.io/js/%40mindbreaker81%2Fopenrouter-image.svg)](https://www.npmjs.com/package/@mindbreaker81/openrouter-image)`
- Create GitHub release for v0.5.0

## Troubleshooting

### Package Name Already Exists

If you get "403 Forbidden - name already exists", you need to use a scoped name:

```json
{
  "name": "@your-username/openrouter-image-mcp"
}
```

### 402 Payment Required

Scoped packages require a paid npm account. Either:
- Use an unscoped name (if available)
- Pay for npm subscription ($7/month)

### Authentication Errors

```bash
npm logout
npm login
# Enter credentials
npm publish
```

## Version Bumping

For future releases:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run tests: `npm test`
4. Create git tag: `git tag v0.6.0`
5. Publish: `npm publish --access public`

## Files Published

The following files are included in the npm package (via `files` field in package.json):

```
src/
├── cli.js
├── client.js
├── core.js
├── index.js
├── mcp-stdio.js
└── server.js

CHANGELOG.md
LICENSE
README.md
package.json
```

Excluded files (via `.npmignore`):
- tests/
- scripts/
- .env*
- .git/
- *.md (except README, CHANGELOG, LICENSE)
- Dockerfile*
- docker-compose.yml
- output/
- .vscode/, .idea/, etc.
