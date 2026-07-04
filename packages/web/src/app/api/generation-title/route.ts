import { z } from "zod";
import { createExecutionBudget } from "@/lib/server/generation/budget";
import { parseMaybeEncryptedBody } from "@/lib/server/generation/encryption";
import { normalizeGenerationError } from "@/lib/server/generation/errors";
import { resolveProviderApiKey } from "@/lib/server/generation/keys";
import { callGenerationProvider } from "@/lib/server/generation/provider";
import {
  buildTitleGenerationPrompt,
  normalizeGeneratedTitle,
} from "@/lib/server/generation/prompts";
import {
  generationSchemaVersion,
  providerDefaults,
  titleCreateRequestSchema,
  type GenerationError,
  type GenerationRecord,
} from "@/lib/server/generation/schemas";
import {
  buildTimedOutRecord,
  getGenerationStoreMode,
  isRecordPastDeadline,
  saveGenerationRecord,
} from "@/lib/server/generation/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const parsed = await parseMaybeEncryptedBody(
      await request.json(),
      titleCreateRequestSchema,
    );

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
    const expiresAt = new Date(startedAt + input.ttlSeconds * 1000).toISOString();
    const apiKey = await resolveProviderApiKey({
      explicitApiKey: input.apiKey,
      encryptedApiKey: input.encryptedApiKey,
      provider: input.provider,
      request,
    });
    const runningRecord = buildTitleRecord({
      budget,
      expiresAt,
      input,
      model,
      status: "running",
    });

    await saveGenerationRecord(runningRecord, input.ttlSeconds);

    try {
      const prompt = buildTitleGenerationPrompt(input.payload);
      const result = await callGenerationProvider({
        apiKey,
        budget,
        instructions: prompt.instructions,
        model,
        options: input.options,
        prompt: prompt.prompt,
        provider: input.provider,
      });
      const title = normalizeGeneratedTitle(result.content);
      const succeededRecord: GenerationRecord = {
        ...runningRecord,
        status: "succeeded",
        title,
        output: {
          content: title,
          promptChars: prompt.promptChars,
          promptTemplateVersion: prompt.promptTemplateVersion,
          usage: result.usage,
        },
        updatedAt: new Date().toISOString(),
      };
      const finalRecord = isRecordPastDeadline(runningRecord)
        ? buildTimedOutRecord(runningRecord)
        : succeededRecord;

      await saveGenerationRecord(finalRecord, input.ttlSeconds);

      return Response.json({
        ok: finalRecord.status === "succeeded",
        id: input.id,
        title: finalRecord.status === "succeeded" ? title : null,
        record: finalRecord,
        store: getGenerationStoreMode(),
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const failure = normalizeGenerationError(error);
      const failedRecord: GenerationRecord = {
        ...runningRecord,
        status: "failed",
        error: toGenerationError(failure),
        updatedAt: new Date().toISOString(),
      };

      await saveGenerationRecord(failedRecord, input.ttlSeconds);

      return Response.json({
        ok: false,
        id: input.id,
        error: failedRecord.error,
        record: failedRecord,
        store: getGenerationStoreMode(),
        durationMs: Date.now() - startedAt,
      });
    }
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

function buildTitleRecord({
  budget,
  expiresAt,
  input,
  model,
  status,
}: {
  budget: ReturnType<typeof createExecutionBudget>;
  expiresAt: string;
  input: z.infer<typeof titleCreateRequestSchema>;
  model: string;
  status: GenerationRecord["status"];
}): GenerationRecord {
  const now = new Date().toISOString();

  return {
    schemaVersion: generationSchemaVersion,
    id: input.id,
    kind: "title",
    status,
    title: null,
    provider: input.provider,
    model,
    payload: input.payload,
    output: null,
    error: null,
    workflowTimeoutMs: budget.workflowTimeoutMs,
    providerTimeoutMs: budget.providerTimeoutMs,
    finalizationReserveMs: budget.finalizationReserveMs,
    deadlineAt: new Date(budget.deadlineAt).toISOString(),
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
}

function toGenerationError(error: {
  code: string;
  message: string;
  providerStatus: number | null;
}): GenerationError {
  return {
    code: error.code,
    message: error.message,
    providerStatus: error.providerStatus,
  };
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
