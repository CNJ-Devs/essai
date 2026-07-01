import { randomUUID } from "crypto";
import { generateDraftContent, generateFragmentTitle } from "@/lib/ai/generation";
import { createSeedState, DEMO_USER_ID } from "@/lib/data/seed";
import type { DemoState } from "@/lib/data/store-types";
import type {
  Draft,
  DraftVersion,
  Fragment,
  Law,
  Scheme,
  SchemeSelection,
  SchemeSnapshot,
} from "@/lib/types";

const globalForStore = globalThis as unknown as {
  essaiDemoState?: DemoState;
};

function state() {
  if (!globalForStore.essaiDemoState) {
    globalForStore.essaiDemoState = createSeedState();
  }

  return globalForStore.essaiDemoState;
}

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function sortNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getWorkspaceData() {
  const store = state();

  return {
    fragments: sortNewest(store.fragments),
    schemes: sortNewest(store.schemes),
    laws: sortNewest(store.laws),
    drafts: sortNewest(store.drafts),
  };
}

export async function getFragmentPageData(fragmentId: string) {
  const store = state();
  const fragment = store.fragments.find((item) => item.id === fragmentId) ?? null;

  return {
    fragment,
    schemes: sortNewest(store.schemes),
    laws: sortNewest(store.laws),
    drafts: sortNewest(
      store.drafts.filter((draft) => draft.fragmentId === fragmentId),
    ),
  };
}

export async function getDraftPageData(draftId: string) {
  const store = state();
  const draft = store.drafts.find((item) => item.id === draftId) ?? null;
  const fragment = draft
    ? store.fragments.find((item) => item.id === draft.fragmentId) ?? null
    : null;

  return { draft, fragment };
}

export async function getSchemePageData(schemeId: string) {
  const store = state();

  return {
    scheme: store.schemes.find((item) => item.id === schemeId) ?? null,
    laws: sortNewest(store.laws),
  };
}

export async function getLawPageData(lawId: string) {
  const store = state();

  return {
    law: store.laws.find((item) => item.id === lawId) ?? null,
  };
}

export async function createFragmentWithDrafts(input: {
  title?: string;
  content: string;
  selections: SchemeSelection[];
}) {
  const store = state();
  const createdAt = now();
  const title = input.title?.trim()
    ? input.title.trim()
    : await generateFragmentTitle(input.content);

  const fragment: Fragment = {
    id: createId("fragment"),
    userId: DEMO_USER_ID,
    title,
    titleSource: input.title?.trim() ? "user" : "ai",
    content: input.content.trim(),
    createdAt,
    updatedAt: createdAt,
  };

  store.fragments.unshift(fragment);
  await createDraftsForFragment(fragment.id, input.selections);

  return fragment;
}

export async function updateFragment(input: {
  id: string;
  title: string;
  content: string;
}) {
  const store = state();
  const fragment = store.fragments.find((item) => item.id === input.id);

  if (!fragment) {
    return null;
  }

  fragment.title = input.title.trim();
  fragment.titleSource = "user";
  fragment.content = input.content.trim();
  fragment.updatedAt = now();

  return fragment;
}

