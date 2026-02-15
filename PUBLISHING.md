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

> **Important: about the `.tgz` file**
>
> The file `mindbreaker81-openrouter-image-<version>.tgz` is a **temporary package artifact** created by `npm pack`.
> It is the exact bundle npm will publish, and is used to validate what will be shipped before running `npm publish`.
>
> - It is generated locally with `npm pack`
> - It is used for local install tests (`npm install -g ./...tgz`)
> - It is **not required to be committed to git** (normally it should not be versioned)

```bash
# Build dynamic package artifact name from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name.replace('@', '').replace('/', '-')")
PACKAGE_VERSION=$(node -p "require('./package.json').version")
TGZ="${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz"

# Generates: $TGZ
npm pack
tar -tzf "$TGZ"
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
# Reuse variables from Step 3 (or define them again)
PACKAGE_NAME=$(node -p "require('./package.json').name.replace('@', '').replace('/', '-')")
PACKAGE_VERSION=$(node -p "require('./package.json').version")
TGZ="${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz"

# Install globally to test CLI
npm install -g "./$TGZ"

# Test CLI
openrouter-image --version
openrouter-image --help

# Test as library in a temporary project
PROJECT_DIR=$(pwd)
mkdir /tmp/test-library && cd /tmp/test-library
npm install "$PROJECT_DIR/$TGZ"
node -e "import('./node_modules/@mindbreaker81/openrouter-image/src/index.js').then(m => console.log('Version:', m.version))"
```

If you don't have the `.tgz` file yet, run `npm pack` first in the project root.

### Automated prepublish script

This repository includes a helper script that automates the pre-publish checks described above.

- Script: `scripts/prepublish-check.sh`
- Purpose: Run tests, create the `.tgz` with `npm pack`, inspect the tarball contents, and verify a local install into a temporary project.
- How to run locally:

```bash
# From the project root
./scripts/prepublish-check.sh
```

- Shortcut via `npm`:

```bash
# From the project root
npm run prepublish-check
```

The script exits non-zero when any check fails. On success it prints the path to the generated artifact and a short summary.

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
PACKAGE_VERSION=$(node -p "require('./package.json').version")
git tag "v$PACKAGE_VERSION"
git push origin "v$PACKAGE_VERSION"
```

### Publish to GitHub Packages (optional)

You can publish the same scoped package to GitHub Packages so it can be installed from GitHub's npm registry.

Requirements:
- Package name must be scoped (this project uses `@mindbreaker81/openrouter-image`).
- A GitHub token with `write:packages` (or `repo` for classic tokens) scope.

Quick steps (one-shot):

```bash
# Create a temporary .npmrc that points the scope to GitHub Packages
export GHPKG_TOKEN=$(gh auth token)
printf "@mindbreaker81:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=${GHPKG_TOKEN}\n" > .npmrc.ghpkg

# Publish to GitHub Packages
npm publish --registry=https://npm.pkg.github.com/

# Remove the temporary file
rm -f .npmrc.ghpkg
```

Notes and troubleshooting:
- If `npm publish` fails with `ENEEDAUTH`, ensure the token has `write:packages` scope. Create a token at https://github.com/settings/tokens (classic) or via the GitHub UI for fine-grained tokens and grant `write:packages`.
- Alternatively, add the following to `package.json` to make `npm publish` use GitHub Packages by default:

```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com/"
}
```

- To publish multiple registries (npmjs and GitHub Packages) keep `publishConfig` unset and run `npm publish` with `--registry` for the target registry.


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
  "name": "@your-username/openrouter-image"
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
