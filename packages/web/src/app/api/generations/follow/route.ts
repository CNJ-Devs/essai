import { z } from "zod";
import { generationFollowRequestSchema } from "@/lib/server/generation/schemas";
import {
  getGenerationRecords,
  getGenerationStoreMode,
  isGenerationRecordTerminal,
} from "@/lib/server/generation/store";

export const runtime = "nodejs";
export const maxDuration = 300;

const encoder = new TextEncoder();
const maxFollowDurationMs = 285_000;
const heartbeatMs = 15_000;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const parsed = generationFollowRequestSchema.safeParse(
    parseFollowRequest(request),
  );

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

  const { ids, intervalMs } = parsed.data;

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const terminalIds = new Set<string>();
        const emittedState = new Map<string, string>();
        let lastHeartbeatAt = Date.now();

        const emit = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        const heartbeat = () => {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
          lastHeartbeatAt = Date.now();
        };

        try {
          emit("generation.ready", {
            ids,
            ok: true,
            startedAt: new Date(startedAt).toISOString(),
            store: getGenerationStoreMode(),
          });

          while (
            !request.signal.aborted &&
            terminalIds.size < ids.length &&
            Date.now() - startedAt < maxFollowDurationMs
          ) {
            const pendingIds = ids.filter((id) => !terminalIds.has(id));
            const { records, missingIds } = await getGenerationRecords(pendingIds);

            for (const record of records) {
              const stateKey = [
                record.status,
                record.updatedAt,
                record.error?.code ?? "",
              ].join(":");

              if (emittedState.get(record.id) !== stateKey) {
                emittedState.set(record.id, stateKey);
                emit("generation.record", { record });
              }

              if (isGenerationRecordTerminal(record)) {
                terminalIds.add(record.id);
              }
            }

            for (const id of missingIds) {
              if (emittedState.get(id) !== "expired") {
                emittedState.set(id, "expired");
                emit("generation.expired", {
                  id,
                  status: "expired",
                });
              }

              terminalIds.add(id);
            }

            if (terminalIds.size >= ids.length) {
              emit("generation.done", {
                durationMs: Date.now() - startedAt,
                ids,
                ok: true,
                pending: [],
              });
              break;
            }

            if (Date.now() - lastHeartbeatAt >= heartbeatMs) {
              heartbeat();
            }

            await sleep(intervalMs, request.signal);
          }

          if (!request.signal.aborted && terminalIds.size < ids.length) {
            emit("generation.pause", {
              durationMs: Date.now() - startedAt,
              ids,
              ok: true,
              pending: ids.filter((id) => !terminalIds.has(id)),
              reason: "follow_timeout",
            });
          }
        } catch (error) {
          if (!request.signal.aborted) {
            emit("generation.error", {
              error: {
                code: "follow_failed",
                message:
                  error instanceof Error
                    ? error.message
                    : "Generation follow stream failed.",
                providerStatus: null,
              },
              ok: false,
            });
          }
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
      },
    },
  );
}

function parseFollowRequest(request: Request) {
  const url = new URL(request.url);
  const ids = [
    ...url.searchParams.getAll("id"),
    ...url.searchParams.getAll("ids").flatMap((value) => value.split(",")),
  ]
    .map((id) => id.trim())
    .filter(Boolean);
  const intervalMs = Number(url.searchParams.get("intervalMs"));

  return {
    ids,
    intervalMs: Number.isFinite(intervalMs) ? intervalMs : undefined,
  };
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      resolve();
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
