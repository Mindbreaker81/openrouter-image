# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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

## [0.2.0] - 2026-02-13

### Cambiado

- **Documentación expandida**: añadida guía completa de configuración para múltiples herramientas de coding (Claude Code, Cursor, VS Code, Windsurf, Continue, Roo Code, JetBrains, Cline).
- **Nueva documentación**: `MCP_CLIENT_CONFIG_GUIDE.md` con ejemplos detallados, troubleshooting y comparación de formatos de configuración entre herramientas.
- **Variables de entorno**: documentadas `PORT` y `OUTPUT_DIR` en README.md.
- **Configuración en Cursor**: actualizada y alineada con la nueva guía completa.
