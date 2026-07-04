import {
  PROMPT_TEMPLATE_VERSION,
  buildDraftPrompt,
  buildDraftRevisionPrompt,
} from "@/lib/ai/prompt";
import { copy } from "@/lib/i18n";
import type { Fragment, SchemeSnapshot } from "@/lib/types";
import type { DraftPayload, RewriteDraftPayload, TitlePayload } from "./schemas";

export function buildDraftGenerationPrompt(payload: DraftPayload) {
  if (isRewriteDraftPayload(payload)) {
    return buildRewriteGenerationPrompt(payload);
  }

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

function buildRewriteGenerationPrompt(payload: RewriteDraftPayload) {
  const now = new Date().toISOString();
  const fragment: Fragment = {
    id: `rewrite-source-${payload.sourceVersionId}`,
    userId: "local-user",
    title: "Rewrite source",
    titleSource: "user",
    content: payload.sourceContent,
    createdAt: now,
    updatedAt: now,
  };
  const snapshot: SchemeSnapshot = {
    schemeId: "rewrite",
    schemeName: "Rewrite",
    schemeDescription:
      "基于当前稿件和用户修改意见，输出一版完整可用的新稿件。",
    laws: [],
    snapshottedAt: now,
  };
  const prompt = buildDraftRevisionPrompt({
    currentDraft: payload.sourceContent,
    fragment,
    instruction: payload.instruction,
    snapshot,
  });

  return {
    instructions: copy.ai.revisionInstructions,
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

function isRewriteDraftPayload(payload: DraftPayload): payload is RewriteDraftPayload {
  return "sourceContent" in payload;
}

export function normalizeGeneratedTitle(content: string) {
  return content
    .split("\n")[0]
    .replace(/^["“”'「」]+|["“”'「」]+$/g, "")
    .trim()
    .slice(0, 40);
}
