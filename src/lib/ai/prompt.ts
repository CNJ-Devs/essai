import { copy } from "@/lib/i18n";
import type { Fragment, SchemeSnapshot } from "@/lib/types";

export const PROMPT_TEMPLATE_VERSION = "v1";

export function buildDraftPrompt(fragment: Fragment, snapshot: SchemeSnapshot) {
  const laws = snapshot.laws
    .map((law) => copy.ai.lawBlock({ name: law.name, prompt: law.prompt }))
    .join("\n\n");

  return copy.ai.draftPrompt({
    schemeName: snapshot.schemeName,
    schemeDescription: snapshot.schemeDescription,
    laws,
    fragmentTitle: fragment.title,
    fragmentContent: fragment.content,
  });
}

export function buildDraftRevisionPrompt({
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
  const laws = snapshot.laws
    .map((law) => copy.ai.lawBlock({ name: law.name, prompt: law.prompt }))
    .join("\n\n");

  return copy.ai.draftRevisionPrompt({
    schemeName: snapshot.schemeName,
    schemeDescription: snapshot.schemeDescription,
    laws,
    fragmentTitle: fragment.title,
    fragmentContent: fragment.content,
    currentDraft,
    instruction,
  });
}
