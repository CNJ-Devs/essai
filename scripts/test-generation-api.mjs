#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = new URL("..", import.meta.url).pathname;
const providerDefaults = {
  mock: "mock-essai-draft-v1",
  openai: "gpt-5.4-mini",
  deepseek: "deepseek-v4-pro",
  anthropic: "claude-sonnet-5",
};

main().catch((error) => {
  console.error(`\n[failed] ${error.message}`);
  if (error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const providers = collectProviders(args);

  if (providers.length === 0) {
    console.log("No provider keys found. The script will only run mock tests.");
    console.log(
      "Pass keys with --openai-key, --deepseek-key, --anthropic-key, or matching env vars.",
    );
  }

  const port = await choosePort(args.port ?? 3010);
  const baseUrl = `http://localhost:${port}`;
  const keys = await createEncryptionKeys();
  if (args.build || (!args.skipBuild && !hasProductionBuild())) {
    await buildWeb();
  } else {
    console.log("Using existing @essai/web production build.");
  }
  const server = await startServer({ keys, port });

  try {
    console.log(`Generation API smoke server: ${baseUrl}`);
    await runMockSuite({ baseUrl, keys });

    for (const provider of providers) {
      await runProviderSuite({ baseUrl, keys, provider });
    }

    console.log("\nAll generation API smoke tests passed.");
  } finally {
    server.kill();
  }
}

async function runMockSuite({ baseUrl, keys }) {
  const generationId = `smoke_mock_${Date.now()}`;
  const titleId = `smoke_title_mock_${Date.now()}`;
  const generationOptions = {
    maxOutputTokens: 256,
  };
  const generationPayload = sampleDraftPayload();
  const generationInput = withDraftFingerprint({
    id: generationId,
    options: generationOptions,
    payload: generationPayload,
    provider: "mock",
  });

  console.log("\n[mock] encrypted generation");
  const generation = await postJson(
    baseUrl,
    "/api/generations",
    await encryptRequest(keys, {
      provider: "mock",
      generations: [generationInput],
      options: generationOptions,
    }),
  );
  assert(generation.ok, "mock generation returned ok=false", generation);
  assert(
    generation.records?.[0]?.status === "succeeded",
    "mock generation did not succeed",
    generation,
  );
  assert(
    typeof generation.records?.[0]?.output?.content === "string",
    "mock generation returned no content",
    generation,
  );

  console.log("[mock] duplicate generation id");
  const duplicateGeneration = await postJsonExpectError(
    baseUrl,
    "/api/generations",
    await encryptRequest(keys, {
      provider: "mock",
      generations: [
        {
          id: generationId,
          payload: generationPayload,
          requestFingerprint: generationInput.requestFingerprint,
        },
      ],
      options: generationOptions,
    }),
    409,
  );
  assert(
    duplicateGeneration.error?.code === "generation_request_exists",
    "duplicate generation id with the same fingerprint was not classified as an existing request",
    duplicateGeneration,
  );

  console.log("[mock] conflicting generation id");
  const conflictingPayload = sampleDraftPayload({
    content: "这是另一个不同的请求，用来确认相同 ID 但不同指纹会被当成冲突。",
  });
  const conflictingInput = withDraftFingerprint({
    id: generationId,
    options: generationOptions,
    payload: conflictingPayload,
    provider: "mock",
  });
  const conflictingGeneration = await postJsonExpectError(
    baseUrl,
    "/api/generations",
    await encryptRequest(keys, {
      provider: "mock",
      generations: [conflictingInput],
      options: generationOptions,
    }),
    409,
  );
  assert(
    conflictingGeneration.error?.code === "generation_id_conflict",
    "duplicate generation id with a different fingerprint was not rejected as a conflict",
    conflictingGeneration,
  );

  console.log("[mock] encrypted title");
  const titlePayload = {
    fragment: {
      id: "fragment_smoke",
      content: "给这条碎片自动生成一个标题。",
    },
  };
  const titleOptions = {
    maxOutputTokens: 96,
  };
  const title = await postJson(
    baseUrl,
    "/api/generation-title",
    await encryptRequest(keys, {
      id: titleId,
      requestFingerprint: titleFingerprint({
        id: titleId,
        options: titleOptions,
        payload: titlePayload,
        provider: "mock",
      }),
      provider: "mock",
      payload: titlePayload,
      options: titleOptions,
    }),
  );
  assert(title.ok, "mock title returned ok=false", title);
  assert(title.record?.status === "succeeded", "mock title did not succeed", title);

  console.log("[mock] pull");
  const pulled = await postJson(baseUrl, "/api/generations/pull", {
    ids: [generationId, titleId, "smoke_missing"],
  });
  assert(pulled.ok, "pull returned ok=false", pulled);
  assert(
    pulled.records?.length === 2 && pulled.missing?.length === 1,
    "pull did not return expected records/missing ids",
    pulled,
  );

  console.log("[mock] follow");
  const followed = await getSseEvents(
    baseUrl,
    `/api/generations/follow?ids=${generationId},${titleId},smoke_missing&intervalMs=500`,
  );
  assert(
    followed.some(
      (event) =>
        event.event === "generation.record" &&
        event.data?.record?.id === generationId &&
        event.data.record.status === "succeeded",
    ),
    "follow did not emit succeeded generation record",
    followed,
  );
  assert(
    followed.some(
      (event) =>
        event.event === "generation.expired" &&
        event.data?.id === "smoke_missing",
    ),
    "follow did not emit expired missing id",
    followed,
  );
  assert(
    followed.some((event) => event.event === "generation.done"),
    "follow did not complete",
    followed,
  );

  console.log("[mock] cleanup");
  const cleaned = await postJson(baseUrl, "/api/generations/cleanup", {
    ids: [generationId, titleId],
  });
  assert(cleaned.ok, "cleanup returned ok=false", cleaned);
  assert(cleaned.deletedCount === 2, "cleanup deleted unexpected count", cleaned);
}

async function runProviderSuite({ baseUrl, keys, provider }) {
  const generationId = `smoke_${provider.name}_${Date.now()}`;
  const titleId = `smoke_title_${provider.name}_${Date.now()}`;
  const model = provider.model ?? providerDefaults[provider.name];
  const generationOptions = {
    maxOutputTokens: 512,
  };
  const generationPayload = sampleDraftPayload();
  const generationInput = withDraftFingerprint({
    id: generationId,
    model,
    options: generationOptions,
    payload: generationPayload,
    provider: provider.name,
  });

  console.log(`\n[${provider.name}] encrypted generation (${model})`);
  const generation = await postJson(
    baseUrl,
    "/api/generations",
    await encryptRequest(keys, {
      provider: provider.name,
      model,
      encryptedApiKey: await encryptApiKey(keys, provider.apiKey),
      generations: [generationInput],
      options: generationOptions,
      timeoutMs: 240000,
    }),
  );
  assert(generation.ok, `${provider.name} generation returned ok=false`, generation);
  assert(
    generation.records?.[0]?.status === "succeeded",
    `${provider.name} generation did not succeed`,
    generation,
  );
  assert(
    typeof generation.records?.[0]?.output?.content === "string" &&
      generation.records[0].output.content.length > 0,
    `${provider.name} generation returned no content`,
    generation,
  );

  console.log(`[${provider.name}] pull generation`);
  const pulledGeneration = await postJson(baseUrl, "/api/generations/pull", {
    ids: [generationId],
  });
  assert(
    pulledGeneration.records?.[0]?.status === "succeeded",
    `${provider.name} pull did not find succeeded generation`,
    pulledGeneration,
  );

  console.log(`[${provider.name}] encrypted title (${model})`);
  const titlePayload = {
    fragment: {
      id: "fragment_smoke",
      content:
        "今天想到一个点：轻量记录比完整写作更重要，先把念头留下，之后总会找到展开的方法。",
    },
  };
  const titleOptions = {
    maxOutputTokens: 96,
  };
  const title = await postJson(
    baseUrl,
    "/api/generation-title",
    await encryptRequest(keys, {
      id: titleId,
      provider: provider.name,
      model,
      requestFingerprint: titleFingerprint({
        id: titleId,
        model,
        options: titleOptions,
        payload: titlePayload,
        provider: provider.name,
      }),
      encryptedApiKey: await encryptApiKey(keys, provider.apiKey),
      payload: titlePayload,
      options: titleOptions,
      timeoutMs: 120000,
    }),
  );
  assert(title.ok, `${provider.name} title returned ok=false`, title);
  assert(title.record?.status === "succeeded", `${provider.name} title did not succeed`, title);
  assert(typeof title.title === "string" && title.title.length > 0, "title is empty", title);

  console.log(`[${provider.name}] cleanup`);
  const cleaned = await postJson(baseUrl, "/api/generations/cleanup", {
    ids: [generationId, titleId],
  });
  assert(cleaned.ok, `${provider.name} cleanup returned ok=false`, cleaned);
}

async function startServer({ keys, port }) {
  const child = spawn(
    "npm",
    ["--workspace", "@essai/web", "run", "start", "--", "--port", String(port)],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        API_KEY_ENCRYPTION_PRIVATE_JWK: JSON.stringify(keys.apiPrivateJwk),
        REQUEST_ENCRYPTION_PRIVATE_JWK: JSON.stringify(keys.requestPrivateJwk),
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const logs = [];

  child.stdout.on("data", (chunk) => {
    pushLog(logs, chunk);
  });
  child.stderr.on("data", (chunk) => {
    pushLog(logs, chunk);
  });

  await waitForServer(`http://localhost:${port}`, logs, child);

  return child;
}

async function waitForServer(baseUrl, logs, child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60_000) {
    if (child.exitCode !== null) {
      throw withDetails("dev server exited before becoming ready", {
        exitCode: child.exitCode,
        logs,
      });
    }

    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
      if (response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until Next dev is ready.
    }

    await sleep(500);
  }

  throw withDetails("timed out waiting for dev server", { logs });
}

async function buildWeb() {
  console.log("Building @essai/web before smoke test...");

  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["--workspace", "@essai/web", "run", "build"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: "inherit",
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`web build failed with exit code ${code}`));
      }
    });
  });
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw withDetails(`POST ${path} failed with ${response.status}`, data);
  }

  return data;
}

