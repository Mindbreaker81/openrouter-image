import fs from "node:fs/promises";
import path from "node:path";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
export const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "";
export const OUTPUT_DIR = process.env.OUTPUT_DIR || "/data";
export const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || "";
export const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || "openrouter-image";

export function safeJoinOutputDir(relativePath) {
  const cleaned = String(relativePath || "").replace(/^\/+/, "");
  const target = path.resolve(OUTPUT_DIR, cleaned);
  const base = path.resolve(OUTPUT_DIR);
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error("output_path escapes OUTPUT_DIR");
  }
  return target;
}

export async function assertNotSymlink(absPath) {
  const st = await fs.lstat(absPath);
  if (st.isSymbolicLink()) {
    throw new Error("Refusing to access symlink under OUTPUT_DIR");
  }
  return st;
}

export async function callOpenRouterResponses({ model, prompt, imageConfig, inputImageDataUrl }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const content = [{ type: "input_text", text: prompt }];
  if (typeof inputImageDataUrl === "string" && inputImageDataUrl.trim().length > 0) {
    content.push({ type: "input_image", image_url: inputImageDataUrl.trim() });
  }

  const body = {
    model,
    modalities: ["image"],
    input: [
      {
        role: "user",
        content,
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

export function extractBase64FromResponse(openRouterResponse) {
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

export function stripDataUrlPrefix(maybeDataUrl) {
  const str = String(maybeDataUrl || "");
  const match = str.match(/^data:([^;]+);base64,(.*)$/s);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: null, base64: str };
}

export function sniffImageMimeType(buf) {
  if (!buf || buf.length < 12) return null;

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

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

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

function isLikelyImagePath(p) {
  const ext = path.extname(String(p || "").toLowerCase());
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".webp";
}

export async function listOutputImages({ prefix = "", recursive = true, limit = 200, includeNonImages = false, sort = "mtime_desc" }) {
  const baseDir = safeJoinOutputDir(prefix);
  await fs.mkdir(baseDir, { recursive: true });
  await assertNotSymlink(baseDir);

  const baseResolved = path.resolve(OUTPUT_DIR);
  const results = [];

  async function walk(dirAbs) {
    const dirents = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const d of dirents) {
      const abs = path.join(dirAbs, d.name);
      const rel = path.relative(baseResolved, abs).split(path.sep).join("/");

      let st;
      try {
        st = await fs.lstat(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;

      if (d.isDirectory()) {
        if (recursive) await walk(abs);
        continue;
      }
      if (!d.isFile()) continue;

      if (!includeNonImages && !isLikelyImagePath(d.name)) continue;

      results.push({
        path: rel,
        bytes: st.size,
        mtimeMs: st.mtimeMs,
      });
    }
  }

  await walk(baseDir);

  const sorter = {
    mtime_desc: (a, b) => b.mtimeMs - a.mtimeMs,
    mtime_asc: (a, b) => a.mtimeMs - b.mtimeMs,
    size_desc: (a, b) => b.bytes - a.bytes,
    size_asc: (a, b) => a.bytes - b.bytes,
    name_asc: (a, b) => a.path.localeCompare(b.path),
    name_desc: (a, b) => b.path.localeCompare(a.path),
  }[sort];

  if (sorter) results.sort(sorter);
  const sliced = results.slice(0, Math.max(1, Math.min(1000, Number(limit) || 200)));

  const header = "| path | bytes | modified |";
  const sep = "|---|---:|---|";
  const rows = sliced.map((r) => `| ${r.path} | ${r.bytes} | ${new Date(r.mtimeMs).toISOString()} |`);
  const meta = `# Output images\n\nbase: ${OUTPUT_DIR}\ncount: ${sliced.length}${results.length > sliced.length ? ` (showing first ${sliced.length} of ${results.length})` : ""}\n`;
  return `${meta}\n${header}\n${sep}\n${rows.join("\n")}\n`;
}

export async function readOutputImage({ imagePath }) {
  const abs = safeJoinOutputDir(imagePath);
  await assertNotSymlink(abs);
  const bytes = await fs.readFile(abs);
  const detectedMimeType = sniffImageMimeType(bytes) || "image/png";
  return {
    abs,
    detectedMimeType,
    base64: bytes.toString("base64"),
    byteLength: bytes.length,
  };
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

export function fixOutputPathExtensionForMimeType(outputPath, mimeType) {
  const desiredExts = desiredExtensionsForMimeType(mimeType);
  if (!desiredExts) return { outputPath, changed: false };

  const original = String(outputPath || "");
  const ext = path.extname(original);
  const extLower = ext.toLowerCase();

  if (!extLower) {
    return { outputPath: `${original}${desiredExts[0]}`, changed: true };
  }

  if (desiredExts.includes(extLower)) {
    return { outputPath: original, changed: false };
  }

  const knownImageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  if (knownImageExts.has(extLower)) {
    return { outputPath: `${original.slice(0, -ext.length)}${desiredExts[0]}`, changed: true };
  }

  return { outputPath: original, changed: false };
}

export function summarizeOpenRouterResponse(openRouterResponse) {
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

const OPENROUTER_MODELS_API = process.env.OPENROUTER_MODELS_API || "https://openrouter.ai/api/frontend/models/find";

export async function fetchOpenRouterImageModels() {
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

export function formatModelsAsMarkdown(models) {
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