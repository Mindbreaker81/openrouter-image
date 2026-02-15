# openrouter-image-mcp

Servidor MCP (HTTP) + CLI para generar, editar, listar y leer imágenes usando los modelos de imagen de [OpenRouter](https://openrouter.ai) (Responses API).

Ambos interfaces (MCP y CLI) comparten un **núcleo común** (`src/core.js`) y ofrecen exactamente las mismas capacidades:

| Capacidad | MCP tool | CLI command |
|---|---|---|
| Generar imagen desde prompt | `generate_image` | `generate` |
| Editar imagen existente (img2img) | `edit_image` | `edit` |
| Listar modelos con precios | `list_image_models` | `models` |
| Listar imágenes guardadas | `list_output_images` | `list` |
| Leer / recuperar imagen | `read_output_image` | `read` |

---

## Tabla de contenidos

- [Requisitos](#requisitos)
- [Instalación](#instalación)
  - [Clonar e instalar](#clonar-e-instalar)
  - [Instalar la CLI globalmente](#instalar-la-cli-globalmente)
  - [Instalar desde tarball (npm pack)](#instalar-desde-tarball-npm-pack)
- [Variables de entorno](#variables-de-entorno)
- [Servidor MCP (HTTP)](#servidor-mcp-http)
  - [Ejecutar con Docker Compose](#ejecutar-con-docker-compose)
  - [Ejecutar con Docker standalone](#ejecutar-con-docker-standalone)
  - [Ejecutar con Node.js](#ejecutar-con-nodejs)
  - [Endpoints](#endpoints)
  - [Verificación](#verificación)
- [CLI](#cli)
  - [Usar la CLI](#usar-la-cli)
  - [Comandos CLI](#comandos-cli)
  - [Ejecutar con Docker (CLI)](#ejecutar-con-docker-cli)
- [MCP Tools — Referencia](#mcp-tools--referencia)
  - [generate_image](#generate_image)
  - [edit_image](#edit_image)
  - [list_image_models](#list_image_models)
  - [list_output_images](#list_output_images)
  - [read_output_image](#read_output_image)
- [Configuración en herramientas de coding](#configuración-en-herramientas-de-coding)
- [Ejemplos curl (MCP JSON-RPC)](#ejemplos-curl-mcp-json-rpc)
- [Tests](#tests)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Seguridad](#seguridad)

---

## Requisitos

- **Node.js >= 20** (usa ES modules y `node:test`)
- **npm** (incluido con Node.js)
- Una **API key de OpenRouter** (`OPENROUTER_API_KEY`)

---

## Instalación

### Clonar e instalar

```bash
git clone https://github.com/YOUR_USER/openrouter-image-mcp.git
cd openrouter-image-mcp
npm ci
```

### Instalar la CLI globalmente

```bash
# Desde el directorio del repo
npm link

# Ahora puedes usar el comando en cualquier lugar:
openrouter-image --help
```

### Instalar desde tarball (npm pack)

```bash
# Generar el paquete
npm pack
# → openrouter-image-mcp-0.3.0.tgz

# Instalar globalmente en este u otro servidor
npm install -g openrouter-image-mcp-0.3.0.tgz

# Verificar
openrouter-image --help
```

---

## Variables de entorno

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
| `OPENROUTER_APP_NAME` | no | `openrouter-image-mcp` | Header `X-Title` enviado a OpenRouter |

> **Nota**: `AUTH_TOKEN` solo lo usa el servidor MCP. La CLI solo necesita `OPENROUTER_API_KEY` y opcionalmente `OUTPUT_DIR`.

---

## Servidor MCP (HTTP)

El servidor expone un endpoint MCP JSON-RPC sobre HTTP con autenticación Bearer.

### Ejecutar con Docker Compose

```bash
cp .env.example .env
# Editar .env: AUTH_TOKEN, OPENROUTER_API_KEY, OPENROUTER_IMAGE_MODEL

docker compose up -d --build

# Health check
curl http://localhost:3003/health
```

Las imágenes guardadas quedan en `./output/` (montado como `/data` en el contenedor).

### Ejecutar con Docker standalone

```bash
docker build -t openrouter-image-mcp .

docker run -d --name openrouter-image-mcp \
  -p 3003:3000 \
  -e AUTH_TOKEN=mi-token-secreto \
  -e OPENROUTER_API_KEY=sk-or-... \
  -e OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image \
  -v $(pwd)/output:/data \
  openrouter-image-mcp
```

### Ejecutar con Node.js

```bash
# Cargar variables de entorno
set -a && . ./.env && set +a

# Iniciar
npm start
# o directamente:
node src/server.js
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck → `{ "status": "ok" }` |
| `POST` | `/mcp` | MCP JSON-RPC (requiere `Authorization: Bearer <AUTH_TOKEN>`) |

### Verificación

```bash
# Health
curl http://localhost:3003/health

# Listar tools MCP
curl -X POST http://localhost:3003/mcp \
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

### Ejecutar con Docker (CLI)

Se incluye un `Dockerfile.cli` dedicado (separado del `Dockerfile` del MCP):

```bash
# Construir imagen CLI
docker build -f Dockerfile.cli -t openrouter-image-cli .

# Listar modelos
docker run --rm \
  -e OPENROUTER_API_KEY=sk-or-... \
  openrouter-image-cli models

# Generar imagen con volumen montado
docker run --rm \
  -e OPENROUTER_API_KEY=sk-or-... \
  -v $(pwd)/output:/data \
  openrouter-image-cli generate "A mountain landscape at sunset" \
    -m google/gemini-2.5-flash-image \
    -o tests/landscape.png

# Listar imágenes guardadas
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

## Configuración en herramientas de coding

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
    "openrouter-image-mcp": {
      "url": "http://localhost:3003/mcp",
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
    "openrouter-image-mcp": {
      "url": "http://localhost:3003/mcp",
      "headers": {
        "Authorization": "Bearer ${env:AUTH_TOKEN}"
      }
    }
  }
}
```

### Ejemplo: Claude Code

**Opción 1: CLI**
```bash
claude mcp add --transport http openrouter-image-mcp \
  http://localhost:3003/mcp \
  --env AUTH_TOKEN="tu-token-aqui"
```

**Opción 2: Archivo `~/.claude.json`**
```json
{
  "mcpServers": {
    "openrouter-image-mcp": {
      "type": "http",
      "url": "http://localhost:3003/mcp",
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
    "openrouter-image-mcp": {
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

> ⚠️ VS Code usa `"servers"` (no `"mcpServers"`) y requiere `"type": "http"` explícito.

### Uso con Tailscale / red remota

Si ejecutas el MCP server en una máquina remota (ej. vía Tailscale):

```json
{
  "mcpServers": {
    "openrouter-image-mcp": {
      "url": "http://100.82.111.22:3003/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```


**Para más detalles**, consulta la guía completa en `MCP_CLIENT_CONFIG_GUIDE.md` con instrucciones específicas para cada herramienta, troubleshooting y métodos de autenticación.

---

## Ejemplos curl (MCP JSON-RPC)

Carga primero las variables de entorno:

```bash
set -a && . ./.env && set +a
```

### Generar imagen y guardar (sin base64 en respuesta)

```bash
curl -fsS http://localhost:3003/mcp \
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
curl -fsS http://localhost:3003/mcp \
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
curl -fsS http://localhost:3003/mcp \
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
curl -fsS http://localhost:3003/mcp \
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

## Estructura del proyecto

```
openrouter-image-mcp/
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

## Seguridad

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

## Licencia

Ver `LICENSE` si existe, o consultar `package.json`.
