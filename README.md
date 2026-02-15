# openrouter-image-mcp

Servidor MCP (HTTP) que expone herramientas para trabajar con modelos de generación de imagen de OpenRouter:

- **`generate_image`**: genera imágenes con OpenRouter (vía `POST /responses`).
- **`list_image_models`**: lista los modelos de imagen disponibles con precios y coste estimado por imagen (consulta la API de OpenRouter en tiempo real).

Diseñado para usarse desde clientes MCP en IDEs (VS Code/Cursor/etc.) y para guardar la imagen generada en disco (volumen montado).

## Endpoints

- `GET /health` -> `{ "status": "ok" }`
- `POST /mcp` -> MCP JSON-RPC (protegido con `Authorization: Bearer <AUTH_TOKEN>`)

## Variables de entorno

Requeridas:
- `AUTH_TOKEN`: token Bearer para el endpoint MCP.
- `OPENROUTER_API_KEY`: API key de OpenRouter.

Recomendadas:
- `OPENROUTER_IMAGE_MODEL`: modelo por defecto (si no se pasa `model` en el tool call).
  - Si siempre pasas `model` en cada `tools/call`, puedes dejarlo vacío.

Opcionales:
- `OPENROUTER_BASE_URL` (default: `https://openrouter.ai/api/v1`)
- `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`: headers recomendados por OpenRouter.
- `PORT` (default: `3000`): puerto donde escucha el servidor HTTP.
- `OUTPUT_DIR` (default: `/data`): directorio donde se guardan las imágenes (usado con `output_path`).

## Uso con Docker Compose

```bash
cp .env.example .env
# edita .env y rellena AUTH_TOKEN / OPENROUTER_API_KEY / OPENROUTER_IMAGE_MODEL

docker compose up -d --build

Health:
curl http://localhost:3003/health
```

Las imágenes guardadas (si usas `output_path`) quedan en `openrouter-image-mcp/output/` (montado como `/data`).

## Configuración en herramientas de coding

Este servidor MCP es compatible con múltiples herramientas de desarrollo asistido por IA. La configuración varía ligeramente entre herramientas.

**Guía completa**: Ver `MCP_CLIENT_CONFIG_GUIDE.md` para documentación detallada de todas las herramientas.

### Resumen rápido

| Herramienta | Archivo de configuración | Top-level key |
|-------------|------------------------|---------------|
| **Claude Code** | `~/.claude.json` o `.mcp.json` | `mcpServers` |
| **Cursor** | `~/.cursor/mcp.json` o `.cursor/mcp.json` | `mcpServers` |
| **VS Code + GitHub Copilot** | `.vscode/mcp.json` | `servers` ⚠️ |
| **Windsurf** | `mcp.config.json` (vía UI Cascade) | `mcpServers` |
| **Continue** | `~/.continue/config.json` o `.continue/mcp.json` | `mcpServers` |
| **Roo Code** | `~/.roo/mcp_settings.json` o `.roo/mcp.json` | `mcpServers` |
| **JetBrains IDEs** | `.idea/mcp.json` | `mcpServers` |
| **Cline** | Vía UI MCP Marketplace | - |

### Configuración genérica (formato MCP estándar)

```json
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

⚠️ **Nota importante**: VS Code usa `"servers"` (no `"mcpServers"`) y requiere `"type": "http"` explícito.

### Uso con Tailscale

Si ejecutas el MCP server en una máquina remota accesible via Tailscale:

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

Sustituye `100.82.111.22` por la IP de Tailscale de tu servidor.

### Verificación

Testea que el servidor esté accesible:

```bash
# Health check
curl http://localhost:3003/health

# Listar tools MCP
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Para más detalles**, consulta la guía completa en `MCP_CLIENT_CONFIG_GUIDE.md` con instrucciones específicas para cada herramienta, troubleshooting y métodos de autenticación.

## Tool MCP: list_image_models

Lista los modelos de OpenRouter con `output_modalities=image`, obteniendo datos actualizados de la API pública. No requiere `OPENROUTER_API_KEY`.

Parámetros: ninguno.

Salida:
- `content[0].text`: tabla Markdown con columnas `id`, `name`, `provider`, `image_output`, `coste/imagen aprox.`, `notas`.
- Los modelos se ordenan de menor a mayor coste estimado.

