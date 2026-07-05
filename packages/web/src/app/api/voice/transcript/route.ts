import { z } from "zod";
import { createExecutionBudget } from "@/lib/server/generation/budget";
import {
  decryptWithRequestKey,
  isLocalGenerationEnvironment,
  parseMaybeEncryptedBodyWithRequestKey,
} from "@/lib/server/generation/encryption";
import {
  GenerationRequestError,
  normalizeGenerationError,
} from "@/lib/server/generation/errors";
import { resolveProviderApiKey } from "@/lib/server/generation/keys";
import { callGenerationProvider } from "@/lib/server/generation/provider";
import { providerDefaults } from "@/lib/server/generation/schemas";
import { buildVoiceCleanupPrompt } from "@/lib/server/voice/prompts";
import {
  callVoiceTranscriptionProvider,
  type VoiceAudioInput,
} from "@/lib/server/voice/provider";
import {
  voiceSttProviderDefaults,
  voiceTranscriptRequestSchema,
  type CloudAudioTranscribeInfo,
  type VoiceTranscriptRequest,
} from "@/lib/server/voice/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const parsed = await parseVoiceTranscriptRequest(request);

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
    const transcribe = await resolveTranscript({
      budget,
      formData: parsed.formData,
      input,
      request,
      requestKey: parsed.requestKey,
    });
    const cleanup = input.cleanupInfo
      ? await cleanupTranscript({
          budget,
          input,
          rawText: transcribe.text,
          request,
        })
      : null;
    const finalText = cleanup?.text ?? transcribe.text;

    return Response.json({
      ok: true,
      id: input.id ?? null,
      transcript: {
        cleaned: cleanup?.text ?? null,
        final: finalText,
        raw: transcribe.text,
      },
      transcribe: {
        metadata: transcribe.metadata,
        model: transcribe.model,
        provider: transcribe.provider,
        usage: transcribe.usage,
      },
      cleanup: cleanup
        ? {
            metadata: cleanup.metadata,
            model: cleanup.model,
            provider: cleanup.provider,
            usage: cleanup.usage,
          }
        : null,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const failure = normalizeGenerationError(error);

    return jsonError({
      code: failure.code,
      message: failure.message,
      providerStatus: failure.providerStatus,
      status: failure.status,
      startedAt,
    });
  }
}

async function parseVoiceTranscriptRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawRequest = await readControlPart(formData);
    const parsed = await parseMaybeEncryptedBodyWithRequestKey(
      rawRequest,
      voiceTranscriptRequestSchema,
    );

    return { ...parsed, formData };
  }

  const parsed = await parseMaybeEncryptedBodyWithRequestKey(
    await request.json(),
    voiceTranscriptRequestSchema,
  );

  return { ...parsed, formData: null };
}

async function readControlPart(formData: FormData) {
  const part = formData.get("request") ?? formData.get("payload");

  if (!part) {
    throw new GenerationRequestError(
      "missing_request_part",
      "Multipart voice transcript requests must include a request part.",
      400,
      400,
    );
  }

  const text =
    typeof part === "string"
      ? part
      : isFileLike(part)
        ? await part.text()
        : "";

  try {
    return JSON.parse(text);
  } catch {
    throw new GenerationRequestError(
      "invalid_request_part",
      "The multipart request part must contain JSON.",
      400,
      400,
    );
  }
}

async function resolveTranscript({
  budget,
  formData,
  input,
  request,
  requestKey,
}: {
  budget: ReturnType<typeof createExecutionBudget>;
  formData: FormData | null;
  input: VoiceTranscriptRequest;
  request: Request;
  requestKey: CryptoKey | null;
}) {
  if (input.transcribeInfo.type === "native-text") {
    return {
      metadata: null,
      model: null,
      provider: "native" as const,
      text: input.transcribeInfo.payload.text,
      usage: null,
    };
  }

  const info = input.transcribeInfo;
  const apiKey = await resolveProviderApiKey({
    explicitApiKey: info.payload.apiKey,
    encryptedApiKey: info.payload.encryptedApiKey,
    provider: info.payload.provider,
    request,
  });
  const audio = await readAudioInput({
    formData,
    info,
    requestKey,
  });
  const model =
    info.payload.model || voiceSttProviderDefaults[info.payload.provider];
  const result = await callVoiceTranscriptionProvider({
    apiKey,
    audio,
    budget,
    model,
    options: info.payload.options,
    provider: info.payload.provider,
  });

  return {
    metadata: result.metadata,
    model,
    provider: info.payload.provider,
    text: result.text,
    usage: result.usage,
  };
}

async function readAudioInput({
  formData,
  info,
  requestKey,
}: {
  formData: FormData | null;
  info: CloudAudioTranscribeInfo;
  requestKey: CryptoKey | null;
}): Promise<VoiceAudioInput> {
  if (!formData) {
    throw new GenerationRequestError(
      "multipart_required",
      "Cloud audio transcription requests must use multipart/form-data.",
      400,
      400,
    );
  }

  const audioConfig = info.payload.audio;
  const part = formData.get(audioConfig.field);

  if (!isFileLike(part)) {
    throw new GenerationRequestError(
      "missing_audio_part",
      `Multipart voice transcript requests must include an audio part named "${audioConfig.field}".`,
      400,
      400,
    );
  }

  let bytes = await part.arrayBuffer();

  if (audioConfig.encryption) {
    if (!requestKey) {
      throw new GenerationRequestError(
        "encrypted_audio_requires_encrypted_request",
        "Encrypted audio requires an encrypted request envelope.",
        400,
        400,
      );
    }

    bytes = await decryptWithRequestKey({
      ciphertext: bytes,
      encoding: audioConfig.encryption.encoding,
      iv: audioConfig.encryption.iv,
      requestKey,
    });
  } else if (!isLocalGenerationEnvironment()) {
    throw new GenerationRequestError(
      "encrypted_audio_required",
      "Encrypted audio is required outside local environment.",
      400,
      400,
    );
  }

  return {
    bytes,
    contentType:
      audioConfig.contentType || part.type || "application/octet-stream",
    filename: audioConfig.filename || part.name || "voice-input.webm",
  };
}

async function cleanupTranscript({
  budget,
  input,
  rawText,
  request,
}: {
  budget: ReturnType<typeof createExecutionBudget>;
  input: VoiceTranscriptRequest;
  rawText: string;
  request: Request;
}) {
  const cleanupInfo = input.cleanupInfo;

  if (!cleanupInfo) return null;

  const apiKey = await resolveProviderApiKey({
    explicitApiKey: cleanupInfo.apiKey,
    encryptedApiKey: cleanupInfo.encryptedApiKey,
    provider: cleanupInfo.provider,
    request,
  });
  const model =
    cleanupInfo.model || providerDefaults[cleanupInfo.provider];
  const prompt = buildVoiceCleanupPrompt(rawText);
  const result = await callGenerationProvider({
    apiKey,
    budget,
    instructions: prompt.instructions,
    model,
    options: cleanupInfo.options,
    prompt: prompt.prompt,
    provider: cleanupInfo.provider,
  });

  return {
    metadata: {
      promptChars: prompt.promptChars,
      promptTemplateVersion: prompt.promptTemplateVersion,
    },
    model,
    provider: cleanupInfo.provider,
    text: result.content,
    usage: result.usage,
  };
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "text" in value
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
  providerStatus?: number | null;
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
