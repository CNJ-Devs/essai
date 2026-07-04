import {
  EnvHttpProxyAgent,
  fetch as undiciFetch,
} from "undici";
import type { ExecutionBudget } from "./budget";
import { GenerationRequestError } from "./errors";
import type { Provider, ProviderOptions } from "./schemas";

const proxyAgent = new EnvHttpProxyAgent();

export type ProviderResult = {
  content: string;
  usage: unknown | null;
};

export async function callGenerationProvider({
  apiKey,
  budget,
  instructions,
  model,
  options,
  prompt,
  provider,
}: {
  apiKey: string;
  budget: ExecutionBudget;
  instructions: string;
  model: string;
  options: ProviderOptions;
  prompt: string;
  provider: Provider;
}) {
  return runWithTimeout(
    (signal) => {
      switch (provider) {
        case "openai":
          return callOpenAI({
            apiKey,
            instructions,
            model,
            options,
            prompt,
            signal,
          });
        case "deepseek":
          return callDeepSeek({
            apiKey,
            instructions,
            model,
            options,
            prompt,
            signal,
          });
        case "anthropic":
          return callAnthropic({
            apiKey,
            instructions,
            model,
            options,
            prompt,
            signal,
          });
        default:
          throw new GenerationRequestError(
            "unsupported_provider",
            `Unsupported provider: ${provider}`,
            400,
            400,
          );
      }
    },
    budget.providerTimeoutMs,
    budget.providerTimeoutMessage,
  );
}

async function callOpenAI({
  apiKey,
  instructions,
  model,
  options,
  prompt,
  signal,
}: ProviderCallInput) {
  const body: Record<string, unknown> = {
    model,
    instructions,
    input: prompt,
    max_output_tokens: options.maxOutputTokens,
  };

  if (options.reasoningEffort && options.reasoningEffort !== "none") {
    body.reasoning = { effort: options.reasoningEffort };
  }

  const data = await postJson("openai", "https://api.openai.com/v1/responses", {
    apiKey,
    body,
    signal,
  });

  return {
    content: extractOpenAIText(data),
    usage: extractUsage(data),
  };
}

async function callDeepSeek({
  apiKey,
  instructions,
  model,
  options,
  prompt,
  signal,
}: ProviderCallInput) {
  const reasoningEffort =
    options.reasoningEffort === "xhigh" ? "high" : options.reasoningEffort;
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt },
    ],
    max_tokens: options.maxOutputTokens,
    stream: false,
  };

  if (typeof options.temperature === "number") {
    body.temperature = options.temperature;
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
    usage: extractUsage(data),
  };
}

async function callAnthropic({
  apiKey,
  instructions,
  model,
  options,
  prompt,
  signal,
}: ProviderCallInput) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxOutputTokens,
    system: instructions,
    messages: [{ role: "user", content: prompt }],
  };

  if (typeof options.temperature === "number" && !model.includes("sonnet-5")) {
    body.temperature = options.temperature;
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
    usage: extractUsage(data),
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
  const response = await undiciFetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(provider, apiKey),
      ...headers,
    },
    body: JSON.stringify(body),
    dispatcher: proxyAgent,
    signal,
  });
  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw new GenerationRequestError(
      `${provider}_request_failed`,
      extractProviderError(data) || response.statusText || "Provider request failed.",
      response.status < 500 ? 400 : 502,
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
    throw new GenerationRequestError("timed_out", timeoutMessage, 504, 504);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GenerationRequestError(
        "timed_out",
        timeoutMessage,
        504,
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
    throw new GenerationRequestError(
      "empty_provider_response",
      "OpenAI returned no text content.",
      502,
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
    throw new GenerationRequestError(
      "empty_provider_response",
      "Chat completion provider returned no text content.",
      502,
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
    throw new GenerationRequestError(
      "empty_provider_response",
      "Anthropic returned no text content.",
      502,
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

function extractUsage(data: unknown) {
  return (data as { usage?: unknown }).usage ?? null;
}

type ProviderCallInput = {
  apiKey: string;
  instructions: string;
  model: string;
  options: ProviderOptions;
  prompt: string;
  signal: AbortSignal;
};