async function postJsonExpectError(baseUrl, path, body, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = parseJson(text);

  if (response.status !== expectedStatus) {
    throw withDetails(
      `POST ${path} expected ${expectedStatus} but got ${response.status}`,
      data,
    );
  }

  return data;
}

async function getSseEvents(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "text/event-stream",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw withDetails(`GET ${path} failed with ${response.status}`, {
      body: await response.text(),
    });
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error(`GET ${path} returned no response body`);
  }

  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseSseEvent(block);

      if (event) {
        events.push(event);
      }

      if (
        event?.event === "generation.done" ||
        event?.event === "generation.pause" ||
        event?.event === "generation.error"
      ) {
        return events;
      }
    }
  }

  return events;
}

function parseSseEvent(block) {
  const lines = block.split("\n").filter((line) => !line.startsWith(":"));
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (!eventLine && dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.length > 0 ? parseJson(dataLines.join("\n")) : null,
    event: eventLine ? eventLine.slice(6).trim() : "message",
  };
}

async function createEncryptionKeys() {
  const [apiPair, requestPair] = await Promise.all([rsaPair(), rsaPair()]);

  return {
    apiPrivateJwk: await crypto.subtle.exportKey("jwk", apiPair.privateKey),
    apiPublicKey: apiPair.publicKey,
    requestPrivateJwk: await crypto.subtle.exportKey("jwk", requestPair.privateKey),
    requestPublicKey: requestPair.publicKey,
  };
}

