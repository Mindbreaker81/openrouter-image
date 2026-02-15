import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = parseInt(process.env.PORT || "3000", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/data";
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || "";
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || "openrouter-image-mcp";

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

function safeJoinOutputDir(relativePath) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "");
  const target = path.resolve(OUTPUT_DIR, cleaned);
  const base = path.resolve(OUTPUT_DIR);
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error("output_path escapes OUTPUT_DIR");
  }
  return target;
}

async function callOpenRouterResponses({ model, prompt, imageConfig }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const body = {
    model,
    modalities: ["image"],
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
  };

  if (imageConfig && typeof imageConfig === "object") {
    body.image_config = imageConfig;
  }

  const headers = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };

  if (OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = OPENROUTER_SITE_URL;
  }
  if (OPENROUTER_APP_NAME) {
    headers["X-Title"] = OPENROUTER_APP_NAME;
  }

  const resp = await fetch(`${OPENROUTER_BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenRouter error ${resp.status}: ${text}`);
  }

  return await resp.json();
}

function extractBase64FromResponse(openRouterResponse) {
  const output = openRouterResponse?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === "image_generation_call" && typeof item?.result === "string" && item.result.length > 0) {
        return item.result;
      }
      if (item?.type === "image" && typeof item?.data === "string" && item.data.length > 0) {
        return item.data;
      }
    }
  }

  const direct = openRouterResponse?.result;
  if (typeof direct === "string" && direct.length > 0) return direct;

  return null;
}

function stripDataUrlPrefix(maybeDataUrl) {
  const str = String(maybeDataUrl || "");
  const match = str.match(/^data:([^;]+);base64,(.*)$/s);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: null, base64: str };
}

function sniffImageMimeType(buf) {
  if (!buf || buf.length < 12) return null;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG signature: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: GIF87a / GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "image/gif";
  }

  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function desiredExtensionsForMimeType(mimeType) {
  switch (mimeType) {
    case "image/png":
      return [".png"];
    case "image/jpeg":
      return [".jpg", ".jpeg"];
    case "image/gif":
      return [".gif"];
    case "image/webp":
      return [".webp"];
    default:
      return null;
  }
}

function fixOutputPathExtensionForMimeType(outputPath, mimeType) {
  const desiredExts = desiredExtensionsForMimeType(mimeType);
  if (!desiredExts) return { outputPath, changed: false };

  const original = String(outputPath || "");
  const ext = path.extname(original);
  const extLower = ext.toLowerCase();

  // If there is no extension, append the primary one.
  if (!extLower) {
    return { outputPath: `${original}${desiredExts[0]}`, changed: true };
  }

  // If current extension is already acceptable, keep it.
  if (desiredExts.includes(extLower)) {
    return { outputPath: original, changed: false };
  }

  // If it's a known image extension but doesn't match detected mime, replace it.
  const knownImageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  if (knownImageExts.has(extLower)) {
    return { outputPath: `${original.slice(0, -ext.length)}${desiredExts[0]}`, changed: true };
  }

  // Unknown extension: leave as-is.
  return { outputPath: original, changed: false };
}

function summarizeOpenRouterResponse(openRouterResponse) {
  const output = openRouterResponse?.output;
  const outputTypes = Array.isArray(output)
    ? output
        .map((item) => item?.type)
        .filter((t) => typeof t === "string")
        .slice(0, 20)
    : null;

  return {
    id: openRouterResponse?.id ?? null,
    status: openRouterResponse?.status ?? null,
    model: openRouterResponse?.model ?? null,
    output_types: outputTypes,
    has_output: Array.isArray(output),
  };
}

const OPENROUTER_MODELS_API = "https://openrouter.ai/api/frontend/models/find";

