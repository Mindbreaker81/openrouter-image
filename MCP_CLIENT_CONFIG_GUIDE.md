# MCP HTTP Server Configuration Guide

**Comprehensive guide for configuring HTTP-based MCP servers across popular AI coding tools and IDEs**

This guide explains how to configure your openrouter-image server (running at `http://localhost:3003/mcp` with Bearer token authentication) across different AI coding tools.

---

## Table of Contents

- [Server Details](#server-details)
- [Quick Reference](#quick-reference)
- [Tool-Specific Configuration](#tool-specific-configuration)
  - [Claude Code](#1-claude-code)
  - [Cursor](#2-cursor)
  - [VS Code with GitHub Copilot](#3-vs-code-with-github-copilot)
  - [Windsurf](#4-windsurf)
  - [Cline (formerly Claude Dev)](#5-cline-formerly-claude-dev)
  - [Continue](#6-continue)
  - [Roo Code](#7-roo-code)
  - [JetBrains IDEs](#8-jetbrains-ides)
- [Configuration Format Comparison](#configuration-format-comparison)
- [Authentication Methods](#authentication-methods)
- [Troubleshooting](#troubleshooting)

---

## Server Details

**Your openrouter-image server:**
- **URL**: `http://localhost:3003/mcp`
- **Authentication**: Bearer token (set via `AUTH_TOKEN` environment variable)
- **Transport**: HTTP (JSON-RPC over HTTP POST)
- **Tools**:
  - `generate_image`: Generate images via OpenRouter
  - `list_image_models`: List available image models with pricing

---

## Quick Reference

| Tool | Config File Location | Config File Name | Transport Support |
|------|-------------------|-------------------|-------------------|
| **Claude Code** | `~/.claude.json` | `.mcp.json` (project) | HTTP, stdio |
| **Cursor** | `~/.cursor/mcp.json` | `.cursor/mcp.json` (project) | HTTP, stdio, SSE |
| **VS Code** | `.vscode/mcp.json` | User settings | HTTP, stdio, SSE |
| **Windsurf** | `mcp.config.json` | Cascade (via UI) | HTTP, stdio |
| **Cline** | Via MCP UI | Via MCP UI | HTTP, stdio |
| **Continue** | `~/.continue/config.json` | `.continue/mcp.json` | HTTP, stdio |
| **Roo Code** | `~/.roo/mcp_settings.json` | `.roo/mcp.json` | HTTP, stdio, SSE |
| **JetBrains** | `.idea/mcp.json` | Project config | HTTP, stdio, SSE |

---

## Tool-Specific Configuration

### 1. Claude Code

**Configuration Locations:**
- **User/Local scope**: `~/.claude.json` (recommended for HTTP MCP servers)
- **Project scope**: `.mcp.json` (in project root)
- **Note**: MCP servers in `~/.claude/settings.json` or `~/.claude/settings.local.json` are **silently ignored**

**Configuration Format:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${AUTH_TOKEN}"
      }
    }
  }
}
```

**Adding via CLI:**

```bash
# Quick method
claude mcp add --transport http openrouter-image http://localhost:3003/mcp --env AUTH_TOKEN="your-token-here"

# With header flag
claude mcp add openrouter-image \
  --transport http \
  http://localhost:3003/mcp \
  --header "Authorization: Bearer ${AUTH_TOKEN}"
```

**Environment Variable Usage:**

```bash
# Set in your shell profile (.zshrc, .bashrc)
export AUTH_TOKEN="your-auth-token-from-env-file"

# Then reference in config with ${env:AUTH_TOKEN}
```

**Authentication:**
- Uses `Authorization` header with Bearer token
- Environment variables are expanded from your shell environment
- CLI method (`--env`) or direct JSON both supported

---

### 2. Cursor

**Configuration Locations:**
- **Global**: `~/.cursor/mcp.json`
- **Project**: `.cursor/mcp.json` (in project root)

**Configuration Format:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_TOKEN"
      }
    }
  }
}
```

**Alternative (with command/args for stdio):**

```json
{
  "mcpServers": {
    "local-server": {
      "command": "node",
      "args": ["/path/to/local/server.js"],
      "env": {
        "AUTH_TOKEN": "your-token"
      }
    }
  }
}
```

**Special Notes for Cursor:**
- Supports OAuth flow for some MCP servers (automatic via UI)
- Supports environment variable substitution: `${env:VAR_NAME}`
- Can add servers via **Settings → Tools & MCP → Add MCP Server**
- **Important**: Use `~/.cursor/mcp.json` for global, NOT `~/.cursor/config/mcp.json`

**Example with environment variable:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AUTH_TOKEN}"
      }
    }
}
```

---

### 3. VS Code with GitHub Copilot

**Configuration Locations:**
- **Workspace**: `.vscode/mcp.json` (project-specific, recommended for teams)
- **User settings**: Via VS Code settings UI (no direct file access)
- **Dev Container**: `devcontainer.json` → `customizations.vscode.mcp`

**Configuration Format:**

```json
{
  "servers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${input:auth-token}"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "auth-token",
      "description": "OpenRouter Image MCP Auth Token",
      "password": true
    }
  ]
}
```

**Adding via VS Code UI:**
1. Open **Extensions** view (Ctrl+Shift+X)
2. Search for `@mcp` to see MCP server gallery
3. Right-click server → **Install in Workspace**
4. VS Code creates/updates `.vscode/mcp.json`

**Input Variables (for sensitive data):**
- VS Code uses `${input:variable-id}` syntax for prompts
- When server starts, VS Code prompts for the value
- Value is securely stored for subsequent use

**Supported Transports:**
| Transport | Type Field | Use Case |
|-----------|------------|-----------|
| HTTP | `"http"` or omitted | Remote servers (recommended for openrouter-image) |
| SSE | `"sse"` | Legacy server-sent events |
| Stdio | `"stdio"` | Local command-line servers |

**Example with static token (not recommended):**

```json
{
  "servers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer your-static-token-here"
      }
    }
  }
}
```

---

### 4. Windsurf

**Configuration Location:**
- Configured via **Cascade** (Windsurf's UI)
- Access via: **Settings icon → Windsurf Settings**
- Then: **Open MCP Marketplace** → **Installed MCPs** → **Settings** icon
- Opens `mcp.config.json`

**Configuration Format:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_TOKEN"
      }
    }
  }
}
```

**Special Notes:**
- Windsurf uses Cascade for MCP management
- Configuration file opened via UI, not direct file editing
- Supports multiple transport types

---

### 5. Cline (formerly Claude Dev)

**Configuration Method:**
- Primary configuration via **MCP Marketplace UI**
- No direct config file editing recommended
- Access via **Extensions → MCP Marketplace**

**Configuration via UI:**
1. Click **Extensions** button (square icon) in top toolbar
2. MCP Marketplace opens
3. Browse servers by category
4. Click **Install** on desired server
5. Follow authentication prompts if needed

**HTTP Server Configuration:**
- For custom HTTP servers like openrouter-image, add manually via Cline's MCP settings
- Cline supports the standard MCP JSON-RPC format over HTTP

**Limitations:**
- Less transparent about exact config file location
- UI-driven configuration is primary method
- May require testing to confirm HTTP MCP server compatibility

---

### 6. Continue

**Configuration Locations:**
- **User**: `~/.continue/config.json` or user settings
- **Project**: `.continue/mcp.json`

**Configuration Format:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_TOKEN"
      }
    }
  }
}
```

**Special Notes:**
- MCP configuration in `mcpServers` section
- Continue uses MCP in **agent mode** only
- Tools must be explicitly enabled in tool picker

**Usage:**
- Add server to config
- Restart Continue
- Open tool picker in Chat view
- Select MCP tools to enable
- Tools automatically invoked based on descriptions

---

### 7. Roo Code

**Configuration Locations:**
- **Global**: `~/.roo/mcp_settings.json`
- **Project**: `.roo/mcp.json` (in project root)

**Configuration Format:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_TOKEN"
      }
    }
  }
}
```

