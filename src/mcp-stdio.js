/**
 * MCP Stdio Transport
 *
 * Implements the MCP protocol over stdin/stdout for use with Claude Code
 * and other MCP clients that support stdio transport.
 *
 * This module reads JSON-RPC messages from stdin and writes responses to stdout.
 * No authentication is required for local stdio communication.
 */

import fs from "node:fs/promises";
import {
  OUTPUT_DIR,
  OPENROUTER_IMAGE_MODEL,
  safeJoinOutputDir,
  assertNotSymlink,
  callOpenRouterResponses,
  extractBase64FromResponse,
  stripDataUrlPrefix,
  sniffImageMimeType,
  listOutputImages,
  readOutputImage,
  fixOutputPathExtensionForMimeType,
  summarizeOpenRouterResponse,
  fetchOpenRouterImageModels,
  formatModelsAsMarkdown,
} from "./core.js";

const SERVER_INFO = {
  name: "openrouter-image-mcp",
  version: "0.3.0",
};

function jsonrpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function jsonrpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Handle an incoming MCP request
 * @param {Object} request - The JSON-RPC request object
 * @returns {Promise<Object|null>} Response object or null for notifications
 */
async function handleRequest(request) {
  const { jsonrpc, id, method, params } = request || {};

  if (jsonrpc !== "2.0" || typeof method !== "string") {
    return jsonrpcError(id, -32600, "Invalid Request");
  }

  try {
    // Initialize
    if (method === "initialize") {
      const clientProtocolVersion = params?.protocolVersion;
      const protocolVersion = typeof clientProtocolVersion === "string" ? clientProtocolVersion : "2024-11-05";
      return jsonrpcResult(id, {
        protocolVersion,
        serverInfo: SERVER_INFO,
        capabilities: {
          tools: {},
        },
      });
    }

    // List tools
    if (method === "tools/list") {
      return jsonrpcResult(id, {
        tools: [
          {
            name: "generate_image",
            description: "Generate an image via OpenRouter (Responses API) and optionally save it under OUTPUT_DIR.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                prompt: { type: "string", minLength: 1 },
                model: { type: "string", minLength: 1, description: "OpenRouter model id. Defaults to OPENROUTER_IMAGE_MODEL." },
                image_config: { type: "object", description: "Provider-specific image configuration passed through to OpenRouter." },
                output_path: { type: "string", description: "Relative path under OUTPUT_DIR to save image (e.g. assets/banner.png)." },
                mime_type: { type: "string", description: "MIME type for the returned MCP image content (default image/png)." },
                return_base64: {
                  type: "boolean",
                  description: "If false, do not include the base64 image in the MCP response (prevents huge JSON payloads).",
                  default: true,
                }
              },
              required: ["prompt"]
            }
          },
          {
            name: "edit_image",
            description: "Edit / transform an existing image under OUTPUT_DIR using OpenRouter (image-to-image via Responses API).",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                prompt: { type: "string", minLength: 1 },
                input_image_path: { type: "string", minLength: 1, description: "Relative path under OUTPUT_DIR for the input image." },
                model: { type: "string", minLength: 1, description: "OpenRouter model id. Defaults to OPENROUTER_IMAGE_MODEL." },
                image_config: { type: "object", description: "Provider-specific image configuration passed through to OpenRouter." },
                output_path: { type: "string", description: "Relative path under OUTPUT_DIR to save the edited image." },
                mime_type: { type: "string", description: "MIME type for the returned MCP image content (default detected automatically)." },
                return_base64: {
                  type: "boolean",
                  description: "If false, do not include the base64 image in the MCP response (prevents huge JSON payloads).",
                  default: true,
                }
              },
              required: ["prompt", "input_image_path"]
            }
          },
          {
            name: "list_image_models",
            description: "List OpenRouter image generation models with pricing and approximate cost per image. Fetches fresh data from the OpenRouter API.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {},
              required: []
            }
          },
          {
            name: "list_output_images",
            description: "List image files currently stored under OUTPUT_DIR.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                prefix: { type: "string", description: "Optional relative subfolder under OUTPUT_DIR (e.g. tests/)." },
                recursive: { type: "boolean", default: true },
                limit: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
                include_non_images: { type: "boolean", default: false },
                sort: {
                  type: "string",
                  enum: ["mtime_desc", "mtime_asc", "size_desc", "size_asc", "name_asc", "name_desc"],
                  default: "mtime_desc",
                }
              },
              required: []
            }
          },
          {
            name: "read_output_image",
            description: "Read an image from OUTPUT_DIR and return it as MCP image content.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: { type: "string", minLength: 1, description: "Relative path under OUTPUT_DIR to the image file." },
                mime_type: { type: "string", description: "Override MIME type for MCP response (default detected automatically)." },
                return_base64: { type: "boolean", default: true, description: "If false, do not include the base64 image in the MCP response." }
              },
              required: ["path"]
            }
          }
        ],
      });
    }

    // List image models
    if (method === "tools/call" && params?.name === "list_image_models") {
      const models = await fetchOpenRouterImageModels();
      const markdown = formatModelsAsMarkdown(models);
      return jsonrpcResult(id, {
        content: [{ type: "text", text: markdown }],
        isError: false,
      });
    }

    // List output images
    if (method === "tools/call" && params?.name === "list_output_images") {
      const args = params?.arguments || {};
      const markdown = await listOutputImages({
        prefix: typeof args?.prefix === "string" ? args.prefix : "",
        recursive: args?.recursive !== false,
        limit: args?.limit,
        includeNonImages: args?.include_non_images === true,
        sort: typeof args?.sort === "string" ? args.sort : "mtime_desc",
      });
      return jsonrpcResult(id, {
        content: [{ type: "text", text: markdown }],
        isError: false,
      });
    }

    // Read output image
    if (method === "tools/call" && params?.name === "read_output_image") {
      const args = params?.arguments || {};
      const p = args?.path;
      const returnBase64 = args?.return_base64 !== false;
      const mimeTypeOverride = args?.mime_type;

      if (typeof p !== "string" || p.trim().length === 0) {
        return jsonrpcError(id, -32602, "Invalid params", { field: "path" });
      }

      const img = await readOutputImage({ imagePath: p.trim() });
      const requestedMimeType = typeof mimeTypeOverride === "string" ? mimeTypeOverride.trim() : "";
      const mimeType = (requestedMimeType || img.detectedMimeType).trim();

      const textParts = [];
      textParts.push(`path: ${p.trim()}`);
      textParts.push(`abs_path: ${img.abs}`);
      textParts.push(`bytes: ${img.byteLength}`);
      if (mimeType !== img.detectedMimeType) {
        textParts.push(`mime_type: ${mimeType} (requested; detected: ${img.detectedMimeType})`);
      } else {
        textParts.push(`mime_type: ${mimeType}`);
      }
      textParts.push(`base64_in_response: ${returnBase64 ? "yes" : "no"}`);

      const content = [{ type: "text", text: textParts.join("\n") }];
      if (returnBase64) content.push({ type: "image", data: img.base64, mimeType });

      return jsonrpcResult(id, {
        content,
        isError: false,
      });
    }

    // Generate image or Edit image
    if (method === "tools/call" && (params?.name === "generate_image" || params?.name === "edit_image")) {
      const name = params?.name;
      const args = params?.arguments || {};

      const prompt = args?.prompt;
      const model = (args?.model || OPENROUTER_IMAGE_MODEL || "").trim();
      const imageConfig = args?.image_config;
      const outputPath = args?.output_path;
      const mimeTypeOverride = args?.mime_type;
      const returnBase64 = args?.return_base64 !== false;
      const inputImagePath = args?.input_image_path;

      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        return jsonrpcError(id, -32602, "Invalid params", { field: "prompt" });
      }
      if (name === "edit_image") {
        if (typeof inputImagePath !== "string" || inputImagePath.trim().length === 0) {
          return jsonrpcError(id, -32602, "Invalid params", { field: "input_image_path" });
        }
      }
      if (!model) {
        return jsonrpcError(id, -32602, "Invalid params", {
          field: "model",
          message: "Provide args.model or set OPENROUTER_IMAGE_MODEL",
        });
      }

      let inputImageDataUrl = null;
      if (name === "edit_image") {
        const absInput = safeJoinOutputDir(String(inputImagePath).trim());
        await assertNotSymlink(absInput);
        const inputBytes = await fs.readFile(absInput);
        const inputMime = sniffImageMimeType(inputBytes) || "image/png";
        inputImageDataUrl = `data:${inputMime};base64,${inputBytes.toString("base64")}`;
      }

      const openRouterResponse = await callOpenRouterResponses({
        model,
        prompt: prompt.trim(),
        imageConfig,
        inputImageDataUrl,
      });

      const base64Raw = extractBase64FromResponse(openRouterResponse);
      if (!base64Raw) {
        return jsonrpcError(id, -32000, "No image data returned from OpenRouter", {
          openRouterResponse: summarizeOpenRouterResponse(openRouterResponse),
        });
      }

      const { mimeType: dataUrlMime, base64 } = stripDataUrlPrefix(base64Raw);
      const imageBytes = Buffer.from(base64, "base64");
      const detectedMimeType = (dataUrlMime || sniffImageMimeType(imageBytes) || "image/png").trim();
      const requestedMimeType = typeof mimeTypeOverride === "string" ? mimeTypeOverride.trim() : "";
      const mimeType = (requestedMimeType || detectedMimeType).trim();

      let savedTo = null;
      let effectiveOutputPath = null;
      let outputPathFixed = false;
      if (typeof outputPath === "string" && outputPath.trim().length > 0) {
        const requestedOutputPath = outputPath.trim();
        const fixed = fixOutputPathExtensionForMimeType(requestedOutputPath, detectedMimeType);
        effectiveOutputPath = fixed.outputPath;
        outputPathFixed = fixed.changed;

        const target = safeJoinOutputDir(effectiveOutputPath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, imageBytes);
        savedTo = target;
      }

      const textParts = [];
      textParts.push(`tool: ${name}`);
      textParts.push(`model: ${model}`);
      if (name === "edit_image" && typeof inputImagePath === "string") {
        textParts.push(`input_image_path: ${inputImagePath.trim()}`);
      }
      if (savedTo) {
        if (effectiveOutputPath) textParts.push(`output_path: ${effectiveOutputPath}`);
        if (outputPathFixed && typeof outputPath === "string") textParts.push(`output_path_fixed_from: ${outputPath.trim()}`);
        textParts.push(`saved_to: ${savedTo}`);
      }
      else textParts.push(`saved_to: (not saved)`);
      if (mimeType !== detectedMimeType) {
        textParts.push(`mime_type: ${mimeType} (requested; detected: ${detectedMimeType})`);
      } else {
        textParts.push(`mime_type: ${mimeType}`);
      }
      textParts.push(`base64_in_response: ${returnBase64 ? "yes" : "no"}`);

      const content = [{ type: "text", text: textParts.join("\n") }];
      if (returnBase64) {
        content.push({ type: "image", data: base64, mimeType });
      }

      return jsonrpcResult(id, {
        content,
        isError: false,
      });
    }

    // Notification - no response
    if (method === "notifications/initialized") {
      return null;
    }

    // Method not found
    return jsonrpcError(id, -32601, "Method not found");

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonrpcError(id, -32000, message);
  }
}

/**
 * Start the MCP stdio server
 * Reads JSON-RPC messages from stdin and writes responses to stdout
 */
export async function startStdioServer() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Ensure OUTPUT_DIR exists
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch {
    // ignore
  }

  // Listen for stdin data
  let buffer = "";
  process.stdin.setEncoding("utf8");

  for await (const chunk of process.stdin) {
    buffer += chunk;

    // Process complete JSON-RPC messages (one per line)
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);

        // Send response (skip for notifications)
        if (response !== null) {
          const responseText = JSON.stringify(response) + "\n";
          process.stdout.write(encoder.encode(responseText));
        }
      } catch (err) {
        // Send parse error response
        const errorResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
            data: err instanceof Error ? err.message : String(err),
          },
        }) + "\n";
        process.stdout.write(encoder.encode(errorResponse));
      }
    }
  }
}
