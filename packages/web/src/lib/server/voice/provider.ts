import {
  EnvHttpProxyAgent,
  fetch as undiciFetch,
} from "undici";
import type { ExecutionBudget } from "../generation/budget";
import { GenerationRequestError } from "../generation/errors";
import type {
  VoiceSttProvider,
  VoiceTranscribeOptions,
} from "./schemas";

const proxyAgent = new EnvHttpProxyAgent();

export type VoiceAudioInput = {
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
};

export type VoiceTranscriptProviderResult = {
  metadata: unknown | null;
  text: string;
  usage: unknown | null;
};

export async function callVoiceTranscriptionProvider({
  apiKey,
  audio,
  budget,
  model,
  options,
  provider,
}: {
  apiKey: string;
  audio: VoiceAudioInput;
  budget: ExecutionBudget;
  model: string;
  options: VoiceTranscribeOptions;
  provider: VoiceSttProvider;
}) {
  return runWithTimeout(
    (signal) => {
      switch (provider) {
        case "openai":
          return callOpenAITranscription({
            apiKey,
            audio,
            model,
            options,
            signal,
          });
        case "elevenlabs":
          return callElevenLabsTranscription({
            apiKey,
            audio,
            model,
            options,
            signal,
          });
        default:
          throw new GenerationRequestError(
            "unsupported_provider",
            `Unsupported voice provider: ${provider}`,
            400,
            400,
          );
      }
    },
    budget.providerTimeoutMs,
    budget.providerTimeoutMessage,
  );
}

async function callOpenAITranscription({
  apiKey,
  audio,
  model,
  options,
  signal,
}: VoiceProviderCallInput) {
  const formData = createAudioFormData(audio, "file");

  formData.append("model", model);
  formData.append("response_format", options.diarize ? "diarized_json" : "json");

  if (options.language) {
    formData.append("language", options.language);
  }

  if (options.prompt && !options.diarize) {
    formData.append("prompt", options.prompt);
  }

  if (options.diarize) {
    formData.append("chunking_strategy", "auto");
  }

  if (options.timestamps === "word") {
    formData.append("timestamp_granularities[]", "word");
  }

  const data = await postForm("openai", "https://api.openai.com/v1/audio/transcriptions", {
    apiKey,
    formData,
    signal,
  });

  return {
    metadata: data,
    text: extractTranscriptText(data, "OpenAI"),
    usage: extractUsage(data),
  };
}

async function callElevenLabsTranscription({
  apiKey,
  audio,
  model,
  options,
  signal,
}: VoiceProviderCallInput) {
  const formData = createAudioFormData(audio, "file");

  formData.append("model_id", model);

  if (options.language) {
    formData.append("language_code", options.language);
  }

  if (typeof options.diarize === "boolean") {
    formData.append("diarize", String(options.diarize));
  }

  if (options.timestamps === "word" || options.timestamps === "character") {
    formData.append("timestamps_granularity", options.timestamps);
  }

  const data = await postForm(
    "elevenlabs",
    "https://api.elevenlabs.io/v1/speech-to-text",
    {
      apiKey,
      formData,
      signal,
    },
  );

  return {
    metadata: data,
    text: extractTranscriptText(data, "ElevenLabs"),
    usage: extractUsage(data),
  };
}

function createAudioFormData(audio: VoiceAudioInput, fieldName: string) {
  const formData = new FormData();
  const blob = new Blob([audio.bytes], { type: audio.contentType });

  formData.append(fieldName, blob, audio.filename);
  return formData;
}

async function postForm(
  provider: VoiceSttProvider,
  url: string,
  {
    apiKey,
    formData,
    signal,
  }: {
    apiKey: string;
    formData: FormData;
    signal: AbortSignal;
  },
) {
  const response = await undiciFetch(url, {
    body: formData as never,
    dispatcher: proxyAgent,
    headers: authHeaders(provider, apiKey),
    method: "POST",
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

function authHeaders(
  provider: VoiceSttProvider,
  apiKey: string,
): Record<string, string> {
  if (provider === "elevenlabs") {
    return { "xi-api-key": apiKey };
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

function extractTranscriptText(data: unknown, providerName: string) {
  const value = data as {
    segments?: Array<{ text?: string }>;
    text?: string;
  };
  const text =
    value.text?.trim() ||
    value.segments
      ?.map((segment) => segment.text)
      .filter(Boolean)
      .join("\n")
      .trim();

  if (!text) {
    throw new GenerationRequestError(
      "empty_provider_response",
      `${providerName} returned no transcript text.`,
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
    detail?: string | { message?: string };
    error?: string | { message?: string; type?: string };
    message?: string;
  };

  if (typeof value.error === "string") {
    return value.error;
  }

  if (typeof value.detail === "string") {
    return value.detail;
  }

  return value.error?.message || value.detail?.message || value.message;
}

function extractUsage(data: unknown) {
  return (data as { usage?: unknown }).usage ?? null;
}

type VoiceProviderCallInput = {
  apiKey: string;
  audio: VoiceAudioInput;
  model: string;
  options: VoiceTranscribeOptions;
  signal: AbortSignal;
};