**Adding via CLI:**

```bash
roo mcp add openrouter-image \
  --type http \
  --url http://localhost:3003/mcp \
  --header "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Special Notes:**
- Two configuration levels: global and project-level
- Project-level (`.roo/mcp.json`) overrides global if conflicting
- Supports multiple transport types: stdio, HTTP, SSE
- Comprehensive documentation at [docs.roocode.com](https://docs.roocode.com)

---

### 8. JetBrains IDEs

**Supported IDEs:**
- IntelliJ IDEA
- PyCharm
- WebStorm
- GoLand
- Rider
- And other JetBrains IDEs with AI Assistant

**Configuration Location:**
- Project-specific: `.idea/mcp.json` or via AI Assistant settings

**Configuration Format:**

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_TOKEN"
      }
    }
  }
}
```

**Adding via JetBrains AI Assistant:**
1. Open **Settings → Tools → AI Assistant**
2. Navigate to **MCP Servers** section
3. Add server configuration
4. Supports both stdio and HTTP transports

**Supported Transports:**
- **stdio**: For local MCP servers
- **Streamable HTTP**: For HTTP-based servers (recommended for openrouter-image)
- **SSE**: Legacy server-sent events support

---

## Configuration Format Comparison

### HTTP Server Configuration (Recommended for openrouter-image)

