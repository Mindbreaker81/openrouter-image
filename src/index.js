/**
 * openrouter-image-mcp - Library entry point
 *
 * A dual-interface MCP server and CLI for image generation/editing via OpenRouter's Responses API.
 * This module provides the main exports for using the package as a library.
 */

export { OpenRouterImageClient } from './client.js';
export * from './core.js';

// Export version from package.json
const packageJson = await import('../package.json', { with: { type: 'json' } });
export const version = packageJson.default.version;
