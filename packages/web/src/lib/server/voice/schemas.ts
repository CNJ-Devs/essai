import { z } from "zod";
import {
  encryptedApiKeySchema,
  providerOptionsSchema,
  requestFingerprintSchema,
} from "../generation/schemas";

export const voiceSchemaVersion = 1;
export const voicePromptTemplateVersion = "voice-transcript-v1";

export const voiceSttProviderSchema = z.enum(["openai", "elevenlabs"]);
export type VoiceSttProvider = z.infer<typeof voiceSttProviderSchema>;

export const voiceCleanupProviderSchema = z.enum([
  "openai",
  "deepseek",
  "anthropic",
]);
export type VoiceCleanupProvider = z.infer<typeof voiceCleanupProviderSchema>;

export const voiceAudioEncryptionSchema = z.object({
  alg: z.literal("A256GCM"),
  encoding: z.enum(["base64url", "base64"]).default("base64url"),
  iv: z.string().min(1),
});
export type VoiceAudioEncryption = z.infer<typeof voiceAudioEncryptionSchema>;

export const voiceTranscribeOptionsSchema = z
  .object({
    diarize: z.boolean().optional(),
    language: z.string().trim().min(1).max(32).optional(),
    prompt: z.string().trim().min(1).max(2_000).optional(),
    timestamps: z.enum(["none", "word", "character"]).optional(),
  })
  .default({})
  .transform((options) => options);
export type VoiceTranscribeOptions = z.infer<typeof voiceTranscribeOptionsSchema>;

export const nativeTextTranscribeInfoSchema = z.object({
  type: z.literal("native-text"),
  payload: z.object({
    text: z.string().trim().min(1),
  }),
});
export type NativeTextTranscribeInfo = z.infer<
  typeof nativeTextTranscribeInfoSchema
>;

export const cloudAudioTranscribeInfoSchema = z.object({
  type: z.literal("cloud-audio"),
  payload: z.object({
    apiKey: z.string().trim().optional(),
    audio: z
      .object({
        contentType: z.string().trim().optional(),
        encryption: voiceAudioEncryptionSchema.optional(),
        field: z.string().trim().min(1).default("audio"),
        filename: z.string().trim().optional(),
      })
      .default({ field: "audio" }),
    encryptedApiKey: encryptedApiKeySchema.optional(),
    model: z.string().trim().optional(),
    options: voiceTranscribeOptionsSchema,
    provider: voiceSttProviderSchema,
  }),
});
export type CloudAudioTranscribeInfo = z.infer<
  typeof cloudAudioTranscribeInfoSchema
>;

export const voiceTranscribeInfoSchema = z.discriminatedUnion("type", [
  nativeTextTranscribeInfoSchema,
  cloudAudioTranscribeInfoSchema,
]);
export type VoiceTranscribeInfo = z.infer<typeof voiceTranscribeInfoSchema>;

export const voiceCleanupInfoSchema = z.object({
  apiKey: z.string().trim().optional(),
  encryptedApiKey: encryptedApiKeySchema.optional(),
  model: z.string().trim().optional(),
  options: providerOptionsSchema,
  provider: voiceCleanupProviderSchema,
});
export type VoiceCleanupInfo = z.infer<typeof voiceCleanupInfoSchema>;

export const voiceTranscriptRequestSchema = z.object({
  cleanupInfo: voiceCleanupInfoSchema.optional(),
  id: z.string().trim().min(1).optional(),
  requestFingerprint: requestFingerprintSchema.optional(),
  schemaVersion: z.literal(voiceSchemaVersion).default(voiceSchemaVersion),
  timeoutMs: z.number().int().min(1_000).max(240_000).default(120_000),
  transcribeInfo: voiceTranscribeInfoSchema,
});
export type VoiceTranscriptRequest = z.infer<typeof voiceTranscriptRequestSchema>;

export const voiceSttProviderDefaults: Record<VoiceSttProvider, string> = {
  elevenlabs: "scribe_v2",
  openai: "gpt-4o-mini-transcribe",
};
