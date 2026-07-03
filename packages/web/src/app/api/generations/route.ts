import { z } from "zod";
import { createExecutionBudget } from "@/lib/server/generation/budget";
import { normalizeGenerationError } from "@/lib/server/generation/errors";
import { resolveProviderApiKey } from "@/lib/server/generation/keys";
import { callGenerationProvider } from "@/lib/server/generation/provider";
import { buildDraftGenerationPrompt } from "@/lib/server/generation/prompts";
import {
  generationCreateRequestSchema,
  generationSchemaVersion,
  providerDefaults,
  type GenerationError,
  type GenerationInput,
  type GenerationRecord,
} from "@/lib/server/generation/schemas";
import {
  getGenerationStoreMode,
  saveGenerationRecord,
} from "@/lib/server/generation/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const parsed = generationCreateRequestSchema.safeParse(await request.json());

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

    await Promise.all(
      input.generations.map((generation) =>
        saveGenerationRecord(
          buildDraftRecord({
            budget,
            expiresAt,
            generation,
            model,
            provider: input.provider,
            status: "queued",
          }),
          input.ttlSeconds,
        ),
      ),
    );

    const records = await Promise.all(
      input.generations.map(async (generation) => {
        const runningRecord = buildDraftRecord({
          budget,
          expiresAt,
          generation,
          model,
          provider: input.provider,
          status: "running",
        });

        await saveGenerationRecord(runningRecord, input.ttlSeconds);

        try {
          const prompt = buildDraftGenerationPrompt(generation.payload);
          const result = await callGenerationProvider({
            apiKey,
            budget,
            instructions: prompt.instructions,
            model,
            options: input.options,
            prompt: prompt.prompt,
            provider: input.provider,
          });
          const succeededRecord: GenerationRecord = {
            ...runningRecord,
            status: "succeeded",
            output: {
              content: result.content,
              promptChars: prompt.promptChars,
              promptTemplateVersion: prompt.promptTemplateVersion,
              usage: result.usage,
            },
            updatedAt: new Date().toISOString(),
          };

          await saveGenerationRecord(succeededRecord, input.ttlSeconds);
          return succeededRecord;
        } catch (error) {
          const failure = normalizeGenerationError(error);
          const failedRecord: GenerationRecord = {
            ...runningRecord,
            status: "failed",
            error: toGenerationError(failure),
            updatedAt: new Date().toISOString(),
          };

          await saveGenerationRecord(failedRecord, input.ttlSeconds);
          return failedRecord;
        }
      }),
    );

    return Response.json({
      ok: true,
      ids: records.map((record) => record.id),
      records,
      store: getGenerationStoreMode(),
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

function buildDraftRecord({
  budget,
  expiresAt,
  generation,
  model,
  provider,
  status,
}: {
  budget: ReturnType<typeof createExecutionBudget>;
  expiresAt: string;
  generation: GenerationInput;
  model: string;
  provider: GenerationRecord["provider"];
  status: GenerationRecord["status"];
}): GenerationRecord {
  const now = new Date().toISOString();

  return {
    schemaVersion: generationSchemaVersion,
    id: generation.id,
    kind: "draft",
    status,
    title: generation.title ?? null,
    provider,
    model,
    payload: generation.payload,
    output: null,
    error: null,
    workflowTimeoutMs: budget.workflowTimeoutMs,
    providerTimeoutMs: budget.providerTimeoutMs,
    finalizationReserveMs: budget.finalizationReserveMs,
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