export async function createDraftsForFragment(
  fragmentId: string,
  selections: SchemeSelection[],
) {
  const store = state();
  const fragment = store.fragments.find((item) => item.id === fragmentId);

  if (!fragment || selections.length === 0) {
    return [];
  }

  const created: Draft[] = [];

  for (const selection of selections) {
    const scheme = store.schemes.find((item) => item.id === selection.schemeId);

    if (!scheme) {
      continue;
    }

    const timestamp = now();
    const snapshot = createSchemeSnapshot(scheme);
    const draft: Draft = {
      id: createId("draft"),
      fragmentId,
      schemeSnapshot: snapshot,
      versions: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    store.drafts.unshift(draft);

    for (let index = 0; index < selection.count; index += 1) {
      const version = await createAiDraftVersion(
        fragment,
        draft,
        draft.versions.length + 1,
      );
      draft.versions.push(version);
      draft.updatedAt = version.updatedAt;
    }

    created.push(draft);
  }

  return created;
}

export async function retryDraft(draftId: string) {
  const store = state();
  const draft = store.drafts.find((item) => item.id === draftId);
  const fragment = draft
    ? store.fragments.find((item) => item.id === draft.fragmentId)
    : null;

  if (!draft || !fragment) {
    return null;
  }

  const version = await createAiDraftVersion(
    fragment,
    draft,
    draft.versions.length + 1,
  );

  draft.versions.push(version);
  draft.updatedAt = version.updatedAt;

  return version;
}

export async function saveManualDraftVersion(input: {
  draftId: string;
  content: string;
}) {
  const store = state();
  const draft = store.drafts.find((item) => item.id === input.draftId);

  if (!draft) {
    return null;
  }

  const timestamp = now();
  const version: DraftVersion = {
    id: createId("draft_version"),
    draftId: draft.id,
    versionNo: draft.versions.length + 1,
    status: "completed",
    source: "manual_edit",
    content: input.content.trim(),
    errorMessage: null,
    model: null,
    promptTemplateVersion: "manual",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  draft.versions.push(version);
  draft.updatedAt = timestamp;

  return version;
}

export async function createScheme(input: {
  name: string;
  description: string;
}) {
  const store = state();
  const timestamp = now();
  const scheme: Scheme = {
    id: createId("scheme"),
    userId: DEMO_USER_ID,
    name: input.name.trim(),
    description: input.description.trim(),
    lawIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.schemes.unshift(scheme);
  return scheme;
}

export async function updateScheme(input: {
  id: string;
  name: string;
  description: string;
  lawIds: string[];
}) {
  const store = state();
  const scheme = store.schemes.find((item) => item.id === input.id);

  if (!scheme) {
    return null;
  }

  scheme.name = input.name.trim();
  scheme.description = input.description.trim();
  scheme.lawIds = input.lawIds.filter((lawId) =>
    store.laws.some((law) => law.id === lawId),
  );
  scheme.updatedAt = now();

  return scheme;
}

export async function deleteScheme(id: string) {
  const store = state();
  store.schemes = store.schemes.filter((scheme) => scheme.id !== id);
}

export async function createLaw(input: {
  name: string;
  prompt: string;
  tags: string[];
  visibility: "private" | "public";
}) {
  const store = state();
  const timestamp = now();
  const law: Law = {
    id: createId("law"),
    ownerUserId: DEMO_USER_ID,
    name: input.name.trim(),
    prompt: input.prompt.trim(),
    tags: input.tags,
    visibility: input.visibility,
    sourceLawId: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.laws.unshift(law);
  return law;
}

export async function updateLaw(input: {
  id: string;
  name: string;
  prompt: string;
  tags: string[];
  visibility: "private" | "public";
}) {
  const store = state();
  const law = store.laws.find((item) => item.id === input.id);

  if (!law) {
    return null;
  }

  const promptChanged = law.prompt !== input.prompt.trim();
  law.name = input.name.trim();
  law.prompt = input.prompt.trim();
  law.tags = input.tags;
  law.visibility = input.visibility;
  law.version = promptChanged ? law.version + 1 : law.version;
  law.updatedAt = now();

  return law;
}

export async function deleteLaw(id: string) {
  const store = state();
  store.laws = store.laws.filter((law) => law.id !== id);
  store.schemes = store.schemes.map((scheme) => ({
    ...scheme,
    lawIds: scheme.lawIds.filter((lawId) => lawId !== id),
    updatedAt: now(),
  }));
}

function createSchemeSnapshot(scheme: Scheme): SchemeSnapshot {
  const store = state();
  const timestamp = now();
  const laws = scheme.lawIds
    .map((lawId) => store.laws.find((law) => law.id === lawId))
    .filter((law): law is Law => Boolean(law))
    .map((law) => ({
      lawId: law.id,
      name: law.name,
      prompt: law.prompt,
      version: law.version,
    }));

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    schemeDescription: scheme.description,
    laws,
    snapshottedAt: timestamp,
  };
}

async function createAiDraftVersion(
  fragment: Fragment,
  draft: Draft,
  versionNo: number,
): Promise<DraftVersion> {
  const timestamp = now();

  try {
    const result = await generateDraftContent(fragment, draft.schemeSnapshot);

    return {
      id: createId("draft_version"),
      draftId: draft.id,
      versionNo,
      status: "completed",
      source: "ai",
      content: result.content,
      errorMessage: null,
      model: result.model,
      promptTemplateVersion: result.promptTemplateVersion,
      createdAt: timestamp,
      updatedAt: now(),
    };
  } catch (error) {
    return {
      id: createId("draft_version"),
      draftId: draft.id,
      versionNo,
      status: "failed",
      source: "ai",
      content: "",
      errorMessage:
        error instanceof Error ? error.message : "出稿失败，请稍后再试。",
      model: process.env.AI_MODEL ?? "openai/gpt-5.5",
      promptTemplateVersion: "v1",
      createdAt: timestamp,
      updatedAt: now(),
    };
  }
}
