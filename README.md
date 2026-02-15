<!-- markdownlint-disable MD024 MD031 MD032 MD040 MD051 MD060 -->

# openrouter-image

[![npm version](https://badge.fury.io/js/%40mindbreaker81%2Fopenrouter-image.svg)](https://www.npmjs.com/package/@mindbreaker81/openrouter-image)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-10%2F10-brightgreen)](tests/cli.test.js)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![GitHub Release](https://img.shields.io/github/v/release/Mindbreaker81/openrouter-image?label=github%20release)](https://github.com/Mindbreaker81/openrouter-image/releases/latest)

**A dual-interface MCP server and CLI for image generation/editing via OpenRouter's Responses API.**

This package can be used in multiple ways:
- **📚 As a Library** - Programmatic API for Node.js applications
- **🖥️ As a CLI** - Command-line interface for automation and scripting
- **🔌 As an MCP Server** - For Claude Code, Cursor, and other MCP-compatible tools
- **🤖 As a Claude Code Skill** - Native integration with Claude Code

All interfaces share a **common core** (`src/core.js`) and offer identical capabilities.

| Capacidad | MCP tool | CLI command |
|---|---|---|
| Generar imagen desde prompt | `generate_image` | `generate` |
| Editar imagen existente (img2img) | `edit_image` | `edit` |
| Listar modelos con precios | `list_image_models` | `models` |
| Listar imágenes guardadas | `list_output_images` | `list` |
| Leer / recuperar imagen | `read_output_image` | `read` |

---

## Table of Contents

- [Usage Modes](#usage-modes)
  - [Publishing](PUBLISHING.md)
  - [As a Library](#as-a-library)
  - [As a CLI](#as-a-cli)
  - [As an MCP Server](#as-an-mcp-server)
  - [As a Claude Code Skill](#as-a-claude-code-skill)
- [Installation](#installation)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [MCP Server (HTTP)](#mcp-server-http)
  - [Puerto del servidor y conflictos](#puerto-del-servidor-y-conflictos)
- [CLI](#cli)
- [MCP Tools — Reference](#mcp-tools--reference)
- [Configuration in Coding Tools](#configuration-in-coding-tools)
- [Curl Examples (MCP JSON-RPC)](#curl-examples-mcp-json-rpc)
- [Tests](#tests)
- [Project Structure](#project-structure)
- [Security](#security)
- [License](#license)

---

## Usage Modes

### As a Library

Use the `OpenRouterImageClient` class in your Node.js applications:

```javascript
import { OpenRouterImageClient } from '@mindbreaker81/openrouter-image';

const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultModel: 'google/gemini-2.5-flash-image'
});

// Generate an image
const result = await client.generateImage('A sunset over mountains', {
  outputPath: 'sunset.png'
});

console.log(`Image saved to: ${result.savedPath}`);
```

**Documentation:** See [LIBRARY.md](LIBRARY.md) for full API reference and examples.

### As a CLI

Install globally and use from the command line:

```bash
npm install -g @mindbreaker81/openrouter-image

# Generate an image
openrouter-image generate "A futuristic city" -o city.png

# Edit an image
openrouter-image edit "Make it rainy" -i city.png -o rainy-city.png

# List available models
openrouter-image models

# List saved images
openrouter-image list
```

**See below for [CLI documentation](#cli).**

### As an MCP Server

Run as an HTTP or stdio MCP server for integration with AI coding tools:

```bash
# HTTP mode (default port 3000)
openrouter-image server

# Stdio mode (for Claude Code)
openrouter-image server --stdio
```

**See below for [MCP Server documentation](#mcp-server-http).**

### As a Claude Code Skill

Install and configure as a native Claude Code skill:

```bash
npm install -g @mindbreaker81/openrouter-image
./scripts/install-claude.sh
```

Then use directly in Claude Code:
- "Generate an image of a sunset"
- "Edit diagram.png to add a database"
- "Show me all available models"

**Documentation:** See [CLAUDE_SKILL.md](CLAUDE_SKILL.md) for detailed setup instructions.

---

## Requirements

- **Node.js >= 20** (uses ES modules and `node:test`)
- **npm** (included with Node.js)
- An **OpenRouter API key** ([Get one here](https://openrouter.ai/keys))

---

## Installation

### Install from npm

```bash
npm install -g @mindbreaker81/openrouter-image
```

### Install from git

```bash
git clone https://github.com/mindbreaker81/openrouter-image.git
cd openrouter-image
npm install
npm link
```

### Install from tarball

```bash
npm pack
npm install -g mindbreaker81-openrouter-image-*.tgz
```

### Install as a library dependency

```bash
npm install @mindbreaker81/openrouter-image
```

---

## Environment Variables

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Requerida | Default | Descripción |
|---|:---:|---|---|
| `OPENROUTER_API_KEY` | **sí** | — | API key de OpenRouter |
| `AUTH_TOKEN` | **sí** (MCP) | — | Token Bearer para el endpoint MCP |
| `OPENROUTER_IMAGE_MODEL` | recomendada | — | Modelo por defecto si no se pasa `model` en cada llamada |
| `OUTPUT_DIR` | no | `/data` | Directorio donde se guardan las imágenes |
| `PORT` | no | `3000` | Puerto del servidor HTTP (MCP) |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` | Base URL de la API de OpenRouter |
| `OPENROUTER_SITE_URL` | no | — | Header `HTTP-Referer` enviado a OpenRouter |
| `OPENROUTER_APP_NAME` | no | `openrouter-image` | Header `X-Title` enviado a OpenRouter |

> **Nota**: `AUTH_TOKEN` solo lo usa el servidor MCP. La CLI solo necesita `OPENROUTER_API_KEY` y opcionalmente `OUTPUT_DIR`.

---

## MCP Server (HTTP)

El servidor expone un endpoint MCP JSON-RPC sobre HTTP con autenticación Bearer.

### Puerto del servidor y conflictos

Por defecto el servidor usa el puerto **3000**. Comprueba que ese puerto no esté ya en uso en tu máquina antes de arrancar.

**Comprobar si el puerto está libre:**

- **Linux / macOS:** `lsof -i :3000` o `ss -tlnp | grep 3000`. Si hay salida, el puerto está ocupado.
- **Windows:** `netstat -ano | findstr :3000`. Si aparece una línea con el puerto, está ocupado.

**Cómo cambiar el puerto si está ocupado:**

- **Con Node.js:** define la variable de entorno al arrancar, por ejemplo `PORT=3001 npm start`, o usa la CLI: `openrouter-image server --port 3001`.
- **Con Docker:** en `docker-compose.yml` cambia el mapeo de puertos (ej. `"3001:3000"`). El primer número es el puerto en tu PC; el segundo es el interno del contenedor. Para `docker run`, usa por ejemplo `-p 3001:3000`.
- Si cambias el puerto, actualiza la URL en la configuración MCP de tu cliente (Cursor, Claude Code, etc.): por ejemplo `http://localhost:3001/mcp` en lugar de `http://localhost:3000/mcp`.

### Run with Docker Compose

```bash
cp .env.example .env
# Edit .env: AUTH_TOKEN, OPENROUTER_API_KEY, OPENROUTER_IMAGE_MODEL

docker compose up -d --build

# Health check
curl http://localhost:3000/health
```

Saved images will be in `./output/` (mounted as `/data` in the container).

### Run with Docker standalone

```bash
docker build -t openrouter-image .

docker run -d --name openrouter-image \
  -p 3000:3000 \
  -e AUTH_TOKEN=mi-token-secreto \
  -e OPENROUTER_API_KEY=sk-or-... \
  -e OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image \
  -v $(pwd)/output:/data \
  openrouter-image
```

### Run with Node.js (HTTP mode)

```bash
# Load environment variables
set -a && . ./.env && set +a

# Start server
npm start
# or:
node src/server.js

# Or via CLI
openrouter-image server --port 3000
```

### Run with Node.js (stdio mode)

```bash
openrouter-image server --stdio
```

Or directly:

```bash
node src/server.js --stdio
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck → `{ "status": "ok" }` |
| `POST` | `/mcp` | MCP JSON-RPC (requiere `Authorization: Bearer <AUTH_TOKEN>`) |

### Verificación

```bash
# Health
curl http://localhost:3000/health

# Listar tools MCP
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## CLI

### Usar la CLI

```bash
# Con npm run (desde el repo)
npm run cli -- <command> [options]

# Si se instaló globalmente (npm link / npm install -g)
openrouter-image <command> [options]

# Con node directamente
node src/cli.js <command> [options]
```

> Recuerda definir `OPENROUTER_API_KEY` y opcionalmente `OUTPUT_DIR` (default `/data`).
> Para usar un directorio local: `OUTPUT_DIR=./output openrouter-image ...`

### Comandos CLI

#### `models` — Listar modelos de imagen disponibles

```bash
openrouter-image models
```

Imprime una tabla Markdown con id, nombre, proveedor, coste estimado por imagen y notas.

#### `generate <prompt>` — Generar una imagen

```bash
openrouter-image generate "A cinematic cyberpunk street at night" \
  -m google/gemini-2.5-flash-image \
  -o tests/cyberpunk.png
```

| Flag | Alias | Descripción |
|---|---|---|
| `--model` | `-m` | Model id de OpenRouter (o usar `OPENROUTER_IMAGE_MODEL`) |
| `--output` | `-o` | Ruta relativa bajo `OUTPUT_DIR` |
| `--config` | `-c` | JSON string con `image_config` para OpenRouter |
| `--no-base64` | — | No imprimir tamaño base64 en el resumen |

Salida ejemplo:
```
tool: generate_image
model: google/gemini-2.5-flash-image
output_path: tests/cyberpunk.png
saved_to: /home/user/project/output/tests/cyberpunk.png
mime_type: image/png
bytes: 909527
base64_length: 1212704
```

> Si la extensión del archivo no coincide con el tipo MIME real detectado (PNG/JPEG/GIF/WEBP), la CLI corrige la extensión automáticamente.

#### `edit <prompt>` — Editar una imagen existente (img2img)

```bash
openrouter-image edit "make it rainy and dark" \
  -i tests/cyberpunk.png \
  -o tests/cyberpunk-rain.png \
  -m openai/gpt-5-image-mini
```

| Flag | Alias | Descripción |
|---|---|---|
| `--input` | `-i` | (requerido) Ruta relativa de la imagen de entrada bajo `OUTPUT_DIR` |
| `--model` | `-m` | Model id |
| `--output` | `-o` | Ruta relativa de salida |

#### `list` — Listar imágenes guardadas

```bash
openrouter-image list --prefix tests --limit 20 --sort mtime_desc
```

| Flag | Alias | Descripción |
|---|---|---|
| `--prefix` | — | Subcarpeta relativa bajo `OUTPUT_DIR` |
| `--recursive` | `-r` | Recursivo (default: `true`) |
| `--limit` | `-l` | Máximo de resultados (default: `200`) |
| `--sort` | `-s` | `mtime_desc`, `mtime_asc`, `size_desc`, `size_asc`, `name_asc`, `name_desc` |

#### `read <path>` — Leer metadatos de una imagen

```bash
openrouter-image read tests/cyberpunk.png
openrouter-image read tests/cyberpunk.png --copy-to /tmp/local-copy.png
```

| Flag | Descripción |
|---|---|
| `--mime-type` | Sobreescribir el MIME type en la salida |
| `--copy-to` | Escribir una copia en cualquier ruta local |

### Run with Docker (CLI)

A dedicated `Dockerfile.cli` is included (separate from the MCP server `Dockerfile`):

```bash
# Build CLI image
docker build -f Dockerfile.cli -t openrouter-image-cli .

# List models
docker run --rm \
  -e OPENROUTER_API_KEY=sk-or-... \
  openrouter-image-cli models

# Generate image with mounted volume
docker run --rm \
  -e OPENROUTER_API_KEY=sk-or-... \
  -v $(pwd)/output:/data \
  openrouter-image-cli generate "A mountain landscape at sunset" \
    -m google/gemini-2.5-flash-image \
    -o tests/landscape.png

# List saved images
docker run --rm \
  -v $(pwd)/output:/data \
  openrouter-image-cli list
```

---

## MCP Tools — Referencia

### generate_image

Genera una imagen desde un prompt usando OpenRouter (Responses API).

| Parámetro | Tipo | Requerido | Descripción |
|---|---|:---:|---|
| `prompt` | string | **sí** | Prompt de texto para generar la imagen |
| `model` | string | no | Model id de OpenRouter (default: `OPENROUTER_IMAGE_MODEL`) |
| `image_config` | object | no | Configuración específica del proveedor (pass-through a OpenRouter) |
| `output_path` | string | no | Ruta relativa bajo `OUTPUT_DIR` para guardar la imagen |
| `mime_type` | string | no | MIME type para la respuesta MCP (default: detección automática) |
| `return_base64` | boolean | no | Si `false`, no incluye base64 en la respuesta (default: `true`) |

**Notas:**
- Si `output_path` tiene extensión incorrecta para el MIME real, se corrige automáticamente.
- Usar `return_base64: false` con `output_path` evita respuestas JSON enormes.

### edit_image

Edita / transforma una imagen existente bajo `OUTPUT_DIR` (image-to-image via Responses API).

| Parámetro | Tipo | Requerido | Descripción |
|---|---|:---:|---|
| `prompt` | string | **sí** | Instrucción de edición |
| `input_image_path` | string | **sí** | Ruta relativa de la imagen de entrada bajo `OUTPUT_DIR` |
| `model` | string | no | Model id de OpenRouter |
| `image_config` | object | no | Configuración específica del proveedor |
| `output_path` | string | no | Ruta relativa de salida bajo `OUTPUT_DIR` |
| `mime_type` | string | no | MIME type override |
| `return_base64` | boolean | no | Default: `true` |

### list_image_models

Lista los modelos de imagen disponibles en OpenRouter con precios actualizados.

- **Parámetros:** ninguno
- **No requiere** `OPENROUTER_API_KEY` (usa la API pública de OpenRouter)
- **Salida:** tabla Markdown con `id`, `name`, `provider`, `image_output`, `coste/imagen aprox.`, `notas`
- Los modelos se ordenan de menor a mayor coste estimado

### list_output_images

Lista las imágenes guardadas bajo `OUTPUT_DIR`.

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `prefix` | string | `""` | Subcarpeta relativa |
| `recursive` | boolean | `true` | Buscar recursivamente |
| `limit` | integer | `200` | Máx. resultados (1–1000) |
| `sort` | string | `mtime_desc` | Orden: `mtime_desc`, `mtime_asc`, `size_desc`, `size_asc`, `name_asc`, `name_desc` |
| `include_non_images` | boolean | `false` | Incluir archivos que no sean imágenes |

### read_output_image

Lee una imagen de disco y la devuelve como contenido MCP `type: image`.

| Parámetro | Tipo | Requerido | Descripción |
|---|---|:---:|---|
| `path` | string | **sí** | Ruta relativa bajo `OUTPUT_DIR` |
| `mime_type` | string | no | Override MIME type |
| `return_base64` | boolean | no | Default: `true`; si `false`, solo devuelve metadatos |

---

## Configuration in Coding Tools

Este servidor MCP es compatible con múltiples herramientas de desarrollo asistido por IA.

**Guía completa**: Ver `MCP_CLIENT_CONFIG_GUIDE.md` para documentación detallada, troubleshooting y métodos de autenticación.

### Resumen rápido

| Herramienta | Archivo de configuración | Top-level key |
|---|---|---|
| **Claude Code** | `~/.claude.json` o `.mcp.json` | `mcpServers` |
| **Cursor** | `~/.cursor/mcp.json` o `.cursor/mcp.json` | `mcpServers` |
| **VS Code + GitHub Copilot** | `.vscode/mcp.json` | `servers` ⚠️ |
| **Windsurf** | `mcp.config.json` (vía UI Cascade) | `mcpServers` |
| **Continue** | `~/.continue/config.json` o `.continue/mcp.json` | `mcpServers` |
| **Roo Code** | `~/.roo/mcp_settings.json` o `.roo/mcp.json` | `mcpServers` |
| **JetBrains IDEs** | `.idea/mcp.json` | `mcpServers` |
| **Cline** | Vía UI MCP Marketplace | — |

### Configuración genérica (formato MCP estándar)

```jsonc
{
  "mcpServers": {  // o "servers" para VS Code
    "openrouter-image": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer TU_AUTH_TOKEN"
      }
    }
  }
}
```

### Ejemplo: Cursor

En `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "openrouter-image": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AUTH_TOKEN}"
      }
    }
  }
}
```

### Ejemplo: Claude Code

#### Opción 1: CLI

```bash
claude mcp add --transport http openrouter-image \
  http://localhost:3000/mcp \
  --env AUTH_TOKEN="tu-token-aqui"
```

#### Opción 2: Archivo `~/.claude.json`

```json
{
  "mcpServers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AUTH_TOKEN}"
      }
    }
  }
}
```

### Ejemplo: VS Code con GitHub Copilot

En `.vscode/mcp.json` (raíz del proyecto):

```json
{
  "servers": {
    "openrouter-image": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
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

> ⚠️ VS Code usa `"servers"` (no `"mcpServers"`) y requiere `"type": "http"` explícito.

### Uso con Tailscale / red remota

Si ejecutas el MCP server en una máquina remota (ej. vía Tailscale):

```json
{
  "mcpServers": {
    "openrouter-image": {
      "url": "http://100.82.111.22:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```


**Para más detalles**, consulta la guía completa en `MCP_CLIENT_CONFIG_GUIDE.md` con instrucciones específicas para cada herramienta, troubleshooting y métodos de autenticación.

---

## Curl Examples (MCP JSON-RPC)

Carga primero las variables de entorno:

```bash
set -a && . ./.env && set +a
```

### Generar imagen y guardar (sin base64 en respuesta)

```bash
curl -fsS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{
      "name":"generate_image",
      "arguments":{
        "model":"black-forest-labs/flux.2-klein-4b",
        "prompt":"A clean vector-style icon of a home server rack on a desk, minimal, white background, crisp lines.",
        "output_path":"tests/flux.2-klein-4b.png",
        "return_base64":false
      }
    }
  }'
```

### Editar imagen existente

```bash
curl -fsS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"edit_image",
      "arguments":{
        "model":"openai/gpt-5-image-mini",
        "prompt":"Turn this into a clean flat illustration style, keep composition, white background.",
        "input_image_path":"tests/flux.2-klein-4b.png",
        "output_path":"tests/edited.png",
        "return_base64":false
      }
    }
  }'
```

### Listar imágenes guardadas

```bash
curl -fsS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"list_output_images",
      "arguments":{ "prefix":"tests/", "limit":50, "sort":"mtime_desc" }
    }
  }'
```

### Recuperar una imagen guardada

```bash
curl -fsS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"tools/call",
    "params":{
      "name":"read_output_image",
      "arguments":{ "path":"tests/flux.2-klein-4b.png" }
    }
  }'
```

---

## Tests

El proyecto incluye una suite de tests usando `node:test` (Node.js built-in test runner).

```bash
npm test
```

Los tests cubren:
- **Validación de argumentos CLI**: ayuda, comandos desconocidos, prompt/modelo faltante, edit sin input, limit inválido, read sin path.
- **Integración con mock HTTP**: servidor local que simula los endpoints de OpenRouter (`/responses` y `/models/find`), verificando los flujos `generate`, `edit` y `models` de extremo a extremo, incluyendo la corrección automática de extensión de archivo.

---

## Project Structure

```
openrouter-image/
├── src/
│   ├── core.js          # Lógica compartida (API calls, file handling, models)
│   ├── server.js        # Servidor MCP HTTP (Express, JSON-RPC)
│   └── cli.js           # CLI (parseArgs, commands)
├── tests/
│   └── cli.test.js      # Suite de tests (node:test)
├── scripts/
│   └── models_clean.js  # Script para generar tabla de modelos filtrada
├── output/              # Directorio de imágenes generadas (montado como /data)
├── Dockerfile           # Imagen Docker para el servidor MCP
├── Dockerfile.cli       # Imagen Docker para la CLI
├── docker-compose.yml   # Docker Compose (MCP server)
├── package.json         # Dependencias, scripts, bin
├── .env.example         # Plantilla de variables de entorno
├── MCP_CLIENT_CONFIG_GUIDE.md  # Guía detallada de configuración para IDEs
├── OPENROUTER_IMAGE_MODELS.md  # Tabla estática de modelos (referencia)
├── CHANGELOG.md         # Historial de cambios
└── README.md            # Este archivo
```

---

## Security

- **Autenticación**: el endpoint `/mcp` requiere `Authorization: Bearer <AUTH_TOKEN>`. Genera un token fuerte: `openssl rand -hex 32`.
- **Path traversal**: `safeJoinOutputDir()` impide que rutas relativas escapen de `OUTPUT_DIR`.
- **Symlinks**: las operaciones de disco rechazan symlinks bajo `OUTPUT_DIR` (previene acceso a archivos fuera del directorio).
- **MIME detection**: si OpenRouter devuelve data URLs (`data:image/png;base64,...`), se extrae el MIME automáticamente. Si no, se detecta por magic bytes (PNG, JPEG, GIF, WEBP).
- **Extensión automática**: si la extensión del archivo no coincide con el MIME detectado, se corrige al guardar.

---

## Modelos con output image y precios

- **Dinámico (MCP/CLI)**: usa la tool `list_image_models` o el comando `openrouter-image models` para obtener el listado actualizado con precios desde la API de OpenRouter.
- **Documento estático**: `OPENROUTER_IMAGE_MODELS.md` contiene una tabla generada periódicamente desde la misma API.

---

## License

MIT - See [LICENSE](LICENSE) file.
