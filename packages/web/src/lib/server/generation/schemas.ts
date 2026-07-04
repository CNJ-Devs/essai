import { z } from "zod";

export const generationSchemaVersion = 1;
export const generationTtlSeconds = 7 * 24 * 60 * 60;

export const providerSchema = z.enum(["openai", "deepseek", "anthropic"]);
export type Provider = z.infer<typeof providerSchema>;

export const generationKindSchema = z.enum(["draft", "title"]);
export type GenerationKind = z.infer<typeof generationKindSchema>;

export const generationStatusSchema = z.enum(["running", "succeeded", "failed"]);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const encryptedApiKeySchema = z.object({
  alg: z.literal("RSA-OAEP-256"),
  ciphertext: z.string().min(1),
  encoding: z.enum(["base64url", "base64"]).default("base64url"),
  keyId: z.string().trim().optional(),
});
export type EncryptedApiKey = z.infer<typeof encryptedApiKeySchema>;

export const encryptedRequestSchema = z.object({
  schemaVersion: z.literal(1),
  encryptedRequest: z.object({
    alg: z.literal("A256GCM+RSA-OAEP-256"),
    encryptedKey: z.string().min(1),
    iv: z.string().min(1),
    ciphertext: z.string().min(1),
    encoding: z.enum(["base64url", "base64"]).default("base64url"),
    keyId: z.string().trim().optional(),
  }),
});
export type EncryptedRequest = z.infer<typeof encryptedRequestSchema>;

export const providerOptionsSchema = z.object({
  maxOutputTokens: z.number().int().min(64).max(8192).default(1800),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh"]).optional(),
});
export type ProviderOptions = z.infer<typeof providerOptionsSchema>;

export const requestFingerprintSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);
export type RequestFingerprint = z.infer<typeof requestFingerprintSchema>;

const fragmentPayloadSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().optional(),
  content: z.string().trim().min(1),
});

const schemePayloadSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
});

const lawPayloadSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
});

export const schemeDraftPayloadSchema = z.object({
  fragment: fragmentPayloadSchema,
  scheme: schemePayloadSchema,
  laws: z.array(lawPayloadSchema).default([]),
});
export type SchemeDraftPayload = z.infer<typeof schemeDraftPayloadSchema>;

export const rewriteDraftPayloadSchema = z.object({
  instruction: z.string().trim().min(1),
  sourceContent: z.string().trim().min(1),
  sourceVersionId: z.string().trim().min(1),
});
export type RewriteDraftPayload = z.infer<typeof rewriteDraftPayloadSchema>;

export const draftPayloadSchema = z.union([
  schemeDraftPayloadSchema,
  rewriteDraftPayloadSchema,
]);
export type DraftPayload = z.infer<typeof draftPayloadSchema>;

export const titlePayloadSchema = z.object({
  fragment: fragmentPayloadSchema,
});
export type TitlePayload = z.infer<typeof titlePayloadSchema>;

export const generationInputSchema = z.object({
  id: z.string().trim().min(1),
  requestFingerprint: requestFingerprintSchema.optional(),
  title: z.string().trim().optional(),
  payload: draftPayloadSchema,
});
export type GenerationInput = z.infer<typeof generationInputSchema>;

export const generationCreateRequestSchema = z.object({
  provider: providerSchema,
  apiKey: z.string().trim().optional(),
  encryptedApiKey: encryptedApiKeySchema.optional(),
  model: z.string().trim().optional(),
  timeoutMs: z.number().int().min(1000).max(240_000).default(240_000),
  ttlSeconds: z.number().int().min(60).max(generationTtlSeconds).default(generationTtlSeconds),
  options: providerOptionsSchema.default({
    maxOutputTokens: 1800,
  }),
  generations: z.array(generationInputSchema).min(1).max(12),
});
export type GenerationCreateRequest = z.infer<typeof generationCreateRequestSchema>;

export const generationPullRequestSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
});
export type GenerationPullRequest = z.infer<typeof generationPullRequestSchema>;

export const generationCleanupRequestSchema = generationPullRequestSchema;
export type GenerationCleanupRequest = z.infer<typeof generationCleanupRequestSchema>;

export const generationFollowRequestSchema = generationPullRequestSchema.extend({
  intervalMs: z.number().int().min(500).max(10_000).default(1_000),
});
export type GenerationFollowRequest = z.infer<typeof generationFollowRequestSchema>;

export const titleCreateRequestSchema = z.object({
  id: z.string().trim().min(1),
  requestFingerprint: requestFingerprintSchema.optional(),
  provider: providerSchema,
  apiKey: z.string().trim().optional(),
  encryptedApiKey: encryptedApiKeySchema.optional(),
  model: z.string().trim().optional(),
  timeoutMs: z.number().int().min(1000).max(240_000).default(60_000),
  ttlSeconds: z.number().int().min(60).max(generationTtlSeconds).default(generationTtlSeconds),
  options: providerOptionsSchema.default({
    maxOutputTokens: 96,
  }),
  payload: titlePayloadSchema,
});
export type TitleCreateRequest = z.infer<typeof titleCreateRequestSchema>;

export type GenerationError = {
  code: string;
  message: string;
  providerStatus: number | null;
};

export type GenerationOutput = {
  content: string;
  usage: unknown | null;
  promptTemplateVersion: string;
  promptChars: number;
};

export type GenerationRecord = {
  schemaVersion: typeof generationSchemaVersion;
  id: string;
  kind: GenerationKind;
  status: GenerationStatus;
  title: string | null;
  provider: Provider;
  model: string;
  payload: DraftPayload | TitlePayload;
  output: GenerationOutput | null;
  error: GenerationError | null;
  requestFingerprint: RequestFingerprint;
  workflowTimeoutMs: number;
  providerTimeoutMs: number;
  finalizationReserveMs: number;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export const providerDefaults: Record<Provider, string> = {
  openai: "gpt-5.4-mini",
  deepseek: "deepseek-v4-pro",
  anthropic: "claude-sonnet-5",
};
