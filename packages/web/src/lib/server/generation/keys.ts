import type { EncryptedApiKey, Provider } from "./schemas";
import { GenerationRequestError } from "./errors";

const privateKeyEnvName = "GENERATION_API_KEY_PRIVATE_JWK";

export async function resolveProviderApiKey({
  explicitApiKey,
  encryptedApiKey,
  provider,
  request,
}: {
  explicitApiKey?: string;
  encryptedApiKey?: EncryptedApiKey;
  provider: Provider;
  request: Request;
}) {
  if (provider === "mock") {
    return "";
  }

  if (encryptedApiKey) {
    return decryptApiKey(encryptedApiKey);
  }

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerKey = request.headers.get("x-provider-api-key")?.trim();
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`]?.trim();
  const apiKey = explicitApiKey || headerKey || bearer || envKey;

  if (!apiKey) {
    throw new GenerationRequestError(
      "missing_api_key",
      `Missing API key for ${provider}. Pass apiKey, encryptedApiKey, Authorization: Bearer, x-provider-api-key, or ${provider.toUpperCase()}_API_KEY.`,
      401,
      401,
    );
  }

  return apiKey;
}

async function decryptApiKey(encryptedApiKey: EncryptedApiKey) {
  const privateJwk = process.env[privateKeyEnvName]?.trim();

  if (!privateJwk) {
    throw new GenerationRequestError(
      "missing_private_key",
      `Missing ${privateKeyEnvName}; cannot decrypt encrypted provider key.`,
      500,
      null,
    );
  }

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      JSON.parse(privateJwk) as JsonWebKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      key,
      decodeCiphertext(encryptedApiKey),
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

function decodeCiphertext(encryptedApiKey: EncryptedApiKey) {
  const normalized =
    encryptedApiKey.encoding === "base64url"
      ? encryptedApiKey.ciphertext.replace(/-/g, "+").replace(/_/g, "/")
      : encryptedApiKey.ciphertext;
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return Buffer.from(padded, "base64");
}