**Claude Code, Cursor, JetBrains, Roo, Windsurf:**
```json
{
  "mcpServers": {
    "server-name": {
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer TOKEN"
      }
    }
  }
}
```

**VS Code:**
```json
{
  "servers": {
    "server-name": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer TOKEN"
      }
    }
  }
}
```

**Key Differences:**
1. **Top-level key**: `mcpServers` vs `servers`
2. **Type field**: Most tools don't require `type: "http"` for HTTP (it's the default), but VS Code requires explicit type
3. **Headers format**: Generally consistent across tools

### Stdio Server Configuration (For local servers)

**Most tools:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "value"
      }
    }
  }
}
```

---

## Authentication Methods

### 1. Bearer Token (Recommended for openrouter-image)

**Format:**
```json
{
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"
  }
}
```

**Supported by:**
- All tools documented
- Most common for HTTP MCP servers
- Simple and widely supported

**Security Notes:**
- Don't hardcode tokens in version-controlled config files
- Use environment variables where possible
- Use input variables (VS Code) for prompts

### 2. Environment Variables

**Claude Code:**
```json
{
  "headers": {
    "Authorization": "Bearer ${env:AUTH_TOKEN}"
  }
}
```

**Cursor:**
```json
{
  "headers": {
    "Authorization": "Bearer ${env:AUTH_TOKEN}"
  }
}
```

**VS Code (via input variables):**
```json
{
  "inputs": [
    {
      "id": "auth-token",
      "type": "promptString",
      "description": "Auth Token",
      "password": true
    }
  ],
  "servers": {
    "server-name": {
      "headers": {
        "Authorization": "Bearer ${input:auth-token}"
      }
    }
  }
}
```

### 3. OAuth 2.0

**Not applicable to openrouter-image**, but supported by some tools:**
- Cursor: Built-in OAuth support for some MCP servers
- VS Code: Supports OAuth via MCP auth spec
- Windsurf: OAuth support for compatible servers

**OAuth Configuration Example (for reference):**
```json
{
  "mcpServers": {
    "oauth-service": {
      "url": "https://api.example.com/mcp",
      "auth": {
        "CLIENT_ID": "${env:OAUTH_CLIENT_ID}",
        "CLIENT_SECRET": "${env:OAUTH_CLIENT_SECRET}",
        "scopes": ["read", "write"]
      }
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Server Not Starting

**Symptoms:**
- No green indicator in MCP settings
- Tools not appearing in tool list
- Connection errors

**Solutions:**
- Verify config file is in correct location (see [Quick Reference](#quick-reference))
- Restart IDE completely after editing config
- Check for JSON syntax errors
- Verify server is running: `curl http://localhost:3003/health`
- Check IDE logs (Output panel) for error messages

#### 2. Authentication Failures (401 Unauthorized)

**Symptoms:**
- HTTP 401 errors
- "Auth: not authenticated" message
- Tools appear but fail when called

**Solutions:**
- Verify `AUTH_TOKEN` environment variable is set
- Check token matches server's expected value
- Verify `Authorization` header format: `Bearer TOKEN` (note the space after "Bearer")
- Test with curl: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/mcp`

**Test command:**
```bash
# Test MCP server directly
curl -X POST http://localhost:3003/mcp \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/list"
  }'
```

#### 3. Tools Not Appearing

**Symptoms:**
- Server shows as connected
- No tools available in tool picker
- `/mcp` command shows server but "no tools"

**Solutions:**
- Clear cached tools: Use tool's "Reset Cached Tools" command
- Restart IDE
- Check server logs for errors during tool discovery
- Verify MCP server implements `tools/list` correctly
- Test with MCP Inspector: `npx @modelcontextprotocol/inspector http://localhost:3003/mcp`

#### 4. Wrong Config File Location

**Symptoms:**
- Configuration changes have no effect
- No error messages
- Server appears in other tools but not this one

**Solutions:**
- Verify you're editing the correct file for the tool (see [Quick Reference](#quick-reference))
- For Claude Code: Use `~/.claude.json`, NOT `~/.claude/settings.json`
- For Cursor: Use `~/.cursor/mcp.json`, NOT `~/.cursor/config/mcp.json`
- Check tool-specific documentation for exact location

---

## Summary Checklist

**For each tool you want to configure:**

1. [ ] Identify correct config file location (see Quick Reference table)
2. [ ] Determine if using user/global or project scope
3. [ ] Choose HTTP configuration (recommended for this server)
4. [ ] Set `AUTH_TOKEN` environment variable on your system
5. [ ] Add server configuration with Bearer token auth
6. [ ] Restart the IDE completely
7. [ ] Verify server appears in MCP settings with green indicator
8. [ ] Test with `/mcp` command or tool picker
9. [ ] Call `list_image_models` tool to verify functionality
10. [ ] Call `generate_image` tool to test full workflow

---

## Additional Resources

- **MCP Specification**: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- **MCP Servers Repository**: [https://github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- **MCP Inspector**: `npx @modelcontextprotocol/inspector http://localhost:3003/mcp`
- **VS Code MCP Docs**: [https://code.visualstudio.com/docs/copilot/customization/mcp-servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- **Cursor MCP Docs**: [https://cursor.com/docs/context/mcp](https://cursor.com/docs/context/mcp)
- **Claude Code MCP Docs**: [https://code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)
- **Roo Code MCP Docs**: [https://docs.roocode.com/features/mcp/overview](https://docs.roocode.com/features/mcp/overview)
- **JetBrains MCP Docs**: [https://www.jetbrains.com/help/ai-assistant/mcp.html](https://www.jetbrains.com/help/ai-assistant/mcp.html)

---

## Example: Full Config for Multiple Tools

**Scenario**: You want to use openrouter-image in Claude Code, Cursor, and VS Code

**Claude Code** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${AUTH_TOKEN}"
      }
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "openrouter-image": {
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AUTH_TOKEN}"
      }
    }
  }
}
```

**VS Code** (`.vscode/mcp.json` in project root):
```json
{
  "servers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${input:auth-token}"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "auth-token",
      "description": "OpenRouter Image MCP Auth Token",
      "password": true
    }
  ]
}
```

**Environment setup** (in your `~/.zshrc` or `~/.bashrc`):
```bash
export AUTH_TOKEN="your-auth-token-here"
```

---

**Last Updated**: 2026-02-13

**For issues or questions**, refer to tool-specific documentation links above or check server logs in: `/home/erosales/proyectos/openrouter-image/output/`
