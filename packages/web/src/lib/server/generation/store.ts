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

async function getGenerationRecord(id: string) {
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

function storageKey(id: string) {
  return `${keyPrefix}${id}`;
}

function hasRedisEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}
