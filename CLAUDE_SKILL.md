<!-- markdownlint-disable MD031 MD032 MD034 MD040 -->

# Claude Code Skill Installation Guide

This document describes how to install and use `openrouter-image-mcp` as a Claude Code skill.

## Prerequisites

1. **Claude Code** installed and working
2. **OpenRouter API key** - Get one at https://openrouter.ai/keys
3. **Node.js >= 20** installed

## Installation

### Option 1: Install from npm (Recommended)

Once published to npm:

```bash
npm install -g @mindbreaker81/openrouter-image
```

Or with a scoped package:

```bash
npm install -g @your-org/openrouter-image
```

### Option 2: Install from git repository

```bash
git clone https://github.com/YOUR_USER/openrouter-image-mcp.git
cd openrouter-image-mcp
npm install
npm link
```

### Option 3: Install from tarball

```bash
npm pack
npm install -g mindbreaker81-openrouter-image-*.tgz
```

## Configuration

### 1. Set Up Environment Variables

Create or edit `~/.bashrc` or `~/.zshrc`:

```bash
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
export OPENROUTER_IMAGE_MODEL="google/gemini-2.5-flash-image"
```

Then reload:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

**Alternatively**, configure directly in `~/.claude.json` (see below).

### 2. Configure Claude Code

Edit `~/.claude.json` (Windows: `%USERPROFILE%\.claude.json`) and add:

```json
{
  "mcpServers": {
    "openrouter-image": {
      "command": "openrouter-image",
      "args": ["server", "--stdio"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here",
        "OPENROUTER_IMAGE_MODEL": "google/gemini-2.5-flash-image"
      }
    }
  }
}
```

**Important:** Replace `sk-or-v1-your-key-here` with your actual API key.

**Alternative without env in config** (uses environment variables):

```json
{
  "mcpServers": {
    "openrouter-image": {
      "command": "openrouter-image",
      "args": ["server", "--stdio"]
    }
  }
}
```

### 3. Restart Claude Code

Quit and restart Claude Code for the configuration to take effect.

## Usage

Once installed and configured, you can use the following tools in Claude Code conversations:

### Available Tools

#### generate_image

Generate an image from a text prompt.

**Example prompts:**
- "Generate an image of a futuristic city with flying cars at sunset"
- "Create a logo for a coffee shop called Bean & Brew"
- "Make an image showing a diagram of how DNS resolution works"

**Parameters:**
- `prompt` (required): Text description of the desired image
- `model` (optional): OpenRouter model ID (defaults to OPENROUTER_IMAGE_MODEL)
- `output_path` (optional): Where to save the image (relative to OUTPUT_DIR)
- `image_config` (optional): Provider-specific configuration
- `return_base64` (optional): Include base64 data in response (default: true)

#### edit_image

Edit an existing image using a text prompt (image-to-image).

**Example prompts:**
- "Edit the image at assets/logo.png to make it blue instead of red"
- "Transform diagram.png to add a security layer"
- "Convert screenshot.png to a minimalist illustration style"

**Parameters:**
- `prompt` (required): Text description of the desired edit
- `input_image_path` (required): Path to the input image (relative to OUTPUT_DIR)
- `model` (optional): OpenRouter model ID
- `output_path` (optional): Where to save the edited image
- `image_config` (optional): Provider-specific configuration
- `return_base64` (optional): Include base64 data in response (default: true)

#### list_image_models

List available OpenRouter image models with pricing information.

**Example prompts:**
- "Show me available image models"
- "What models can I use for image generation?"
- "List models with their pricing"

**Parameters:** None

#### list_output_images

List images stored in the output directory.

**Example prompts:**
- "Show me generated images"
- "List images in the tests/ folder"
- "What images do I have?"

**Parameters:**
- `prefix` (optional): Filter to a subfolder (e.g., "tests/")
- `limit` (optional): Maximum results (default: 200)
- `sort` (optional): Sort order (default: "mtime_desc")
- `recursive` (optional): Search recursively (default: true)
- `include_non_images` (optional): Include non-image files (default: false)

#### read_output_image