async function fetchOpenRouterImageModels() {
  const resp = await fetch(`${OPENROUTER_MODELS_API}?fmt=cards&output_modalities=image`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenRouter models API error ${resp.status}: ${text}`);
  }
  const json = await resp.json();
  return json?.data?.models ?? [];
}

function estimateCostPerImage(model) {
  const pricing = model?.endpoint?.pricing ?? {};
  const pricingJson = model?.endpoint?.pricing_json ?? {};

  if (pricingJson["sourceful:cents_per_image_output"] != null) {
    const cents = parseFloat(pricingJson["sourceful:cents_per_image_output"]) || 0;
    const usd = cents / 100;
    const cost = usd.toFixed(2);
    const notes = `Sourceful: ${cents}¢/imagen`;
    return { costUsd: `$${cost}`, notes, sortKey: usd };
  }
  if (pricingJson["sourceful:cents_per_2k_image_output"] != null) {
    const cents = parseFloat(pricingJson["sourceful:cents_per_2k_image_output"]) || 0;
    const usd = cents / 100;
    const cost = usd.toFixed(2);
    return { costUsd: `$${cost}`, notes: `Sourceful 2K: ${cents}¢`, sortKey: usd };
  }
  if (pricingJson["bfl:informational_output_megapixels"] != null) {
    const usd = parseFloat(pricingJson["bfl:informational_output_megapixels"]) || 0;
    return { costUsd: `$${usd.toFixed(3)}`, notes: "BFL: 1ª MP", sortKey: usd };
  }
  if (pricingJson["seedream:cents_per_image_output"] != null) {
    const cents = parseFloat(pricingJson["seedream:cents_per_image_output"]) || 0;
    const usd = cents / 100;
    const cost = usd.toFixed(2);
    return { costUsd: `$${cost}`, notes: "Seedream: tarifa fija", sortKey: usd };
  }

  const imageOutput = parseFloat(pricing?.image_output ?? pricing?.image_token);
  if (typeof imageOutput === "number" && imageOutput > 0) {
    const estUsd = imageOutput * 1024;
    const cost = estUsd < 0.01 ? estUsd.toFixed(3) : estUsd.toFixed(2);
    return { costUsd: `~$${cost}`, notes: `~1024 tokens × $${imageOutput}/token`, sortKey: estUsd };
  }

  return { costUsd: "—", notes: "sin precio en API", sortKey: Infinity };
}

function formatModelsAsMarkdown(models) {
  const withCost = models.map((m) => {
    const est = estimateCostPerImage(m);
    return {
      id: m.permaslug ?? m.slug ?? "",
      name: m.name ?? m.short_name ?? "",
      provider: m.endpoint?.provider_display_name ?? m.author ?? "",
      imageOutput: m.endpoint?.pricing?.image_output ?? m.endpoint?.pricing?.image_token ?? "—",
      ...est,
    };
  });
  withCost.sort((a, b) => (a.sortKey ?? Infinity) - (b.sortKey ?? Infinity));

  const rows = withCost.map((r) => `| ${r.id} | ${r.name} | ${r.provider} | ${r.imageOutput} | ${r.costUsd} | ${r.notes} |`);
  const header = "| id | name | provider | image_output | coste/imagen aprox. | notas |";
  const sep = "|---|---|---|:---:|---:|---|";
  return `# OpenRouter modelos de imagen (output_modalities=image)\n\nDatos obtenidos de la API de OpenRouter.\n\n${header}\n${sep}\n${rows.join("\n")}\n`;
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
              name: "openrouter-image-mcp",
              version: "0.2.0",
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
                name: "list_image_models",
                description: "List OpenRouter image generation models with pricing and approximate cost per image. Fetches fresh data from the OpenRouter API.",
                inputSchema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {},
                  required: []
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

        if (name !== "generate_image") {
          responses.push(jsonrpcError(id, -32601, "Method not found"));
          continue;
        }

        const prompt = args?.prompt;
        const model = (args?.model || OPENROUTER_IMAGE_MODEL || "").trim();
        const imageConfig = args?.image_config;
        const outputPath = args?.output_path;
        const mimeTypeOverride = args?.mime_type;
        const returnBase64 = args?.return_base64 !== false;

        if (typeof prompt !== "string" || prompt.trim().length === 0) {
          responses.push(jsonrpcError(id, -32602, "Invalid params", { field: "prompt" }));
          continue;
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

        const openRouterResponse = await callOpenRouterResponses({
          model,
          prompt: prompt.trim(),
          imageConfig,
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
        textParts.push(`model: ${model}`);
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

app.listen(PORT, "0.0.0.0", async () => {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.log(`openrouter-image-mcp listening on :${PORT}`);
});