Útil para consultar qué modelos usar y cuánto costará generar una imagen antes de llamar a `generate_image`.

## Tool MCP: generate_image

Parámetros:
- `prompt` (string, requerido)
- `model` (string, opcional; si no, usa `OPENROUTER_IMAGE_MODEL`)
- `image_config` (object, opcional; se pasa directo a OpenRouter)
- `output_path` (string, opcional; ruta relativa bajo `/data`)
- Si la extensión del archivo no coincide con el tipo real detectado (PNG/JPEG/GIF/WEBP), el servidor puede corregirla automáticamente al guardar.
- `mime_type` (string, opcional; default detectado automáticamente)
- `return_base64` (boolean, opcional; default `true`)
  - Si `false`, no incluye la imagen base64 en la respuesta MCP (útil para evitar respuestas JSON enormes). Recomendado cuando usas `output_path`.

Salida:
- `content[0]`: texto con metadatos
- `content[1]`: imagen como base64 (`type: image`) si `return_base64=true`

### Ejemplo (CLI): generar y guardar (sin base64)

Este ejemplo usa el modelo `black-forest-labs/flux.2-klein-4b` y guarda el PNG en `output/tests/`.

```bash
set -a
. ./.env
set +a

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

Esperado (resumen):
- `saved_to: /data/tests/flux.2-klein-4b.png`
- `mime_type: image/png`
- `base64_in_response: no`

## Configuración en herramientas de coding

Este servidor MCP es compatible con múltiples herramientas de desarrollo asistido por IA. La configuración varía ligeramente entre herramientas.

**Guía completa**: Ver `MCP_CLIENT_CONFIG_GUIDE.md` para documentación detallada de todas las herramientas.

### Resumen rápido

| Herramienta | Archivo de configuración | Top-level key |
|-------------|------------------------|---------------|
| **Claude Code** | `~/.claude.json` o `.mcp.json` | `mcpServers` |
| **Cursor** | `~/.cursor/mcp.json` o `.cursor/mcp.json` | `mcpServers` |
| **VS Code + GitHub Copilot** | `.vscode/mcp.json` | `servers` ⚠️ |
| **Windsurf** | `mcp.config.json` (vía UI Cascade) | `mcpServers` |
| **Continue** | `~/.continue/config.json` o `.continue/mcp.json` | `mcpServers` |
| **Roo Code** | `~/.roo/mcp_settings.json` o `.roo/mcp.json` | `mcpServers` |
| **JetBrains IDEs** | `.idea/mcp.json` | `mcpServers` |
| **Cline** | Vía UI MCP Marketplace | - |

### Configuración genérica (formato MCP estándar)

```json
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

⚠️ **Nota importante**: VS Code usa `"servers"` (no `"mcpServers"`) y requiere `"type": "http"` explícito.

### Uso con Tailscale

Si ejecutas el MCP server en una máquina remota accesible via Tailscale:

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

Sustituye `100.82.111.22` por la IP de Tailscale de tu servidor.

### Verificación

Testea que el servidor esté accesible:

```bash
# Health check
curl http://localhost:3003/health

# Listar tools MCP
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Para más detalles**, consulta la guía completa en `MCP_CLIENT_CONFIG_GUIDE.md` con instrucciones específicas para cada herramienta, troubleshooting y métodos de autenticación.

## Notas

- Genera un token fuerte para `AUTH_TOKEN` con algo como: `openssl rand -hex 32`.
- Este servidor implementa un subconjunto mínimo de MCP: `initialize`, `tools/list` y `tools/call`.
- `list_image_models` no requiere `OPENROUTER_API_KEY`; usa el endpoint público de modelos de OpenRouter.
- Si OpenRouter devuelve el resultado como data URL (`data:image/png;base64,...`), se extrae automáticamente.
- Si OpenRouter devuelve bytes JPEG/PNG sin data URL, el servidor intenta detectar el MIME por “magic bytes”.

## Modelos con output image y precios

- **Dinámico (MCP)**: usa la tool `list_image_models` para obtener el listado actualizado con precios desde la API de OpenRouter.
- **Documento estático**: `OPENROUTER_IMAGE_MODELS.md` contiene una tabla generada periódicamente desde la misma API; se alinea con el filtro de la UI (`/models?...&output_modalities=image`).
