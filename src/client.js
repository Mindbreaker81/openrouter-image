/**
 * OpenRouter Image Client - High-level API for image generation/editing
 *
 * This class provides a convenient, programmatic interface to interact with
 * OpenRouter's image generation capabilities. It wraps the core functions
 * and handles configuration, error handling, and response processing.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
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
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  OPENROUTER_IMAGE_MODEL,
  OUTPUT_DIR,
} from "./core.js";

/**
 * Configuration options for OpenRouterImageClient
 * @typedef {Object} ClientConfig
 * @property {string} [apiKey] - OpenRouter API key (defaults to OPENROUTER_API_KEY env var)
 * @property {string} [baseUrl] - Base URL for OpenRouter API (defaults to OPENROUTER_BASE_URL env var)
 * @property {string} [defaultModel] - Default model to use (defaults to OPENROUTER_IMAGE_MODEL env var)
 * @property {string} [outputDir] - Directory for saving images (defaults to OUTPUT_DIR env var)
 * @property {string} [siteUrl] - Site URL sent as HTTP-Referer header
 * @property {string} [appName] - App name sent as X-Title header
 */

/**
 * Result from image generation/editing operations
 * @typedef {Object} ImageResult
 * @property {string} base64 - Base64-encoded image data
 * @property {Buffer} bytes - Raw image bytes
 * @property {string} mimeType - Detected MIME type
 * @property {string} [savedPath] - Absolute path where image was saved (if outputPath was provided)
 * @property {string} [relativePath] - Relative path under OUTPUT_DIR (if outputPath was provided)
 * @property {boolean} [extensionFixed] - Whether the file extension was auto-corrected
 */

export class OpenRouterImageClient {
  /**
   * Create a new OpenRouter Image Client
   * @param {ClientConfig} [config] - Configuration options
   */
  constructor(config = {}) {
    this._apiKey = config.apiKey || OPENROUTER_API_KEY || "";
    this._baseUrl = config.baseUrl || OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this._defaultModel = config.defaultModel || OPENROUTER_IMAGE_MODEL || "";
    this._outputDir = config.outputDir || OUTPUT_DIR || "/data";
    this._siteUrl = config.siteUrl || "";
    this._appName = config.appName || "openrouter-image-mcp";

    // Validation
    if (!this._apiKey) {
      console.warn("WARNING: OPENROUTER_API_KEY not set. Provide it via config or environment variable.");
    }
  }

  /**
   * Get the current API key
   * @returns {string}
   */
  get apiKey() {
    return this._apiKey;
  }

  /**
   * Get the current base URL
   * @returns {string}
   */
  get baseUrl() {
    return this._baseUrl;
  }

  /**
   * Get the default model
   * @returns {string}
   */
  get defaultModel() {
    return this._defaultModel;
  }

  /**
   * Get the output directory
   * @returns {string}
   */
  get outputDir() {
    return this._outputDir;
  }

  /**
   * Set environment variables for OpenRouter API calls
   * This is a private method that temporarily overrides process.env
   * @private
   */
  _setEnv() {
    process.env.OPENROUTER_API_KEY = this._apiKey;
    process.env.OPENROUTER_BASE_URL = this._baseUrl;
    if (this._defaultModel) {
      process.env.OPENROUTER_IMAGE_MODEL = this._defaultModel;
    }
    if (this._siteUrl) {
      process.env.OPENROUTER_SITE_URL = this._siteUrl;
    }
    if (this._appName) {
      process.env.OPENROUTER_APP_NAME = this._appName;
    }
    if (this._outputDir) {
      process.env.OUTPUT_DIR = this._outputDir;
    }
  }

  /**
   * Generate an image from a text prompt
   * @param {string} prompt - Text prompt for image generation
   * @param {Object} [options] - Generation options
   * @param {string} [options.model] - OpenRouter model ID (defaults to client default)
   * @param {Object} [options.imageConfig] - Provider-specific image configuration
   * @param {string} [options.outputPath] - Relative path under OUTPUT_DIR to save the image
   * @returns {Promise<ImageResult>}
   * @throws {Error} If API key is missing or generation fails
   */
  async generateImage(prompt, options = {}) {
    if (!this._apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set. Provide it via config or environment variable.");
    }

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("prompt must be a non-empty string");
    }

    this._setEnv();

    const model = options.model || this._defaultModel;
    if (!model) {
      throw new Error("model must be specified either in options or in client config");
    }

    const response = await callOpenRouterResponses({
      model,
      prompt: prompt.trim(),
      imageConfig: options.imageConfig,
      inputImageDataUrl: null,
    });

    const base64Raw = extractBase64FromResponse(response);
    if (!base64Raw) {
      throw new Error("No image data returned from OpenRouter");
    }

    const { mimeType: dataUrlMime, base64 } = stripDataUrlPrefix(base64Raw);
    const imageBytes = Buffer.from(base64, "base64");
    const detectedMimeType = (dataUrlMime || sniffImageMimeType(imageBytes) || "image/png").trim();

    const result = {
      base64,
      bytes: imageBytes,
      mimeType: detectedMimeType,
    };

