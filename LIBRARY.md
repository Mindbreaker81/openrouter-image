# Library Documentation

This document describes how to use `openrouter-image-mcp` as a programmable library in Node.js applications.

## Installation

```bash
npm install openrouter-image-mcp
```

Or with a scoped package name:

```bash
npm install @your-org/openrouter-image
```

## Quick Start

```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';

// Initialize the client
const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultModel: 'google/gemini-2.5-flash-image',
  outputDir: './images'
});

// Generate an image
const result = await client.generateImage('A sunset over mountains', {
  outputPath: 'sunset.png'
});

console.log(`Image saved to: ${result.savedPath}`);
console.log(`MIME type: ${result.mimeType}`);
console.log(`Size: ${result.bytes.length} bytes`);
```

## API Reference

### OpenRouterImageClient

#### Constructor

```javascript
new OpenRouterImageClient(config)
```

**Parameters:**
- `config.apiKey` (string, optional) - OpenRouter API key. Defaults to `OPENROUTER_API_KEY` environment variable.
- `config.baseUrl` (string, optional) - Base URL for OpenRouter API. Defaults to `https://openrouter.ai/api/v1`.
- `config.defaultModel` (string, optional) - Default model to use for operations. Defaults to `OPENROUTER_IMAGE_MODEL` environment variable.
- `config.outputDir` (string, optional) - Directory for saving images. Defaults to `OUTPUT_DIR` environment variable or `/data`.
- `config.siteUrl` (string, optional) - Site URL sent as HTTP-Referer header to OpenRouter.
- `config.appName` (string, optional) - App name sent as X-Title header to OpenRouter.

**Example:**
```javascript
const client = new OpenRouterImageClient({
  apiKey: 'sk-or-v1-...',
  defaultModel: 'google/gemini-2.5-flash-image',
  outputDir: './generated-images',
  siteUrl: 'https://myapp.com',
  appName: 'My Image Generator'
});
```

#### Important Implementation Notes

**Environment Variable Handling:**

The `OpenRouterImageClient` class temporarily modifies `process.env` during method calls to pass configuration to the underlying core functions. This is by design and has the following implications:

1. **Temporary Override**: Environment variables are set just before each operation and use the client's configuration values
2. **Global Impact**: Since `process.env` is global, concurrent operations with different client instances could interfere with each other
3. **Best Practice**: Use a single client instance per application when possible, or ensure operations are sequential

**Example:**
```javascript
// The client internally sets process.env before each operation:
// process.env.OPENROUTER_API_KEY = this._apiKey
// process.env.OPENROUTER_BASE_URL = this._baseUrl
// process.env.OPENROUTER_IMAGE_MODEL = this._defaultModel
// etc.

await client.generateImage('...');  // Sets env vars during this call
await client.editImage('...', 'input.png');  // Sets env vars again
```

If you need to use multiple client instances with different configurations, ensure operations are not running concurrently:

```javascript
const client1 = new OpenRouterImageClient({ apiKey: 'key1', outputDir: './dir1' });
const client2 = new OpenRouterImageClient({ apiKey: 'key2', outputDir: './dir2' });

// OK: Sequential operations
await client1.generateImage('...');
await client2.generateImage('...');

// AVOID: Concurrent operations (env vars will interfere)
Promise.all([
  client1.generateImage('...'),
  client2.generateImage('...')
]);
```

#### Methods

##### generateImage(prompt, options)

Generate an image from a text prompt.

**Parameters:**
- `prompt` (string, required) - Text description of the desired image
- `options.model` (string, optional) - OpenRouter model ID. Overrides client default.
- `options.imageConfig` (object, optional) - Provider-specific configuration passed to OpenRouter.
- `options.outputPath` (string, optional) - Relative path under `outputDir` to save the image.

**Returns:** `Promise<ImageResult>`

```typescript
interface ImageResult {
  base64: string;        // Base64-encoded image data
  bytes: Buffer;         // Raw image bytes
  mimeType: string;      // Detected MIME type (image/png, image/jpeg, etc.)
  savedPath?: string;    // Absolute path where image was saved (if outputPath provided)
  relativePath?: string; // Relative path under outputDir (if outputPath provided)
  extensionFixed?: boolean; // Whether file extension was auto-corrected
}
```

**Example:**
```javascript
const result = await client.generateImage('A futuristic city with flying cars', {
  model: 'black-forest-labs/flux.2-klein-4b',
  outputPath: 'city.png',
  imageConfig: {
    width: 1024,
    height: 1024
  }
});

// Use the image data
fs.writeFileSync('output.png', result.bytes);
// Or: result.base64 for embedding in HTML/data URLs
```

##### editImage(prompt, input, options)

Edit an existing image using a text prompt (image-to-image).

**Parameters:**
- `prompt` (string, required) - Text description of the desired edit
- `input` (string | Buffer, required) - Input image as a file path (relative to `outputDir`) or as a Buffer
- `options.model` (string, optional) - OpenRouter model ID. Overrides client default.
- `options.imageConfig` (object, optional) - Provider-specific configuration passed to OpenRouter.
- `options.outputPath` (string, optional) - Relative path under `outputDir` to save the edited image.

**Returns:** `Promise<ImageResult>`

**Example:**
```javascript
// Edit from a file path in outputDir
const result = await client.editImage(
  'Make it look like a painting',
  'input/city.png', // Relative to outputDir
  {
    model: 'openai/gpt-5-image-mini',
    outputPath: 'output/painting.png'
  }
);

// Edit from a Buffer
const inputBuffer = fs.readFileSync('local-image.png');
const result = await client.editImage(
  'Convert to black and white',
  inputBuffer,
  {
    outputPath: 'bw.png'
  }
);
```

