import type { z } from "zod";
import { GenerationRequestError } from "./errors";
import { encryptedRequestSchema } from "./schemas";
import type { EncryptedApiKey, EncryptedRequest } from "./schemas";

const requestPrivateKeyEnvName = "REQUEST_ENCRYPTION_PRIVATE_JWK";
const apiKeyPrivateKeyEnvName = "API_KEY_ENCRYPTION_PRIVATE_JWK";
const legacyApiKeyPrivateKeyEnvName = "GENERATION_API_KEY_PRIVATE_JWK";

export async function parseMaybeEncryptedBody<T>(
  body: unknown,
  schema: z.ZodType<T>,
) {
  const encrypted = encryptedRequestSchema.safeParse(body);

  if (encrypted.success) {
    return schema.safeParse(await decryptRequestPayload(encrypted.data));
  }

  return schema.safeParse(body);
}

export async function decryptApiKey(encryptedApiKey: EncryptedApiKey) {
  const privateJwk = getPrivateJwk([
    apiKeyPrivateKeyEnvName,
    legacyApiKeyPrivateKeyEnvName,
  ]);

  try {
    const privateKey = await importRsaPrivateKey(privateJwk);
    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      decodeBase64Payload(encryptedApiKey.ciphertext, encryptedApiKey.encoding),
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new GenerationRequestError(
      "decrypt_api_key_failed",
      "Could not decrypt the provider API key.",
      400,
      400,
    );
  }
}

async function decryptRequestPayload(envelope: EncryptedRequest) {
  const privateJwk = getPrivateJwk([requestPrivateKeyEnvName]);
  const { encryptedRequest } = envelope;

  try {
    const privateKey = await importRsaPrivateKey(privateJwk);
    const aesKeyRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      decodeBase64Payload(
        encryptedRequest.encryptedKey,
        encryptedRequest.encoding,
      ),
    );
    const aesKey = await crypto.subtle.importKey(
      "raw",
      aesKeyRaw,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Payload(encryptedRequest.iv, encryptedRequest.encoding),
      },
      aesKey,
      decodeBase64Payload(
        encryptedRequest.ciphertext,
        encryptedRequest.encoding,
      ),
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new GenerationRequestError(
      "decrypt_request_failed",
      "Could not decrypt the encrypted request payload.",
      400,
      400,
    );
  }
}

function getPrivateJwk(envNames: string[]) {
  const envName = envNames.find((name) => process.env[name]?.trim());
  const privateJwk = envName ? process.env[envName]?.trim() : "";

  if (!privateJwk) {
    throw new GenerationRequestError(
      "missing_private_key",
      `Missing one of: ${envNames.join(", ")}.`,
      500,
      null,
    );
  }

  return privateJwk;
}

async function importRsaPrivateKey(privateJwk: string) {
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateJwk) as JsonWebKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

function decodeBase64Payload(value: string, encoding: "base64url" | "base64") {
  const normalized =
    encoding === "base64url"
      ? value.replace(/-/g, "+").replace(/_/g, "/")
      : value;
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return Buffer.from(padded, "base64");
}