    // Save to disk if outputPath is provided
    if (options.outputPath) {
      const fixed = fixOutputPathExtensionForMimeType(options.outputPath, detectedMimeType);
      const target = safeJoinOutputDir(fixed.outputPath);

      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, imageBytes);

      result.savedPath = target;
      result.relativePath = fixed.outputPath;
      result.extensionFixed = fixed.changed;
    }

    return result;
  }

  /**
   * Edit an existing image using a text prompt (image-to-image)
   * @param {string} prompt - Text prompt describing the desired edit
   * @param {string|Buffer} input - Input image (file path relative to OUTPUT_DIR or Buffer)
   * @param {Object} [options] - Editing options
   * @param {string} [options.model] - OpenRouter model ID (defaults to client default)
   * @param {Object} [options.imageConfig] - Provider-specific image configuration
   * @param {string} [options.outputPath] - Relative path under OUTPUT_DIR to save the edited image
   * @returns {Promise<ImageResult>}
   * @throws {Error} If API key is missing or editing fails
   */
  async editImage(prompt, input, options = {}) {
    if (!this._apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set. Provide it via config or environment variable.");
    }

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("prompt must be a non-empty string");
    }

    this._setEnv();

    const model = options.model || this._defaultModel;
    if (!model) {
      throw new Error("model must be specified either in options or in client config");
    }

    // Load input image
    let inputBytes;
    let inputMime = "image/png";

    if (Buffer.isBuffer(input)) {
      inputBytes = input;
      inputMime = sniffImageMimeType(inputBytes) || "image/png";
    } else if (typeof input === "string") {
      const absPath = safeJoinOutputDir(input);
      const st = await fs.lstat(absPath);
      if (st.isSymbolicLink()) {
        throw new Error("Refusing to access symlink under OUTPUT_DIR");
      }
      inputBytes = await fs.readFile(absPath);
      inputMime = sniffImageMimeType(inputBytes) || "image/png";
    } else {
      throw new Error("input must be a file path (string) or Buffer");
    }

    const inputImageDataUrl = `data:${inputMime};base64,${inputBytes.toString("base64")}`;

    const response = await callOpenRouterResponses({
      model,
      prompt: prompt.trim(),
      imageConfig: options.imageConfig,
      inputImageDataUrl,
    });

    const base64Raw = extractBase64FromResponse(response);
    if (!base64Raw) {
      throw new Error("No image data returned from OpenRouter");
    }

    const { mimeType: dataUrlMime, base64 } = stripDataUrlPrefix(base64Raw);
    const imageBytes = Buffer.from(base64, "base64");
    const detectedMimeType = (dataUrlMime || sniffImageMimeType(imageBytes) || "image/png").trim();

    const result = {
      base64,
      bytes: imageBytes,
      mimeType: detectedMimeType,
    };

    // Save to disk if outputPath is provided
    if (options.outputPath) {
      const fixed = fixOutputPathExtensionForMimeType(options.outputPath, detectedMimeType);
      const target = safeJoinOutputDir(fixed.outputPath);

      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, imageBytes);

      result.savedPath = target;
      result.relativePath = fixed.outputPath;
      result.extensionFixed = fixed.changed;
    }

    return result;
  }

  /**
   * List available OpenRouter image models with pricing information
   * @returns {Promise<Array>} Array of model objects with pricing
   * @throws {Error} If fetching models fails
   */
  async listModels() {
    this._setEnv();
    return await fetchOpenRouterImageModels();
  }

  /**
   * Get models formatted as a Markdown table
   * @returns {Promise<string>} Markdown table with model information
   * @throws {Error} If fetching models fails
   */
  async getModelsMarkdown() {
    const models = await this.listModels();
    return formatModelsAsMarkdown(models);
  }

  /**
   * List images stored in OUTPUT_DIR
   * @param {Object} [options] - Listing options
   * @param {string} [options.prefix] - Optional relative subfolder under OUTPUT_DIR
   * @param {boolean} [options.recursive] - Search recursively (default: true)
   * @param {number} [options.limit] - Maximum results (default: 200, max: 1000)
   * @param {boolean} [options.includeNonImages] - Include non-image files (default: false)
   * @param {string} [options.sort] - Sort order: mtime_desc, mtime_asc, size_desc, size_asc, name_asc, name_desc
   * @returns {Promise<string>} Markdown table with image list
   * @throws {Error} If listing fails
   */
  async listImages(options = {}) {
    this._setEnv();
    return await listOutputImages({
      prefix: options.prefix || "",
      recursive: options.recursive !== false,
      limit: options.limit || 200,
      includeNonImages: options.includeNonImages || false,
      sort: options.sort || "mtime_desc",
    });
  }

  /**
   * Read an image from OUTPUT_DIR
   * @param {string} imagePath - Relative path under OUTPUT_DIR
   * @returns {Promise<Object>} Object with abs, detectedMimeType, base64, byteLength
   * @throws {Error} If reading fails
   */
  async readImage(imagePath) {
    this._setEnv();
    return await readOutputImage({ imagePath });
  }
}

export default OpenRouterImageClient;
