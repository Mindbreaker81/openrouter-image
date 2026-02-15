# Ejemplos de Instalación

## Caso 1: Desarrollador quiere usar la librería en su proyecto

```bash
cd mi-proyecto-web
npm install openrouter-image-mcp
```

**Archivos en node_modules:**
```
node_modules/
└── openrouter-image-mcp/
    ├── src/
    │   ├── index.js
    │   ├── client.js
    │   ├── core.js
    │   ├── cli.js
    │   ├── mcp-stdio.js
    │   └── server.js
    ├── package.json
    ├── README.md
    └── node_modules/
        └── express/  ← Dependencia automática
```

**En su código:**
```javascript
import { OpenRouterImageClient } from 'openrouter-image-mcp';

const client = new OpenRouterImageClient({
  apiKey: process.env.OPENROUTER_API_KEY
});

const result = await client.generateImage('A sunset', {
  outputPath: 'sunset.png'
});
```

## Caso 2: Usuario quiere la CLI global

```bash
npm install -g openrouter-image-mcp
```

**Lo que se instala:**
- Todo el código en el directorio global de npm
- Un symlink en `/usr/local/bin/openrouter-image` (Linux/Mac)
- Pueden ejecutar desde cualquier lugar

**Comandos disponibles:**
```bash
openrouter-image --help
openrouter-image models
openrouter-image generate "A cat" -o cat.png
openrouter-image server --stdio  # Para Claude Code
```

## Caso 3: Usuario quiere configurar en Claude Code

```bash
# Instala globalmente
npm install -g openrouter-image-mcp

# Ejecuta script de instalación
./scripts/install-claude.sh  # O manualmente editar ~/.claude.json
```

**En ~/.claude.json:**
```json
{
  "mcpServers": {
    "openrouter-image": {
      "command": "openrouter-image",
      "args": ["server", "--stdio"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

**Lo que Claude Code ejecuta:**
- Inicia el proceso: `openrouter-image server --stdio`
- Lee desde stdin, escribe a stdout
- Usa el código en `src/mcp-stdio.js`
- Sin servidor HTTP, sin puerto

## Verificar instalación

```bash
# Ver versión instalada
openrouter-image --version

# Ver archivos instalados
npm list -g openrouter-image-mcp

# Ver ubicación
which openrouter-image
# /usr/local/bin/openrouter-image

# Ver contenido del package
npm view openrouter-image-mcp
```

## Espacio en disco

- **Tarball**: 21.5 KB (descarga inicial)
- **Descomprimido**: ~90 KB
- **Con dependencias**: ~2 MB (express + sus dependencias)
- **Total instalado**: ~2.1 MB

## Versionado semántico

```bash
# Instalar versión específica
npm install openrouter-image-mcp@0.5.0

# Instalar última versión
npm install openrouter-image-mcp@latest

# Ver versiones disponibles
npm view openrouter-image-mcp versions
```
