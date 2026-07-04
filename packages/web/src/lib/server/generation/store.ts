import { Redis } from "@upstash/redis";
import type { GenerationRecord } from "./schemas";
import { generationTtlSeconds } from "./schemas";

const keyPrefix = "essai:generation:";

declare global {
  var __essaiGenerationMemoryStore:
    | Map<
        string,
        {
          expiresAtMs: number;
          record: GenerationRecord;
        }
      >
    | undefined;
}

const memoryStore =
  globalThis.__essaiGenerationMemoryStore ??
  new Map<string, { expiresAtMs: number; record: GenerationRecord }>();

globalThis.__essaiGenerationMemoryStore = memoryStore;

const redis = hasRedisEnv() ? Redis.fromEnv() : null;

export async function saveGenerationRecord(
  record: GenerationRecord,
  ttlSeconds = generationTtlSeconds,
) {
  if (redis) {
    await redis.set(storageKey(record.id), record, { ex: ttlSeconds });
    return;
  }

  memoryStore.set(record.id, {
    expiresAtMs: Date.now() + ttlSeconds * 1000,
    record,
  });
}

export async function getGenerationRecords(ids: string[]) {
  const records: GenerationRecord[] = [];
  const missingIds: string[] = [];

  await Promise.all(
    ids.map(async (id) => {
      const record = await getGenerationRecord(id);

      if (record) {
        records.push(record);
      } else {
        missingIds.push(id);
      }
    }),
  );

  return { records, missingIds };
}

export async function getGenerationRecord(id: string) {
  const record = await getGenerationRecordRaw(id);

  if (!record) {
    return null;
  }

  if (isRecordCacheExpired(record)) {
    await deleteGenerationRecords([id]);
    return null;
  }

  if (isRecordPastDeadline(record)) {
    const timedOutRecord = buildTimedOutRecord(record);
    await saveGenerationRecord(timedOutRecord, remainingTtlSeconds(timedOutRecord));
    return timedOutRecord;
  }

  return record;
}

export async function deleteGenerationRecords(ids: string[]) {
  if (redis) {
    const deletedCount = await redis.del(...ids.map(storageKey));

    return {
      deletedIds: ids,
      deletedCount,
    };
  }

  let deletedCount = 0;

  for (const id of ids) {
    if (memoryStore.delete(id)) {
      deletedCount += 1;
    }
  }

  return {
    deletedIds: ids,
    deletedCount,
  };
}

export function getGenerationStoreMode() {
  return redis ? "upstash" : "memory";
}

async function getGenerationRecordRaw(id: string) {
  if (redis) {
    return redis.get<GenerationRecord>(storageKey(id));
  }

  const cached = memoryStore.get(id);

  if (!cached) {
    return null;
  }

  if (cached.expiresAtMs <= Date.now()) {
    memoryStore.delete(id);
    return null;
  }

  return cached.record;
}

export function isGenerationRecordTerminal(record: GenerationRecord) {
  return record.status === "succeeded" || record.status === "failed";
}

export function isRecordPastDeadline(record: GenerationRecord) {
  return (
    record.status === "running" &&
    Number.isFinite(Date.parse(record.deadlineAt)) &&
    Date.parse(record.deadlineAt) <= Date.now()
  );
}

export function buildTimedOutRecord(record: GenerationRecord): GenerationRecord {
  if (record.status !== "running") {
    return record;
  }

  return {
    ...record,
    status: "failed",
    error: {
      code: "generation_timeout",
      message: "Generation did not finish before its deadline.",
      providerStatus: null,
    },
    updatedAt: new Date().toISOString(),
  };
}

function isRecordCacheExpired(record: GenerationRecord) {
  return Number.isFinite(Date.parse(record.expiresAt))
    ? Date.parse(record.expiresAt) <= Date.now()
    : false;
}

function remainingTtlSeconds(record: GenerationRecord) {
  const expiresAt = Date.parse(record.expiresAt);

  if (!Number.isFinite(expiresAt)) {
    return generationTtlSeconds;
  }

  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

function storageKey(id: string) {
  return `${keyPrefix}${id}`;
}

function hasRedisEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}
