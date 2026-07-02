import { z } from "zod";
import type {
  DraftVersionSnapshot,
  RevisionDraftSnapshot,
  RevisionSnapshotContent,
  SchemeDraftSnapshot,
  SchemeSnapshot,
} from "@/lib/types";

const snapshotEnvelopeSchema = z.object({
  type: z.string(),
  version: z.number(),
  content: z.unknown(),
});

const schemeLawSnapshotSchema = z.object({
  lawId: z.string(),
  name: z.string(),
  prompt: z.string(),
});

export const schemeSnapshotContentV1Schema = z.object({
  schemeId: z.string(),
  schemeName: z.string(),
  schemeDescription: z.string(),
  laws: z.array(schemeLawSnapshotSchema),
  snapshottedAt: z.string(),
});

export const revisionSnapshotContentV1Schema = z.object({
  sourceVersionId: z.string(),
  sourceVersionNo: z.number(),
  sourceContent: z.string(),
  instruction: z.string(),
  schemeSnapshot: schemeSnapshotContentV1Schema,
  snapshottedAt: z.string(),
});

export type DraftSnapshotParseResult =
  | { ok: true; data: DraftVersionSnapshot }
  | { ok: false };

export function parseDraftVersionSnapshot(
  value: unknown,
): DraftSnapshotParseResult {
  const envelope = snapshotEnvelopeSchema.safeParse(value);

  if (!envelope.success) {
    return { ok: false };
  }

  switch (envelope.data.type) {
    case "scheme": {
      switch (envelope.data.version) {
        case 1: {
          const content = schemeSnapshotContentV1Schema.safeParse(
            envelope.data.content,
          );

          if (!content.success) {
            return { ok: false };
          }

          return {
            ok: true,
            data: {
              type: "scheme",
              version: 1,
              content: content.data,
            },
          };
        }
        default:
          return { ok: false };
      }
    }
    case "revision": {
      switch (envelope.data.version) {
        case 1: {
          const content = revisionSnapshotContentV1Schema.safeParse(
            envelope.data.content,
          );

          if (!content.success) {
            return { ok: false };
          }

          return {
            ok: true,
            data: {
              type: "revision",
              version: 1,
              content: content.data,
            },
          };
        }
        default:
          return { ok: false };
      }
    }
    default:
      return { ok: false };
  }
}

export function createSchemeDraftSnapshot(
  content: SchemeSnapshot,
): SchemeDraftSnapshot {
  return {
    type: "scheme",
    version: 1,
    content,
  };
}

export function createRevisionDraftSnapshot(
  content: RevisionSnapshotContent,
): RevisionDraftSnapshot {
  return {
    type: "revision",
    version: 1,
    content,
  };
}

export function getSchemeSnapshotFromDraftSnapshot(value: unknown) {
  const parsed = parseDraftVersionSnapshot(value);

  if (!parsed.ok) {
    return null;
  }

  switch (parsed.data.type) {
    case "scheme":
      return parsed.data.content;
    case "revision":
      return parsed.data.content.schemeSnapshot;
  }
}
