import { createHash } from "node:crypto";
import { GenerationRequestError } from "./errors";
import { generationSchemaVersion } from "./schemas";
import type {
  GenerationInput,
  Provider,
  ProviderOptions,
  RequestFingerprint,
  TitleCreateRequest,
} from "./schemas";

export function buildDraftRequestFingerprint({
  generation,
  model,
  options,
  provider,
}: {
  generation: GenerationInput;
  model: string;
  options: ProviderOptions;
  provider: Provider;
}) {
  return buildRequestFingerprint({
    generation: {
      id: generation.id,
      payload: generation.payload,
      title: generation.title ?? null,
    },
    kind: "draft",
    model,
    options,
    provider,
    schemaVersion: generationSchemaVersion,
  });
}

export function buildTitleRequestFingerprint({
  input,
  model,
}: {
  input: TitleCreateRequest;
  model: string;
}) {
  return buildRequestFingerprint({
    id: input.id,
    kind: "title",
    model,
    options: input.options,
    payload: input.payload,
    provider: input.provider,
    schemaVersion: generationSchemaVersion,
  });
}

export function assertMatchingRequestFingerprint(
  provided: RequestFingerprint | undefined,
  computed: RequestFingerprint,
) {
  if (!provided) {
    return;
  }

  if (provided !== computed) {
    throw new GenerationRequestError(
      "invalid_request_fingerprint",
      "Request fingerprint does not match the request body.",
      400,
      400,
    );
  }
}

function buildRequestFingerprint(value: unknown): RequestFingerprint {
  const input = stableStringify(value);
  const hash = createHash("sha256").update(input).digest("hex");

  return `sha256:${hash}`;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeStableValue(value));
}

function normalizeStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeStableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeStableValue(child)]),
    );
  }

  return value;
}
