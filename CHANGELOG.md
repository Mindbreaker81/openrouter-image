# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.5.0] - 2025-02-15 (Library Release)

### Added

- **Library API (`src/index.js`, `src/client.js`)**: Programmatic interface for Node.js applications
  - `OpenRouterImageClient` class with methods: `generateImage()`, `editImage()`, `listModels()`, `getModelsMarkdown()`, `listImages()`, `readImage()`
  - Full TypeScript support with JSDoc annotations
  - Configurable via constructor options or environment variables
  - Documentation: `LIBRARY.md` with API reference and examples
- **MCP Stdio Transport (`src/mcp-stdio.js`)**: Stdio-based MCP server for Claude Code
  - Reads JSON-RPC from stdin, writes responses to stdout
  - No authentication required for local communication
  - `server --stdio` command in CLI
- **Subpath exports**: Package can be imported as `openrouter-image-mcp`, `openrouter-image-mcp/client`, `openrouter-image-mcp/core`
- **MIT License**: Added LICENSE file for public distribution
- **`.npmignore`**: Excludes tests, scripts, and development files from npm package
- **`package.json` updates**:
  - `private: false` for public publishing
  - `exports` field for subpath exports
  - `files` field to control published content
  - `keywords` for npm discoverability
  - Added `license` and `description` fields
- **CLI `--version` flag**: Shows package version
- **CLI `server` command**: Starts MCP server in HTTP or stdio mode
- **`scripts/install-claude.sh`**: Automated installation script for Claude Code configuration
- **`CLAUDE_SKILL.md`**: Comprehensive guide for Claude Code skill installation and usage

### Changed

- **README.md**: Reorganized with 4 usage modes (Library, CLI, MCP Server, Claude Code Skill)
  - Added quick start examples for each mode
  - Links to detailed documentation (LIBRARY.md, CLAUDE_SKILL.md)
  - English documentation with improved structure

### Technical

- All source files validated with `node --check`
- All existing tests pass (10/10)
- npm pack produces 21.5 kB tarball with only necessary files
- Library exports verified working

## [0.4.0] - 2026-02-15

### Añadido

- **CLI (`src/cli.js`)**: nueva interfaz de línea de comandos con los mismos flujos que el MCP server.
  - Comandos: `generate`, `edit`, `models`, `list`, `read`.
  - Instalable globalmente vía `npm link` o `npm install -g`.
  - Binario: `openrouter-image`.
  - Flags: `--model`/`-m`, `--output`/`-o`, `--input`/`-i`, `--config`/`-c`, `--no-base64`, `--prefix`, `--recursive`, `--limit`, `--sort`, `--mime-type`, `--copy-to`.
- **Módulo compartido (`src/core.js`)**: toda la lógica de negocio extraída del servidor a un módulo reutilizable.
  - Exporta: `callOpenRouterResponses`, `extractBase64FromResponse`, `stripDataUrlPrefix`, `sniffImageMimeType`, `fixOutputPathExtensionForMimeType`, `listOutputImages`, `readOutputImage`, `fetchOpenRouterImageModels`, `formatModelsAsMarkdown`, `safeJoinOutputDir`, `assertNotSymlink`, `summarizeOpenRouterResponse`.
- **`Dockerfile.cli`**: imagen Docker dedicada para ejecutar la CLI en contenedores (separada del `Dockerfile` del MCP server).
- **Tests (`tests/cli.test.js`)**: suite de tests con `node:test` (10 tests).
  - Tests de validación de argumentos (help, comando desconocido, prompt/modelo faltante, edit sin input, limit inválido, read sin path).
  - Tests de integración con mock HTTP local simulando endpoints OpenRouter (`/responses` y `/models/find`).
  - Verificación de corrección automática de extensión de archivo.
- **Script `scripts/models_clean.js`**: genera `output/models-clean.md` filtrando solo modelos con precio.
- **`package.json`**: añadidos `bin` (`openrouter-image`), scripts `cli` y `test`.

### Cambiado

- **`src/server.js`**: refactorizado para importar toda la lógica desde `src/core.js` (elimina duplicación).
- **`README.md`**: reescrito completamente con documentación exhaustiva:
  - Tabla de contenidos, requisitos, instalación (clone, npm link, npm pack, Docker).
  - Variables de entorno con tabla detallada.
  - Servidor MCP: Docker Compose, Docker standalone, Node.js directo.
  - CLI: todos los comandos con flags, ejemplos y salida esperada.
  - Docker CLI con `Dockerfile.cli`.
  - Referencia completa de las 5 MCP tools con tablas de parámetros.
  - Configuración para 8 herramientas de coding (Cursor, Claude Code, VS Code, Windsurf, etc.).
  - Ejemplos curl JSON-RPC.
  - Sección de tests, estructura del proyecto y seguridad.

## [0.3.0] - 2026-02-13

### Añadido

- **Tool `list_output_images`**: lista imágenes guardadas bajo `OUTPUT_DIR` (soporta prefix, recursivo, orden y límite).
- **Tool `read_output_image`**: devuelve una imagen guardada como contenido MCP (`type: image`) para poder "recuperarla" sin tener que re-generar base64.
- **Tool `edit_image`**: image-to-image usando OpenRouter Responses API (lee `input_image_path` desde `OUTPUT_DIR` y genera una nueva imagen).

### Seguridad

- Las tools que acceden a disco rechazan symlinks bajo `OUTPUT_DIR`.

## [0.2.1] - 2026-02-13

### Cambiado

- **Documentación expandida**: añadida guía completa de configuración para múltiples herramientas de coding (Claude Code, Cursor, VS Code, Windsurf, Continue, Roo Code, JetBrains, Cline).
- **Nueva documentación**: `MCP_CLIENT_CONFIG_GUIDE.md` con ejemplos detallados, troubleshooting y comparación de formatos de configuración entre herramientas.
- **Variables de entorno**: documentadas `PORT` y `OUTPUT_DIR` en README.md.
- **Configuración en Cursor**: actualizada y alineada con la nueva guía completa.

## [0.2.0] - 2026-02-07

### Añadido

- **Tool `list_image_models`**: nueva herramienta MCP que lista los modelos de generación de imagen de OpenRouter con precios actualizados y coste estimado por imagen.
  - Consulta la API pública de OpenRouter (`/api/frontend/models/find?output_modalities=image`) en tiempo real.
  - No requiere `OPENROUTER_API_KEY`.
  - Devuelve una tabla Markdown con: id, name, provider, image_output, coste/imagen aprox., notas.
  - Ordena los modelos de menor a mayor coste.
  - Soporta estimaciones para Sourceful, Black Forest Labs (FLUX), Seedream, Gemini y OpenAI.

## [0.1.0] - (inicial)

### Añadido

- Servidor MCP HTTP con herramienta `generate_image` para generar imágenes vía OpenRouter Responses API.
- Soporte para guardar imágenes en disco (volumen montado `/data`).
- Endpoint `GET /health` para healthcheck.
- Variables de entorno: `AUTH_TOKEN`, `OPENROUTER_API_KEY`, `OPENROUTER_IMAGE_MODEL`, etc.
