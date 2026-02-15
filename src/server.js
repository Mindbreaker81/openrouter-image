import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
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

const packageJson = await import("../package.json", { with: { type: "json" } });
const SERVER_VERSION = packageJson.default.version;

// Check if --stdio flag is present
const USE_STDIO = process.argv.includes("--stdio");

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = parseInt(process.env.PORT || "3000", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";

function unauthorized(res) {
  res.status(401).json({ error: "Unauthorized" });
}

function checkAuth(req, res) {
  if (!AUTH_TOKEN) {
    res.status(500).json({ error: "Server misconfigured: AUTH_TOKEN is not set" });
    return false;
  }

  const authHeader = req.get("authorization") || "";
  const expected = `Bearer ${AUTH_TOKEN}`;
  if (authHeader !== expected) {
    unauthorized(res);
    return false;
  }

  return true;
}

function jsonrpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function jsonrpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const payload = req.body;
  const requests = Array.isArray(payload) ? payload : [payload];

  const responses = [];

  for (const r of requests) {
    const { jsonrpc, id, method, params } = r || {};

    if (jsonrpc !== "2.0" || typeof method !== "string") {
      responses.push(jsonrpcError(id, -32600, "Invalid Request"));
      continue;
    }

    try {
      if (method === "initialize") {
        const clientProtocolVersion = params?.protocolVersion;
        const protocolVersion = typeof clientProtocolVersion === "string" ? clientProtocolVersion : "2024-11-05";
        responses.push(
          jsonrpcResult(id, {
            protocolVersion,
            serverInfo: {
              name: "openrouter-image",
              version: SERVER_VERSION,
            },
            capabilities: {
              tools: {},
            },
          })
        );
        continue;
      }

      if (method === "tools/list") {
        responses.push(
          jsonrpcResult(id, {
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
          })
        );
        continue;
      }

      if (method === "tools/call") {
        const name = params?.name;
        const args = params?.arguments || {};

        if (name === "list_image_models") {
          try {
            const models = await fetchOpenRouterImageModels();
            const markdown = formatModelsAsMarkdown(models);
            responses.push(
              jsonrpcResult(id, {
                content: [{ type: "text", text: markdown }],
                isError: false,
              })
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            responses.push(jsonrpcError(id, -32000, `Failed to fetch OpenRouter models: ${message}`));
          }
          continue;
        }

        if (name === "list_output_images") {
          try {
            const markdown = await listOutputImages({
              prefix: typeof args?.prefix === "string" ? args.prefix : "",
              recursive: args?.recursive !== false,
              limit: args?.limit,
              includeNonImages: args?.include_non_images === true,
              sort: typeof args?.sort === "string" ? args.sort : "mtime_desc",
            });
            responses.push(
              jsonrpcResult(id, {
                content: [{ type: "text", text: markdown }],
                isError: false,
              })
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            responses.push(jsonrpcError(id, -32000, `Failed to list output images: ${message}`));
          }
          continue;
        }

        if (name === "read_output_image") {
          const p = args?.path;
          const returnBase64 = args?.return_base64 !== false;
          const mimeTypeOverride = args?.mime_type;

          if (typeof p !== "string" || p.trim().length === 0) {
            responses.push(jsonrpcError(id, -32602, "Invalid params", { field: "path" }));
            continue;
          }

          try {
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

            responses.push(
              jsonrpcResult(id, {
                content,
                isError: false,
              })
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            responses.push(jsonrpcError(id, -32000, `Failed to read output image: ${message}`));
          }
          continue;
        }

        if (name !== "generate_image" && name !== "edit_image") {
          responses.push(jsonrpcError(id, -32601, "Method not found"));
          continue;
        }

        const prompt = args?.prompt;
        const model = (args?.model || OPENROUTER_IMAGE_MODEL || "").trim();
        const imageConfig = args?.image_config;
        const outputPath = args?.output_path;
        const mimeTypeOverride = args?.mime_type;
        const returnBase64 = args?.return_base64 !== false;
        const inputImagePath = args?.input_image_path;

        if (typeof prompt !== "string" || prompt.trim().length === 0) {
          responses.push(jsonrpcError(id, -32602, "Invalid params", { field: "prompt" }));
          continue;
        }
        if (name === "edit_image") {
          if (typeof inputImagePath !== "string" || inputImagePath.trim().length === 0) {
            responses.push(jsonrpcError(id, -32602, "Invalid params", { field: "input_image_path" }));
            continue;
          }
        }
        if (!model) {
          responses.push(
            jsonrpcError(id, -32602, "Invalid params", {
              field: "model",
              message: "Provide args.model or set OPENROUTER_IMAGE_MODEL",
            })
          );
          continue;
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
          responses.push(
            jsonrpcError(id, -32000, "No image data returned from OpenRouter", {
              openRouterResponse: summarizeOpenRouterResponse(openRouterResponse),
            })
          );
          continue;
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

        responses.push(
          jsonrpcResult(id, {
            content,
            isError: false,
          })
        );
        continue;
      }

      if (method === "notifications/initialized") {
        // No response for notifications.
        continue;
      }

      responses.push(jsonrpcError(id, -32601, "Method not found"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      responses.push(jsonrpcError(id, -32000, message));
    }
  }

  if (Array.isArray(payload)) {
    res.json(responses);
  } else {
    res.json(responses[0] ?? null);
  }
});

// Main entry point
async function main() {
  // Stdio mode - no authentication required for local communication
  if (USE_STDIO) {
    const { startStdioServer } = await import("./mcp-stdio.js");
    await startStdioServer();
    return;
  }

  // HTTP mode - requires Bearer token authentication
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  app.listen(PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`openrouter-image listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
