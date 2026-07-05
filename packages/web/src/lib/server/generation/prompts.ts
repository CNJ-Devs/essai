import {
  PROMPT_TEMPLATE_VERSION,
  buildDraftPrompt,
  buildDraftRevisionPrompt,
} from "@/lib/ai/prompt";
import { copy } from "@/lib/i18n";
import type { Fragment, SchemeSnapshot } from "@/lib/types";
import type {
  DraftPayload,
  RewriteDraftPayload,
  SchemeDraftPayload,
  TitlePayload,
} from "./schemas";

const generatedTitleMaxLength = 14;

export function buildDraftGenerationPrompt(payload: DraftPayload) {
  if (isRewriteDraftPayload(payload)) {
    return buildRewriteGenerationPrompt(payload);
  }

  const now = new Date().toISOString();
  const fragment = buildFragmentFromPayload(payload.fragment, now);
  const snapshot = buildSchemeSnapshotFromPayload(payload, now);
  const prompt = buildDraftPrompt(fragment, snapshot);

  return {
    instructions: copy.ai.draftInstructions,
    prompt,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    promptChars: prompt.length,
  };
}

function buildFragmentFromPayload(
  fragment: SchemeDraftPayload["fragment"],
  now: string,
): Fragment {
  const title = fragment.title || "New Piece";

  return {
    id: fragment.id || "client-fragment",
    userId: "local-user",
    title,
    titleSource: fragment.title ? "user" : "ai",
    content: fragment.content,
    createdAt: now,
    updatedAt: now,
  };
}

function buildSchemeSnapshotFromPayload(
  payload: Pick<SchemeDraftPayload, "laws" | "scheme">,
  now: string,
): SchemeSnapshot {
  return {
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
}

function buildFallbackRewriteBasis(
  payload: RewriteDraftPayload,
  now: string,
): {
  fragment: Fragment;
  snapshot: SchemeSnapshot;
} {
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

  return { fragment, snapshot };
}

function buildRewriteGenerationPrompt(payload: RewriteDraftPayload) {
  const now = new Date().toISOString();
  const basis = payload.basis
    ? {
        fragment: buildFragmentFromPayload(payload.basis.fragment, now),
        snapshot: buildSchemeSnapshotFromPayload(payload.basis, now),
      }
    : buildFallbackRewriteBasis(payload, now);
  const prompt = buildDraftRevisionPrompt({
    currentDraft: payload.sourceContent,
    fragment: basis.fragment,
    instruction: payload.instruction,
    snapshot: basis.snapshot,
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
    .slice(0, generatedTitleMaxLength);
}
