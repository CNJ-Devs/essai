import type { EncryptedApiKey } from "./schemas";
import { decryptApiKey, isLocalGenerationEnvironment } from "./encryption";
import { GenerationRequestError } from "./errors";

export async function resolveProviderApiKey({
  explicitApiKey,
  encryptedApiKey,
  provider,
  request,
}: {
  explicitApiKey?: string;
  encryptedApiKey?: EncryptedApiKey;
  provider: string;
  request: Request;
}) {
  if (encryptedApiKey) {
    return decryptApiKey(encryptedApiKey);
  }

  if (!isLocalGenerationEnvironment()) {
    throw new GenerationRequestError(
      "encrypted_api_key_required",
      `Encrypted API key is required for ${provider} outside local environment.`,
      400,
      400,
    );
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