Read an image from the output directory.

**Example prompts:**
- "Read the image at sunset.png"
- "Show me diagram.png"
- "What's in assets/logo.png?"

**Parameters:**
- `path` (required): Path to the image (relative to OUTPUT_DIR)
- `return_base64` (optional): Include base64 data in response (default: true)
- `mime_type` (optional): Override MIME type

## Examples

### Example 1: Generate and Edit

```
You: Generate an image of a mountain landscape at sunset

Claude: [Uses generate_image tool]

You: Now edit that image to make it look like a watercolor painting

Claude: [Uses edit_image tool with the previous image as input]
```

### Example 2: List and Read

```
You: Show me all images I've generated

Claude: [Uses list_output_images tool]

You: Read the most recent one

Claude: [Uses read_output_image tool with the path from the list]
```

### Example 3: Diagram Generation

```
You: Create a diagram showing the flow of an HTTP request through a load balancer

Claude: [Uses generate_image tool with a detailed prompt]

You: That's good but add a database server at the end

Claude: [Uses edit_image tool with the previous image]
```

### Example 4: Icon Generation

```
You: Generate a minimalist app icon for a weather app, 512x512, white background

Claude: [Uses generate_image tool with specific image_config]

You: List all icons in the assets folder

Claude: [Uses list_output_images with prefix="assets/"]
```

## Configuration Options

### Changing the Output Directory

By default, images are saved to `/data` (or `./output` for CLI use). To change this:

In `~/.claude.json`:

```json
{
  "mcpServers": {
    "openrouter-image": {
      "command": "openrouter-image",
      "args": ["server", "--stdio"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here",
        "OUTPUT_DIR": "/path/to/your/images"
      }
    }
  }
}
```

### Using a Different Model

Set `OPENROUTER_IMAGE_MODEL` in the config or use the `model` parameter:

```json
{
  "env": {
    "OPENROUTER_IMAGE_MODEL": "black-forest-labs/flux.2-klein-4b"
  }
}
```

Or in conversation:

```
You: Generate an image of a cat using flux-pro

Claude: [Uses generate_image with model="black-forest-labs/flux.2-klein-4b"]
```

### Adding Custom Headers

To track API usage:

```json
{
  "env": {
    "OPENROUTER_SITE_URL": "https://myapp.com",
    "OPENROUTER_APP_NAME": "My Claude Code Workflow"
  }
}
```

## Troubleshooting

### Tool Not Available

If the tools don't appear in Claude Code:

1. Check that the CLI is installed:
   ```bash
   openrouter-image --help
   ```

2. Verify `~/.claude.json` syntax is valid (use a JSON validator)

3. Restart Claude Code completely

4. Check Claude Code logs for errors

### API Key Errors

If you see "OPENROUTER_API_KEY is not set":

1. Verify your API key is valid at https://openrouter.ai/keys
2. Check that the key is set correctly in `~/.claude.json`
3. Try setting it in your shell environment instead

### Permission Errors

If you see permission denied errors:

```bash
# Check OUTPUT_DIR permissions
ls -la /data  # or your custom OUTPUT_DIR

# Fix permissions
chmod 755 /data
```

### Image Generation Fails

If generation fails with "No image data returned":

1. Try a different model (use `list_image_models`)
2. Check that your OpenRouter account has credits
3. Verify the prompt doesn't violate content policies
4. Try a simpler prompt to test

## Advanced: HTTP Server Mode

For remote access or multiple clients, you can run the MCP server in HTTP mode instead of stdio:

```bash
openrouter-image server --port 3003
```

Then configure Claude Code to use HTTP:

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer your-auth-token-here"
      }
    }
  }
}
```

Set `AUTH_TOKEN` environment variable on the server:

```bash
export AUTH_TOKEN=$(openssl rand -hex 32)
openrouter-image server --port 3003
```

## Support

For issues or questions:
- GitHub: https://github.com/YOUR_USER/openrouter-image-mcp
- OpenRouter Docs: https://openrouter.ai/docs
- Claude Code Docs: https://claude.ai/code

## License

MIT
