import { PROMPT_TEMPLATE_VERSION, buildDraftPrompt } from "@/lib/ai/prompt";
import { copy } from "@/lib/i18n";
import type { Fragment, SchemeSnapshot } from "@/lib/types";
import type { DraftPayload, TitlePayload } from "./schemas";

export function buildDraftGenerationPrompt(payload: DraftPayload) {
  const now = new Date().toISOString();
  const fragment: Fragment = {
    id: payload.fragment.id || "client-fragment",
    userId: "local-user",
    title: payload.fragment.title || "New Piece",
    titleSource: payload.fragment.title ? "user" : "ai",
    content: payload.fragment.content,
    createdAt: now,
    updatedAt: now,
  };
  const snapshot: SchemeSnapshot = {
    schemeId: payload.scheme.id || "client-scheme",
    schemeName: payload.scheme.title,
    schemeDescription: payload.scheme.content,
    laws: payload.laws
      .map((law, index) => ({
        lawId: law.id || `client-law-${index + 1}`,
        name: law.title,
        prompt: law.content,
      }))
      .filter((law) => law.prompt),
    snapshottedAt: now,
  };
  const prompt = buildDraftPrompt(fragment, snapshot);

  return {
    instructions: copy.ai.draftInstructions,
    prompt,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    promptChars: prompt.length,
  };
}

export function buildTitleGenerationPrompt(payload: TitlePayload) {
  const prompt = copy.ai.titlePrompt(payload.fragment.content);

  return {
    instructions: copy.ai.titleInstructions,
    prompt,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    promptChars: prompt.length,
  };
}

export function normalizeGeneratedTitle(content: string) {
  return content
    .split("\n")[0]
    .replace(/^["“”'「」]+|["“”'「」]+$/g, "")
    .trim()
    .slice(0, 40);
}
