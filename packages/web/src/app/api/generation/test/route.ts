import { z } from "zod";
import {
  EnvHttpProxyAgent,
  fetch as undiciFetch,
} from "undici";
import { PROMPT_TEMPLATE_VERSION, buildDraftPrompt } from "@/lib/ai/prompt";
import { copy } from "@/lib/i18n";
import type { Fragment, SchemeSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const ROUTE_MAX_DURATION_MS = maxDuration * 1000;
const ROUTE_TERMINATION_BUFFER_MS = 60_000;
const MAX_TIMEOUT_MS = ROUTE_MAX_DURATION_MS - ROUTE_TERMINATION_BUFFER_MS;
const DEFAULT_TIMEOUT_MS = MAX_TIMEOUT_MS;
const FINALIZATION_RESERVE_MS = 15_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1800;

const providerSchema = z.enum(["mock", "openai", "deepseek", "anthropic"]);
type Provider = z.infer<typeof providerSchema>;

const requestSchema = z.object({
  provider: providerSchema.default("mock"),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().optional(),
  fragment: z.object({
    title: z.string().trim().optional(),
    content: z.string().trim().min(1),
  }),
  scheme: z
    .object({
      title: z.string().trim().min(1),
      content: z.string().trim().min(1),
    })
    .optional(),
  laws: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        content: z.string().trim().min(1),
      }),
    )
    .default([]),
  maxOutputTokens: z
    .number()
    .int()
    .min(64)
    .max(8192)
    .default(DEFAULT_MAX_OUTPUT_TOKENS),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(MAX_TIMEOUT_MS)
    .default(DEFAULT_TIMEOUT_MS),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh"]).optional(),
  debug: z.boolean().default(false),
  mock: z
    .object({
      delayMs: z.number().int().min(0).max(MAX_TIMEOUT_MS).default(0),
      fail: z.boolean().default(false),
    })
    .default({ delayMs: 0, fail: false }),
});

const providerDefaults: Record<Provider, string> = {
  mock: "mock-essai-draft-v1",
  openai: "gpt-5.4-mini",
  deepseek: "deepseek-v4-pro",
  anthropic: "claude-sonnet-5",
};
const proxyAgent = new EnvHttpProxyAgent();

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "/api/generation/test",
    defaults: providerDefaults,
    timeout: {
      defaultWorkflowTimeoutMs: DEFAULT_TIMEOUT_MS,
      maxWorkflowTimeoutMs: MAX_TIMEOUT_MS,
      routeMaxDurationMs: ROUTE_MAX_DURATION_MS,
      routeTerminationBufferMs: ROUTE_TERMINATION_BUFFER_MS,
      finalizationReserveMs: FINALIZATION_RESERVE_MS,
    },
    providers: {
      mock: {
        description: "Local fake provider for timeout and shape testing.",
      },
      openai: {
        defaultModel: providerDefaults.openai,
        recommendedUpgrade: "gpt-5.4",
      },
      deepseek: {
        defaultModel: providerDefaults.deepseek,
        fasterModel: "deepseek-v4-flash",
      },
      anthropic: {
        defaultModel: providerDefaults.anthropic,
      },
    },
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const parsed = requestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError({
        code: "invalid_request",
        message: z.prettifyError(parsed.error),
        status: 400,
        startedAt,
      });
    }

    const input = parsed.data;
    const budget = createExecutionBudget(startedAt, input.timeoutMs);
    const model = input.model || providerDefaults[input.provider];
    const { fragment, snapshot } = buildPromptInput(input);
    const prompt = buildDraftPrompt(fragment, snapshot);
    const instructions = copy.ai.draftInstructions;
    const apiKey = getApiKey(request, input.provider, input.apiKey);

    const result =
      input.provider === "mock"
        ? await runWithTimeout(
            (signal) =>
              callMockProvider({
                delayMs: input.mock.delayMs,
                fail: input.mock.fail,
                fragment,
                model,
                signal,
                snapshot,
              }),
            budget.providerTimeoutMs,
            budget.providerTimeoutMessage,
          )
        : await runWithTimeout(
            (signal) =>
              callProvider({
                apiKey,
                input,
                instructions,
                model,
                prompt,
                signal,
              }),
            budget.providerTimeoutMs,
            budget.providerTimeoutMessage,
          );

    assertBudgetRemaining(budget);

    return Response.json({
      ok: true,
      provider: input.provider,
      model,
      durationMs: Date.now() - startedAt,
      workflowTimeoutMs: budget.workflowTimeoutMs,
      providerTimeoutMs: budget.providerTimeoutMs,
      finalizationReserveMs: budget.finalizationReserveMs,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      promptChars: prompt.length,
      content: result.content,
      usage: result.usage ?? null,
      ...(input.debug ? { debug: { instructions, prompt } } : {}),
    });
  } catch (error) {
    const providerError = normalizeError(error);

    return jsonError({
      code: providerError.code,
      message: providerError.message,
      providerStatus: providerError.status,
      status: providerError.status && providerError.status < 500 ? 400 : 502,
      startedAt,
    });
  }
}

