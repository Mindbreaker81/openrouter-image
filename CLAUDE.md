# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-interface image generation/editing tool via OpenRouter's Responses API. All interfaces share a **common core** ([`src/core.js`](src/core.js)) and provide identical capabilities.

- **MCP Server (HTTP)**: Express server exposing MCP JSON-RPC endpoints with Bearer auth ([`src/server.js`](src/server.js))
- **MCP Server (stdio)**: stdin/stdout JSON-RPC for local MCP clients like Claude Code ([`src/mcp-stdio.js`](src/mcp-stdio.js))
- **CLI**: Command-line interface ([`src/cli.js`](src/cli.js))
- **Library**: Programmatic API via [`OpenRouterImageClient`](src/client.js) class

## Development Commands

```bash
# Run MCP server (requires AUTH_TOKEN and OPENROUTER_API_KEY in .env)
npm start
# or
node src/server.js

# Run CLI (requires OPENROUTER_API_KEY)
npm run cli -- <command> [options]
# or (if globally installed via npm link)
openrouter-image <command> [options]

# Run MCP server in stdio mode (for Claude Code)
npm run cli -- server --stdio

# Run tests (uses Node.js built-in test runner)
npm test

# Run a single test file
node --test tests/cli.test.js

# Install CLI globally (for development)
npm link

# Use as a library in another Node.js project
import { OpenRouterImageClient } from 'openrouter-image-mcp';
```

## Architecture

### Core Module (`src/core.js`)

The heart of the project. All shared logic lives here:

- **OpenRouter API integration**: `callOpenRouterResponses()` for generation/editing
- **File operations**: `readOutputImage()`, `listOutputImages()`, `safeJoinOutputDir()`
- **Image processing**: MIME type detection (`sniffImageMimeType()`), extension correction (`fixOutputPathExtensionForMimeType()`)
- **Model listing**: `fetchOpenRouterImageModels()`, `formatModelsAsMarkdown()`
- **Environment config**: Exports `OPENROUTER_API_KEY`, `OUTPUT_DIR`, etc.

### Server (`src/server.js`)

Express-based MCP JSON-RPC server (HTTP mode):

- `/health` - healthcheck endpoint
- `/mcp` - MCP JSON-RPC endpoint (requires `Authorization: Bearer <AUTH_TOKEN>`)
- Implements MCP protocol methods: `initialize`, `tools/list`, `tools/call`
- Maps MCP tools to core functions:

### Stdio Server (`src/mcp-stdio.js`)

MCP server over stdin/stdout for local clients (e.g., Claude Code):

- Reads JSON-RPC messages from stdin, writes responses to stdout
- No authentication required (local communication)
- Same tool implementations as HTTP server
- Started via CLI: `openrouter-image server --stdio`

### Library Client (`src/client.js`)

`OpenRouterImageClient` class provides a programmatic API for Node.js applications:

```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';

const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultModel: 'google/gemini-2.5-flash-image',
  outputDir: './output'
});

// Generate image
const result = await client.generateImage('A sunset over mountains', {
  outputPath: 'sunset.png'
});

// Edit image
await client.editImage('Make it rainy', 'sunset.png', {
  outputPath: 'rainy-sunset.png'
});

// List models
const models = await client.listModels();

// List saved images
const images = await client.listImages({ prefix: 'tests', limit: 20 });
```

The client internally sets environment variables before each core function call, allowing multiple client instances with different configurations.
  - `generate_image` → `callOpenRouterResponses()` + file save
  - `edit_image` → reads input image + `callOpenRouterResponses()` + file save
  - `list_image_models` → `fetchOpenRouterImageModels()`
  - `list_output_images` → `listOutputImages()`
  - `read_output_image` → `readOutputImage()`

### CLI (`src/cli.js`)

Command-line interface using `parseArgs`:

- Commands: `generate`, `edit`, `models`, `list`, `read`, `server`
- Mirrors MCP tool functionality
- Uses same core functions as server
- Can start MCP server in HTTP or stdio mode

## Package Exports

The [`package.json`](package.json) exports module for library usage:

```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';
import { OpenRouterImageClient } from 'openrouter-image-mcp/client';
import { callOpenRouterResponses, safeJoinOutputDir } from 'openrouter-image-mcp/core';
```

## Key Patterns

### File Path Security

All file operations under `OUTPUT_DIR` use `safeJoinOutputDir()` to prevent path traversal:
```javascript
const abs = safeJoinOutputDir(relativePath); // Throws if path escapes OUTPUT_DIR
await assertNotSymlink(abs); // Rejects symlinks
```

### Automatic Extension Correction

When saving images, the extension is auto-corrected if it doesn't match the detected MIME type:
```javascript
const { mimeType, base64 } = stripDataUrlPrefix(openRouterResponseData);
const imageBytes = Buffer.from(base64, "base64");
const detectedMime = sniffImageMimeType(imageBytes); // Magic byte detection
const fixed = fixOutputPathExtensionForMimeType(requestedPath, detectedMime);
// fixed.outputPath has corrected extension if needed
```

### OpenRouter Response Handling

OpenRouter Returns API responses with varying structures. `extractBase64FromResponse()` handles multiple formats:
- `output[].type === "image_generation_call"` with `result` field
- `output[].type === "image"` with `data` field
- Top-level `result` field

### MIME Type Detection Priority

1. Data URL prefix (`data:image/png;base64,...`) - extracted via `stripDataUrlPrefix()`
2. Magic byte detection via `sniffImageMimeType()` (PNG, JPEG, GIF, WEBP)
3. Fallback to `image/png`

## Environment Variables

Required for MCP server (HTTP):

- `AUTH_TOKEN` - Bearer token for `/mcp` endpoint
- `OPENROUTER_API_KEY` - OpenRouter API key
- `OPENROUTER_IMAGE_MODEL` - Default model (unless `model` arg provided)

Required for CLI:

- `OPENROUTER_API_KEY`
- `OPENROUTER_IMAGE_MODEL` (or pass `--model`)

Optional:

- `OUTPUT_DIR` - Default: `/data` (server), overrides with local path for CLI
- `PORT` - Default: `3000`
- `OPENROUTER_BASE_URL` - Default: `https://openrouter.ai/api/v1`
- `OPENROUTER_SITE_URL` - Sent as `HTTP-Referer` header
- `OPENROUTER_APP_NAME` - Sent as `X-Title` header

Note: `AUTH_TOKEN` is only used by the HTTP MCP server. The stdio MCP server requires no authentication. The CLI and library client only need `OPENROUTER_API_KEY`.

## Testing

Tests use Node.js built-in `node:test` runner with a mock HTTP server for OpenRouter API integration. Test file: `tests/cli.test.js`.

The mock server pattern:
```javascript
await runWithMockServer(
  (req, res, body) => {
    // Handle OpenRouter API requests
    if (req.url === "/api/v1/responses" && req.method === "POST") {
      // Validate request body
      // Return mock response
    }
  },
  async (baseUrl) => {
    // Run CLI with OPENROUTER_BASE_URL overridden to mock server
    // Assert results
  }
);
```

## Deployment

- **MCP Server (HTTP)**: Use `Dockerfile` + `docker-compose.yml` (mounts `./output` as `/data`)
- **MCP Server (stdio)**: Use CLI command `openrouter-image server --stdio` or `node src/cli.js server --stdio`
- **CLI**: Use `Dockerfile.cli` for standalone CLI container
- **Library**: Install as npm dependency and import `OpenRouterImageClient`
