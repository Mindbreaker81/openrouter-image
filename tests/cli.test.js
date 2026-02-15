import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import http from "node:http";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(process.cwd(), "src/cli.js");
const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZQn8AAAAASUVORK5CYII=";

async function runCli(args, extraEnv = {}) {
  try {
    const result = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

function parseJsonBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function withMockOpenRouterServer(handler) {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      handler(req, res, parseJsonBody(body));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start mock server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await handler.__runner(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function runWithMockServer(requestHandler, runner) {
  requestHandler.__runner = runner;
  return withMockOpenRouterServer(requestHandler);
}

test("shows help with --help", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /openrouter-image CLI/);
  assert.match(result.stdout, /Commands:/);
});

test("fails on unknown command", async () => {
  const result = await runCli(["wat"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Unknown command: wat/);
});

test("generate requires prompt", async () => {
  const result = await runCli(["generate"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /generate requires <prompt>/);
});

test("generate fails when model is missing", async () => {
  const result = await runCli(["generate", "hola"], {
    OPENROUTER_IMAGE_MODEL: "",
  });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Missing model/);
});

test("edit requires --input", async () => {
  const result = await runCli(["edit", "hazla azul", "--model", "openai/gpt-5-image-mini"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /edit requires --input <path>/);
});

test("list validates --limit", async () => {
  const result = await runCli(["list", "--limit", "0"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /--limit must be an integer >= 1/);
});

test("read requires path", async () => {
  const result = await runCli(["read"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /read requires <path>/);
});

test("generate happy path saves image using mocked OpenRouter", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "or-cli-generate-"));

  await runWithMockServer(
    (req, res, body) => {
      if (req.url === "/api/v1/responses" && req.method === "POST") {
        assert.equal(body.model, "test/model");
        assert.equal(body.input?.[0]?.content?.[0]?.type, "input_text");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "resp_1",
            status: "completed",
            output: [{ type: "image_generation_call", result: ONE_BY_ONE_PNG_BASE64 }],
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    },
    async (baseUrl) => {
      const result = await runCli(
        ["generate", "a tiny dot", "--model", "test/model", "--output", "tests/generated"],
        {
          OPENROUTER_API_KEY: "test-key",
          OPENROUTER_BASE_URL: `${baseUrl}/api/v1`,
          OUTPUT_DIR: tmpDir,
        }
      );

      assert.equal(result.code, 0);
      assert.match(result.stdout, /tool: generate_image/);
      assert.match(result.stdout, /output_path: tests\/generated\.png/);

      const filePath = path.join(tmpDir, "tests", "generated.png");
      const stat = await fs.stat(filePath);
      assert.ok(stat.size > 0);
    }
  );
});

test("edit happy path reads input and fixes output extension", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "or-cli-edit-"));
  const inputPath = path.join(tmpDir, "input.png");
  await fs.writeFile(inputPath, Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"));

  await runWithMockServer(
    (req, res, body) => {
      if (req.url === "/api/v1/responses" && req.method === "POST") {
        const content = body.input?.[0]?.content ?? [];
        assert.ok(content.some((item) => item.type === "input_text"));
        assert.ok(content.some((item) => item.type === "input_image"));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "resp_2",
            status: "completed",
            output: [{ type: "image_generation_call", result: ONE_BY_ONE_PNG_BASE64 }],
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    },
    async (baseUrl) => {
      const result = await runCli(
        ["edit", "make it brighter", "--model", "test/model", "--input", "input.png", "--output", "edited.jpg"],
        {
          OPENROUTER_API_KEY: "test-key",
          OPENROUTER_BASE_URL: `${baseUrl}/api/v1`,
          OUTPUT_DIR: tmpDir,
        }
      );

      assert.equal(result.code, 0);
      assert.match(result.stdout, /tool: edit_image/);
      assert.match(result.stdout, /output_path: edited\.png/);
      assert.match(result.stdout, /output_path_fixed_from: edited\.jpg/);

      const filePath = path.join(tmpDir, "edited.png");
      const stat = await fs.stat(filePath);
      assert.ok(stat.size > 0);
    }
  );
});

test("models happy path uses mocked models endpoint", async () => {
  await runWithMockServer(
    (req, res) => {
      if (req.url?.startsWith("/api/frontend/models/find") && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: {
              models: [
                {
                  permaslug: "test/image-model",
                  name: "Test Image Model",
                  endpoint: {
                    provider_display_name: "Test Provider",
                    pricing: { image_output: "0.00001" },
                    pricing_json: {},
                  },
                },
              ],
            },
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    },
    async (baseUrl) => {
      const result = await runCli(["models"], {
        OPENROUTER_MODELS_API: `${baseUrl}/api/frontend/models/find`,
      });

      assert.equal(result.code, 0);
      assert.match(result.stdout, /OpenRouter modelos de imagen/);
      assert.match(result.stdout, /test\/image-model/);
      assert.match(result.stdout, /Test Provider/);
    }
  );
});