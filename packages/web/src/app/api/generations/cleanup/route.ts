import { z } from "zod";
import { generationCleanupRequestSchema } from "@/lib/server/generation/schemas";
import {
  deleteGenerationRecords,
  getGenerationStoreMode,
} from "@/lib/server/generation/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const parsed = generationCleanupRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "invalid_request",
          message: z.prettifyError(parsed.error),
          providerStatus: null,
        },
        durationMs: Date.now() - startedAt,
      },
      { status: 400 },
    );
  }

  const result = await deleteGenerationRecords(parsed.data.ids);

  return Response.json({
    ok: true,
    ...result,
    store: getGenerationStoreMode(),
    durationMs: Date.now() - startedAt,
  });
}