async function encryptRequest(keys, innerRequest) {
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const aesRaw = await crypto.subtle.exportKey("raw", aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(JSON.stringify(innerRequest)),
  );
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    keys.requestPublicKey,
    aesRaw,
  );

  return {
    schemaVersion: 1,
    encryptedRequest: {
      alg: "A256GCM+RSA-OAEP-256",
      encryptedKey: toBase64Url(encryptedKey),
      iv: toBase64Url(iv),
      ciphertext: toBase64Url(ciphertext),
      encoding: "base64url",
    },
  };
}

async function encryptApiKey(keys, apiKey) {
  const ciphertext = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    keys.apiPublicKey,
    new TextEncoder().encode(apiKey),
  );

  return {
    alg: "RSA-OAEP-256",
    ciphertext: toBase64Url(ciphertext),
    encoding: "base64url",
  };
}

async function rsaPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

async function choosePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error(`No free port found from ${preferredPort} to ${preferredPort + 19}.`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function collectProviders(args) {
  return [
    providerFromArgs("openai", args.openaiKey, args.openaiModel),
    providerFromArgs("deepseek", args.deepseekKey, args.deepseekModel),
    providerFromArgs("anthropic", args.anthropicKey, args.anthropicModel),
  ].filter(Boolean);
}

function providerFromArgs(name, apiKey, model) {
  const envName = `${name.toUpperCase()}_API_KEY`;
  const resolvedKey = apiKey || process.env[envName];

  if (!resolvedKey) {
    return null;
  }

  return {
    apiKey: resolvedKey,
    model: model || process.env[`${name.toUpperCase()}_MODEL`] || providerDefaults[name],
    name,
  };
}

function parseArgs(argv) {
  const args = {};
  const booleanFlags = new Set(["build", "skipBuild"]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const key = camelCase(rawKey);
    const nextValue = argv[index + 1];
    const isBoolean = booleanFlags.has(key);
    const value =
      inlineValue ??
      (isBoolean || nextValue?.startsWith("--") ? "true" : nextValue);

    if (inlineValue === undefined && !isBoolean && !nextValue?.startsWith("--")) {
      index += 1;
    }

    if (isBoolean) {
      args[key] = value !== "false";
    } else if (key === "port") {
      args[key] = Number(value);
    } else {
      args[key] = value;
    }
  }

  return args;
}

function withDraftFingerprint({
  id,
  model,
  options,
  payload,
  provider,
}) {
  const generation = {
    id,
    payload,
  };

  return {
    ...generation,
    requestFingerprint: draftFingerprint({
      generation,
      model,
      options,
      provider,
    }),
  };
}

function draftFingerprint({ generation, model, options, provider }) {
  return requestFingerprint({
    generation: {
      id: generation.id,
      payload: generation.payload,
      title: generation.title ?? null,
    },
    kind: "draft",
    model: model ?? providerDefaults[provider],
    options,
    provider,
    schemaVersion: 1,
  });
}

function titleFingerprint({ id, model, options, payload, provider }) {
  return requestFingerprint({
    id,
    kind: "title",
    model: model ?? providerDefaults[provider],
    options,
    payload,
    provider,
    schemaVersion: 1,
  });
}

function requestFingerprint(value) {
  return `sha256:${createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")}`;
}

function stableStringify(value) {
  return JSON.stringify(normalizeStableValue(value));
}

function normalizeStableValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeStableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeStableValue(child)]),
    );
  }

  return value;
}

function sampleDraftPayload({ content } = {}) {
  return {
    fragment: {
      id: "fragment_smoke",
      content:
        content ??
        "今天想到一个点：轻量记录比完整写作更重要。很多时候不是没有想法，而是太早要求自己把想法做完整。",
    },
    scheme: {
      id: "scheme_smoke",
      title: "自然口播",
      content: "整理成一版自然、清楚、可以继续编辑的短口播初稿。",
    },
    laws: [
      {
        id: "law_smoke",
        title: "像正常说话",
        content: "保留自然语气，不要写得像课程大纲。",
      },
    ],
  };
}

function hasProductionBuild() {
  return existsSync(new URL("../packages/web/.next/BUILD_ID", import.meta.url));
}

function pushLog(logs, chunk) {
  logs.push(chunk.toString());
  while (logs.length > 40) {
    logs.shift();
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function assert(condition, message, details) {
  if (!condition) {
    throw withDetails(message, details);
  }
}

function withDetails(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
