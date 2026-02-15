#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  OUTPUT_DIR,
  OPENROUTER_IMAGE_MODEL,
  callOpenRouterResponses,
  extractBase64FromResponse,
  stripDataUrlPrefix,
  sniffImageMimeType,
  fixOutputPathExtensionForMimeType,
  fetchOpenRouterImageModels,
  formatModelsAsMarkdown,
  listOutputImages,
  readOutputImage,
  safeJoinOutputDir,
} from "./core.js";

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(`openrouter-image CLI

Usage:
  openrouter-image <command> [options]

Commands:
  generate <prompt>         Generate an image from a prompt
  edit <prompt>             Edit an input image with a prompt
  models                    List image models from OpenRouter
  list                      List images currently stored under OUTPUT_DIR
  read <path>               Read image metadata and optionally write a local copy

Global options:
  -h, --help                Show help

generate/edit options:
  -m, --model <id>          OpenRouter model id (defaults to OPENROUTER_IMAGE_MODEL)
  -o, --output <path>       Relative path under OUTPUT_DIR where image is stored
  -c, --config <json>       JSON string for image_config passed to OpenRouter
  --no-base64               Do not print base64 payload size in output summary

edit only:
  -i, --input <path>        Relative path under OUTPUT_DIR for source image

list options:
  --prefix <path>           Optional relative folder under OUTPUT_DIR
  -r, --recursive           Recurse into subfolders (default: true)
  -l, --limit <n>           Max number of files returned (default: 200)
  -s, --sort <mode>         mtime_desc|mtime_asc|size_desc|size_asc|name_asc|name_desc

read options:
  --mime-type <type>        Override mime type in summary output
  --copy-to <file>          Write a copy to any local absolute/relative file path

Env:
  OPENROUTER_API_KEY, OPENROUTER_IMAGE_MODEL, OUTPUT_DIR, OPENROUTER_BASE_URL,
  OPENROUTER_SITE_URL, OPENROUTER_APP_NAME

Default OUTPUT_DIR: ${OUTPUT_DIR}
`);
}

function parseJsonConfig(raw) {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    throw new Error("image_config must be a JSON object");
  } catch (err) {
    throw new Error(`Invalid --config JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function commandModels() {
  const models = await fetchOpenRouterImageModels();
  // eslint-disable-next-line no-console
  console.log(formatModelsAsMarkdown(models));
}

async function commandList(args) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      prefix: { type: "string", default: "" },
      recursive: { type: "boolean", short: "r", default: true },
      limit: { type: "string", short: "l", default: "200" },
      sort: { type: "string", short: "s", default: "mtime_desc" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) return printUsage();

  const limit = parseInt(values.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be an integer >= 1");
  }

  const markdown = await listOutputImages({
    prefix: values.prefix,
    recursive: values.recursive,
    limit,
    sort: values.sort,
  });
  // eslint-disable-next-line no-console
  console.log(markdown);
}

async function commandRead(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      "mime-type": { type: "string" },
      "copy-to": { type: "string" },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) return printUsage();

  const imagePath = positionals[0];
  if (!imagePath) {
    throw new Error("read requires <path>");
  }

  const img = await readOutputImage({ imagePath });
  const mimeType = values["mime-type"] || img.detectedMimeType;
  const lines = [
    `path: ${imagePath}`,
    `abs_path: ${img.abs}`,
    `bytes: ${img.byteLength}`,
    `mime_type: ${mimeType}${mimeType !== img.detectedMimeType ? ` (detected: ${img.detectedMimeType})` : ""}`,
  ];

  if (values["copy-to"]) {
    const target = values["copy-to"];
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(img.base64, "base64"));
    lines.push(`copied_to: ${target}`);
  }

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

async function commandGenerateOrEdit(command, args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      model: { type: "string", short: "m" },
      output: { type: "string", short: "o" },
      config: { type: "string", short: "c" },
      input: { type: "string", short: "i" },
      base64: { type: "boolean", default: true },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) return printUsage();

  const prompt = positionals.join(" ").trim();
  if (!prompt) {
    throw new Error(`${command} requires <prompt>`);
  }

  const model = (values.model || OPENROUTER_IMAGE_MODEL || "").trim();
  if (!model) {
    throw new Error("Missing model. Provide --model or set OPENROUTER_IMAGE_MODEL");
  }

  const imageConfig = parseJsonConfig(values.config);
  let inputImageDataUrl = null;
  let inputImagePath = null;

  if (command === "edit") {
    inputImagePath = values.input;
    if (!inputImagePath) {
      throw new Error("edit requires --input <path> (relative to OUTPUT_DIR)");
    }
    const input = await readOutputImage({ imagePath: inputImagePath });
    inputImageDataUrl = `data:${input.detectedMimeType};base64,${input.base64}`;
  }

  const openRouterResponse = await callOpenRouterResponses({
    model,
    prompt,
    imageConfig,
    inputImageDataUrl,
  });

  const base64Raw = extractBase64FromResponse(openRouterResponse);
  if (!base64Raw) {
    throw new Error("No image data returned from OpenRouter");
  }

  const { mimeType: dataUrlMime, base64 } = stripDataUrlPrefix(base64Raw);
  const imageBytes = Buffer.from(base64, "base64");
  const detectedMimeType = (dataUrlMime || sniffImageMimeType(imageBytes) || "image/png").trim();

  const requestedOutputPath = String(values.output || `${command}-${Date.now()}.png`).trim();
  const fixed = fixOutputPathExtensionForMimeType(requestedOutputPath, detectedMimeType);

  const target = safeJoinOutputDir(fixed.outputPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, imageBytes);

  const lines = [
    `tool: ${command === "generate" ? "generate_image" : "edit_image"}`,
    `model: ${model}`,
    `output_path: ${fixed.outputPath}`,
    `saved_to: ${target}`,
    `mime_type: ${detectedMimeType}`,
    `bytes: ${imageBytes.length}`,
  ];
  if (inputImagePath) lines.push(`input_image_path: ${inputImagePath}`);
  if (fixed.changed) lines.push(`output_path_fixed_from: ${requestedOutputPath}`);
  if (values.base64) lines.push(`base64_length: ${base64.length}`);

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

async function main() {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;

  if (!command || command === "-h" || command === "--help") {
    printUsage();
    return;
  }

  if (command === "models") return commandModels();
  if (command === "list") return commandList(rest);
  if (command === "read") return commandRead(rest);
  if (command === "generate" || command === "edit") return commandGenerateOrEdit(command, rest);

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});