##### listModels()

List available OpenRouter image models with pricing information.

**Returns:** `Promise<Array<Model>>`

**Example:**
```javascript
const models = await client.listModels();
for (const model of models) {
  console.log(`${model.name}: ${model.pricing}`);
}
```

##### getModelsMarkdown()

Get models formatted as a Markdown table.

**Returns:** `Promise<string>`

**Example:**
```javascript
const markdown = await client.getModelsMarkdown();
console.log(markdown);
```

##### listImages(options)

List images stored in the output directory.

**Parameters:**
- `options.prefix` (string, optional) - Filter to a specific subfolder.
- `options.recursive` (boolean, optional) - Search recursively. Default: `true`.
- `options.limit` (number, optional) - Maximum results. Default: `200`, max: `1000`.
- `options.includeNonImages` (boolean, optional) - Include non-image files. Default: `false`.
- `options.sort` (string, optional) - Sort order: `mtime_desc`, `mtime_asc`, `size_desc`, `size_asc`, `name_asc`, `name_desc`. Default: `mtime_desc`.

**Returns:** `Promise<string>` - Markdown table with image list.

**Example:**
```javascript
const list = await client.listImages({
  prefix: 'thumbnails',
  limit: 50,
  sort: 'size_desc'
});
console.log(list);
```

##### readImage(imagePath)

Read an image from the output directory.

**Parameters:**
- `imagePath` (string, required) - Relative path under `outputDir`.

**Returns:** `Promise<ImageInfo>`

```typescript
interface ImageInfo {
  abs: string;              // Absolute path
  detectedMimeType: string;  // Detected MIME type
  base64: string;           // Base64-encoded data
  byteLength: number;        // File size in bytes
}
```

**Example:**
```javascript
const info = await client.readImage('sunset.png');
console.log(`File: ${info.abs}`);
console.log(`Size: ${info.byteLength} bytes`);
console.log(`Type: ${info.detectedMimeType}`);
```

## Advanced Usage

### Environment Variable Configuration

The client automatically reads from environment variables if not explicitly provided:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
export OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image
export OUTPUT_DIR=./generated-images
export OPENROUTER_SITE_URL=https://myapp.com
export OPENROUTER_APP_NAME=MyApp
```

```javascript
// Client will automatically use the environment variables
const client = new OpenRouterImageClient();
```

### Reusing Core Functions

If you need lower-level access to the core functions without the client wrapper:

```javascript
import * as core from 'openrouter-image-mcp/core';

// Call OpenRouter API directly
const response = await core.callOpenRouterResponses({
  model: 'google/gemini-2.5-flash-image',
  prompt: 'A beautiful landscape',
  imageConfig: { width: 1024, height: 1024 }
});

// Extract and process the image
const base64 = core.extractBase64FromResponse(response);
const { mimeType, base64: data } = core.stripDataUrlPrefix(base64);

// File operations
const safePath = core.safeJoinOutputDir('output/image.png');
await fs.mkdir(path.dirname(safePath), { recursive: true });
await fs.writeFile(safePath, Buffer.from(data, 'base64'));
```

### Error Handling

```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';

const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY
});

try {
  const result = await client.generateImage('A mountain landscape', {
    outputPath: 'mountain.png'
  });
  console.log('Success:', result.savedPath);
} catch (error) {
  if (error.message.includes('OPENROUTER_API_KEY')) {
    console.error('Missing API key');
  } else if (error.message.includes('No image data returned')) {
    console.error('Generation failed - no image data');
  } else {
    console.error('Error:', error.message);
  }
}
```

## TypeScript Support

The package includes TypeScript types. Import with type annotations:

```typescript
import { OpenRouterImageClient, ImageResult } from 'openrouter-image-mcp';

const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultModel: 'google/gemini-2.5-flash-image'
});

const result: ImageResult = await client.generateImage('A sunset', {
  outputPath: 'sunset.png'
});

console.log(`Saved to: ${result.savedPath}`);
```

## Examples

### Web Service

```javascript
import express from 'express';
import { OpenRouterImageClient } from 'openrouter-image-mcp';

const app = express();
const client = new OpenRouterImageClient();

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  try {
    const result = await client.generateImage(prompt, {
      outputPath: `generated/${Date.now()}.png`
    });

    res.json({
      success: true,
      path: result.relativePath,
      url: `/images/${result.relativePath}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### Batch Processing

```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';

const client = new OpenRouterImageClient();

const prompts = [
  'A red rose',
  'A blue sky',
  'A green forest'
];

for (const prompt of prompts) {
  const filename = prompt.toLowerCase().replace(/ /g, '-') + '.png';
  const result = await client.generateImage(prompt, {
    outputPath: `batch/${filename}`
  });
  console.log(`Generated: ${result.savedPath}`);
}
```

### Image Editing Pipeline

```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';

const client = new OpenRouterImageClient();

// Generate base image
const base = await client.generateImage('A simple house', {
  outputPath: 'pipeline/01-house.png'
});

// Apply edits
const steps = ['Add a garden', 'Add a fence', 'Make it night'];
for (let i = 0; i < steps.length; i++) {
  const input = i === 0 ? 'pipeline/01-house.png' : `pipeline/0${i+1}-house.png`;
  const result = await client.editImage(steps[i], input, {
    outputPath: `pipeline/0${i+2}-house.png`
  });
  console.log(`Step ${i+1}: ${result.savedPath}`);
}
```

## License

MIT