function createExecutionBudget(startedAt: number, requestedTimeoutMs: number) {
  const workflowTimeoutMs = Math.min(requestedTimeoutMs, MAX_TIMEOUT_MS);
  const finalizationReserveMs =
    workflowTimeoutMs < 10_000
      ? 0
      : Math.min(FINALIZATION_RESERVE_MS, Math.floor(workflowTimeoutMs * 0.1));
  const providerTimeoutMs = workflowTimeoutMs - finalizationReserveMs;

  return {
    startedAt,
    workflowTimeoutMs,
    providerTimeoutMs,
    finalizationReserveMs,
    deadlineAt: startedAt + workflowTimeoutMs,
    providerTimeoutMessage: [
      `Provider call exceeded its ${providerTimeoutMs}ms budget.`,
      `The full workflow budget is ${workflowTimeoutMs}ms,`,
      `with ${finalizationReserveMs}ms reserved for final writes and notifications.`,
    ].join(" "),
  };
}

function assertBudgetRemaining(budget: ReturnType<typeof createExecutionBudget>) {
  if (Date.now() > budget.deadlineAt) {
    throw new ProviderRequestError(
      "workflow_timed_out",
      `Generation workflow exceeded its ${budget.workflowTimeoutMs}ms budget before finalization.`,
      504,
    );
  }
}

function buildPromptInput(input: z.infer<typeof requestSchema>) {
  const now = new Date().toISOString();
  const fragment: Fragment = {
    id: "test-fragment",
    userId: "test-user",
    title: input.fragment.title || "New Piece",
    titleSource: input.fragment.title ? "user" : "ai",
    content: input.fragment.content,
    createdAt: now,
    updatedAt: now,
  };
  const snapshot: SchemeSnapshot = {
    schemeId: "test-scheme",
    schemeName: input.scheme?.title || "自由初稿",
    schemeDescription:
      input.scheme?.content ||
      "把碎片整理成一版可继续编辑的初稿，保留自然语气和清晰判断。",
    laws: input.laws
      .map((law, index) => ({
        lawId: `test-law-${index + 1}`,
        name: law.title,
        prompt: law.content,
      }))
      .filter((law) => law.prompt),
    snapshottedAt: now,
  };

  return { fragment, snapshot };
}

