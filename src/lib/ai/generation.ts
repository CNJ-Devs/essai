import { generateText } from "ai";
import {
  PROMPT_TEMPLATE_VERSION,
  buildDraftPrompt,
  buildDraftRevisionPrompt,
} from "@/lib/ai/prompt";
import { copy } from "@/lib/i18n";
import type { Fragment, SchemeSnapshot } from "@/lib/types";

const DEFAULT_MODEL = "openai/gpt-5.5";

function canUseGateway() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
}

export async function generateFragmentTitle(content: string) {
  const fallback = content
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);

  if (!canUseGateway()) {
    return fallback || copy.errors.untitledFragment;
  }

  try {
    const { text } = await generateText({
      model: process.env.AI_MODEL ?? DEFAULT_MODEL,
      instructions: copy.ai.titleInstructions,
      prompt: copy.ai.titlePrompt(content),
    });

    return (
      text.replace(/^["“]|["”]$/g, "").trim() ||
      fallback ||
      copy.errors.untitledFragment
    );
  } catch {
    return fallback || copy.errors.untitledFragment;
  }
}

export async function generateDraftContent(
  fragment: Fragment,
  snapshot: SchemeSnapshot,
) {
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  if (!canUseGateway()) {
    return {
      content: buildFallbackDraft(fragment, snapshot),
      model: "local-fallback",
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    };
  }

  const { text } = await generateText({
    model,
    instructions: copy.ai.draftInstructions,
    prompt: buildDraftPrompt(fragment, snapshot),
  });

  return {
    content: text,
    model,
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
  };
}

export async function reviseDraftContent({
  fragment,
  snapshot,
  currentDraft,
  instruction,
}: {
  fragment: Fragment;
  snapshot: SchemeSnapshot;
  currentDraft: string;
  instruction: string;
}) {
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

  if (!canUseGateway()) {
    return {
      content: buildFallbackRevision({
        fragment,
        snapshot,
        currentDraft,
        instruction,
      }),
      model: "local-fallback",
      promptTemplateVersion: `${PROMPT_TEMPLATE_VERSION}-revision`,
    };
  }

  const { text } = await generateText({
    model,
    instructions: copy.ai.revisionInstructions,
    prompt: buildDraftRevisionPrompt({
      fragment,
      snapshot,
      currentDraft,
      instruction,
    }),
  });

  return {
    content: text,
    model,
    promptTemplateVersion: `${PROMPT_TEMPLATE_VERSION}-revision`,
  };
}

function buildFallbackDraft(fragment: Fragment, snapshot: SchemeSnapshot) {
  const lawList =
    snapshot.laws.length > 0
      ? snapshot.laws.map((law) => copy.ai.fallbackLawItem(law.name)).join("\n")
      : copy.ai.fallbackNoLaws;

  return copy.ai.fallbackDraft({
    fragmentTitle: fragment.title,
    fragmentContent: fragment.content,
    schemeName: snapshot.schemeName,
    lawList,
  });
}

function buildFallbackRevision({
  fragment,
  snapshot,
  instruction,
}: {
  fragment: Fragment;
  snapshot: SchemeSnapshot;
  currentDraft: string;
  instruction: string;
}) {
  return copy.ai.fallbackRevision({
    fragmentTitle: fragment.title,
    fragmentContent: fragment.content,
    schemeName: snapshot.schemeName,
    instruction,
  });
}
