export class GenerationRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public providerStatus: number | null = null,
  ) {
    super(message);
  }
}

export function normalizeGenerationError(error: unknown) {
  if (error instanceof GenerationRequestError) {
    return error;
  }

  if (error instanceof Error) {
    return new GenerationRequestError(
      "generation_failed",
      error.message,
      500,
      null,
    );
  }

  return new GenerationRequestError(
    "generation_failed",
    "Generation failed.",
    500,
    null,
  );
}
