import { z } from "zod";
import { generationPullRequestSchema } from "@/lib/server/generation/schemas";
import { getGenerationRecords, getGenerationStoreMode } from "@/lib/server/generation/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const parsed = generationPullRequestSchema.safeParse(await request.json());

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

  const { records, missingIds } = await getGenerationRecords(parsed.data.ids);

  return Response.json({
    ok: true,
    records,
    missing: missingIds.map((id) => ({
      id,
      status: "expired",
    })),
    store: getGenerationStoreMode(),
    durationMs: Date.now() - startedAt,
  });
}