function getApiKey(request: Request, provider: Provider, bodyApiKey?: string) {
  if (provider === "mock") {
    return "";
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerKey = request.headers.get("x-provider-api-key")?.trim();
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`]?.trim();
  const apiKey = bodyApiKey || headerKey || bearer || envKey;

  if (!apiKey) {
    throw new ProviderRequestError(
      "missing_api_key",
      `Missing API key for ${provider}. Pass apiKey, Authorization: Bearer, x-provider-api-key, or ${provider.toUpperCase()}_API_KEY.`,
      401,
    );
  }

  return apiKey;
}

async function callProvider({
  apiKey,
  input,
  instructions,
  model,
  prompt,
  signal,
}: {
  apiKey: string;
  input: z.infer<typeof requestSchema>;
  instructions: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
}) {
  switch (input.provider) {
    case "openai":
      return callOpenAI({
        apiKey,
        input,
        instructions,
        model,
        prompt,
        signal,
      });
    case "deepseek":
      return callDeepSeek({
        apiKey,
        input,
        instructions,
        model,
        prompt,
        signal,
      });
    case "anthropic":
      return callAnthropic({
        apiKey,
        input,
        instructions,
        model,
        prompt,
        signal,
      });
    default:
      throw new ProviderRequestError(
        "unsupported_provider",
        `Unsupported provider: ${input.provider}`,
        400,
      );
  }
}

async function callOpenAI({
  apiKey,
  input,
  instructions,
  model,
  prompt,
  signal,
}: ProviderCallInput) {
  const body: Record<string, unknown> = {
    model,
    instructions,
    input: prompt,
    max_output_tokens: input.maxOutputTokens,
  };

  if (input.reasoningEffort && input.reasoningEffort !== "none") {
    body.reasoning = { effort: input.reasoningEffort };
  }

  const data = await postJson("openai", "https://api.openai.com/v1/responses", {
    apiKey,
    body,
    signal,
  });

  return {
    content: extractOpenAIText(data),
    usage: data.usage,
  };
}

async function callDeepSeek({
  apiKey,
  input,
  instructions,
  model,
  prompt,
  signal,
}: ProviderCallInput) {
  const reasoningEffort =
    input.reasoningEffort === "xhigh" ? "high" : input.reasoningEffort;
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt },
    ],
    max_tokens: input.maxOutputTokens,
    stream: false,
  };

  if (typeof input.temperature === "number") {
    body.temperature = input.temperature;
  }

  if (reasoningEffort && reasoningEffort !== "none") {
    body.reasoning_effort = reasoningEffort;
    body.thinking = { type: "enabled" };
  }

  const data = await postJson(
    "deepseek",
    "https://api.deepseek.com/chat/completions",
    {
      apiKey,
      body,
      signal,
    },
  );

  return {
    content: extractChatCompletionText(data),
    usage: data.usage,
  };
}

async function callAnthropic({
  apiKey,
  input,
  instructions,
  model,
  prompt,
  signal,
}: ProviderCallInput) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: input.maxOutputTokens,
    system: instructions,
    messages: [{ role: "user", content: prompt }],
  };

  if (typeof input.temperature === "number" && !model.includes("sonnet-5")) {
    body.temperature = input.temperature;
  }

  const data = await postJson("anthropic", "https://api.anthropic.com/v1/messages", {
    apiKey,
    body,
    headers: {
      "anthropic-version": "2023-06-01",
    },
    signal,
  });

  return {
    content: extractAnthropicText(data),
    usage: data.usage,
  };
}

async function callMockProvider({
  delayMs,
  fail,
  fragment,
  model,
  signal,
  snapshot,
}: {
  delayMs: number;
  fail: boolean;
  fragment: Fragment;
  model: string;
  signal: AbortSignal;
  snapshot: SchemeSnapshot;
}) {
  await sleep(delayMs, signal);

  if (fail) {
    throw new ProviderRequestError(
      "mock_failed",
      "Mock provider was asked to fail.",
      500,
    );
  }

  return {
    content: [
      "标题建议",
      fragment.title,
      "",
      "内容定位",
      `这是一版基于「${snapshot.schemeName}」整理出的测试初稿。`,
      "",
      "正文成稿",
      fragment.content,
    ].join("\n"),
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      model,
    },
  };
}

async function postJson(
  provider: Provider,
  url: string,
  {
    apiKey,
    body,
    headers = {},
    signal,
  }: {
    apiKey: string;
    body: Record<string, unknown>;
    headers?: Record<string, string>;
    signal: AbortSignal;
  },
) {
  const requestHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...authHeaders(provider, apiKey),
    ...headers,
  };

  const response = await undiciFetch(url, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
    dispatcher: proxyAgent,
    signal,
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw new ProviderRequestError(
      `${provider}_request_failed`,
      extractProviderError(data) || response.statusText || "Provider request failed.",
      response.status,
    );
  }

  return data;
}

function authHeaders(provider: Provider, apiKey: string): Record<string, string> {
  if (provider === "anthropic") {
    return { "x-api-key": apiKey };
  }

  return { authorization: `Bearer ${apiKey}` };
}

async function runWithTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  if (timeoutMs <= 0) {
    throw new ProviderRequestError("timed_out", timeoutMessage, 504);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProviderRequestError(
        "timed_out",
        timeoutMessage,
        504,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function extractOpenAIText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };

  if (response.output_text) {
    return response.output_text.trim();
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new ProviderRequestError(
      "empty_provider_response",
      "OpenAI returned no text content.",
      502,
    );
  }

  return text;
}

function extractChatCompletionText(data: unknown) {
  const text = (
    data as { choices?: Array<{ message?: { content?: string } }> }
  ).choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new ProviderRequestError(
      "empty_provider_response",
      "Chat completion provider returned no text content.",
      502,
    );
  }

  return text;
}

function extractAnthropicText(data: unknown) {
  const text = (
    data as { content?: Array<{ type?: string; text?: string }> }
  ).content
    ?.map((item) => item.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new ProviderRequestError(
      "empty_provider_response",
      "Anthropic returned no text content.",
      502,
    );
  }

  return text;
}

function parseJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function extractProviderError(data: unknown) {
  const value = data as {
    error?: string | { message?: string; type?: string };
    message?: string;
  };

  if (typeof value.error === "string") {
    return value.error;
  }

  return value.error?.message || value.message;
}

function normalizeError(error: unknown) {
  if (error instanceof ProviderRequestError) {
    return error;
  }

  if (error instanceof Error) {
    return new ProviderRequestError("generation_failed", error.message, 500);
  }

  return new ProviderRequestError(
    "generation_failed",
    "Generation failed.",
    500,
  );
}

function jsonError({
  code,
  message,
  providerStatus,
  startedAt,
  status,
}: {
  code: string;
  message: string;
  providerStatus?: number;
  startedAt: number;
  status: number;
}) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        providerStatus: providerStatus ?? null,
      },
      durationMs: Date.now() - startedAt,
    },
    { status },
  );
}

type ProviderCallInput = {
  apiKey: string;
  input: z.infer<typeof requestSchema>;
  instructions: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
};

class ProviderRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
