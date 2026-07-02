import { randomUUID } from "crypto";
import {
  generateDraftContent,
  generateFragmentTitle,
  reviseDraftContent,
} from "@/lib/ai/generation";
import { createSeedState, DEMO_USER_ID } from "@/lib/data/seed";
import { copy } from "@/lib/i18n";
import type { DemoState } from "@/lib/data/store-types";
import {
  createRevisionDraftSnapshot,
  createSchemeDraftSnapshot,
  getSchemeSnapshotFromDraftSnapshot,
  parseDraftVersionSnapshot,
} from "@/lib/draft-snapshot";
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
  essaiDemoFixtureVersion?: number;
};

const DEMO_FIXTURE_VERSION = 7;

function state() {
  if (
    !globalForStore.essaiDemoState ||
    (globalForStore.essaiDemoFixtureVersion ?? 0) < DEMO_FIXTURE_VERSION
  ) {
    globalForStore.essaiDemoState = createSeedState();
    globalForStore.essaiDemoFixtureVersion = DEMO_FIXTURE_VERSION;
  }

  return globalForStore.essaiDemoState;
}

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function sortNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function draftLatestVersionTime(draft: Draft) {
  const versionTimes = draft.versions.map((version) =>
    new Date(version.updatedAt || version.createdAt).getTime(),
  );

  return Math.max(
    new Date(draft.updatedAt || draft.createdAt).getTime(),
    ...versionTimes,
  );
}

function sortDraftsByLatestVersion(drafts: Draft[]) {
  return [...drafts].sort(
    (a, b) => draftLatestVersionTime(b) - draftLatestVersionTime(a),
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
    drafts: sortDraftsByLatestVersion(
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
  const scheme = draft
    ? store.schemes.find((item) => item.id === draft.schemeSnapshot.schemeId) ??
      null
    : null;
  const laws = scheme
    ? scheme.lawIds
        .map((lawId) => store.laws.find((law) => law.id === lawId))
        .filter((law): law is Law => Boolean(law))
    : [];

  return { draft, fragment, scheme, laws };
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
  content: string;
  selections: SchemeSelection[];
}) {
  const store = state();
  const createdAt = now();
  const fragment: Fragment = {
    id: createId("fragment"),
    userId: DEMO_USER_ID,
    title: "New Piece",
    titleSource: "ai",
    content: input.content.trim(),
    createdAt,
    updatedAt: createdAt,
  };

  store.fragments.unshift(fragment);

  fragment.title = await generateFragmentTitle(input.content);
  fragment.updatedAt = now();

  await createDraftsForFragment(fragment.id, input.selections);

  return fragment;
}

export async function updateFragmentContent(input: {
  id: string;
  content: string;
}) {
  const store = state();
  const fragment = store.fragments.find((item) => item.id === input.id);

  if (!fragment) {
    return null;
  }

  fragment.content = input.content.trim();
  fragment.updatedAt = now();

  return fragment;
}

export async function updateFragmentTitle(input: {
  id: string;
  title: string;
}) {
  const store = state();
  const fragment = store.fragments.find((item) => item.id === input.id);

  if (!fragment) {
    return null;
  }

  fragment.title = input.title.trim();
  fragment.titleSource = "user";
  fragment.updatedAt = now();

  return fragment;
}

export async function deleteFragment(id: string) {
  const store = state();
  store.fragments = store.fragments.filter((fragment) => fragment.id !== id);
  store.drafts = store.drafts.filter((draft) => draft.fragmentId !== id);
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

    const snapshot = createSchemeSnapshot(scheme);
    let draft = store.drafts.find(
      (item) =>
        item.fragmentId === fragmentId &&
        item.schemeSnapshot.schemeId === selection.schemeId,
    );

    if (!draft) {
      const timestamp = now();
      draft = {
        id: createId("draft"),
        fragmentId,
        schemeSnapshot: snapshot,
        versions: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      store.drafts.unshift(draft);
    }

    for (let index = 0; index < selection.count; index += 1) {
      const version = await createAiDraftVersion(
        fragment,
        draft,
        draft.versions.length + 1,
        snapshot,
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

  const snapshot = createCurrentSnapshotForDraft(store, draft);
  const version = await createAiDraftVersion(
    fragment,
    draft,
    draft.versions.length + 1,
    snapshot,
  );

  draft.versions.push(version);
  draft.updatedAt = version.updatedAt;

  return version;
}

export async function retryDraftFromSnapshot(input: {
  draftId: string;
  versionId: string;
}) {
  const store = state();
  const draft = store.drafts.find((item) => item.id === input.draftId);
  const fragment = draft
    ? store.fragments.find((item) => item.id === draft.fragmentId)
    : null;
  const sourceVersion = draft?.versions.find(
    (version) => version.id === input.versionId,
  );

  if (!draft || !fragment || !sourceVersion) {
    return null;
  }

  const parsedSnapshot = parseDraftVersionSnapshot(sourceVersion.snapshot);

  if (!parsedSnapshot.ok) {
    return null;
  }

  const version =
    parsedSnapshot.data.type === "scheme"
      ? await createAiDraftVersion(
          fragment,
          draft,
          draft.versions.length + 1,
          parsedSnapshot.data.content,
        )
      : await createAiRevisionDraftVersion({
          draft,
          fragment,
          versionNo: draft.versions.length + 1,
          sourceVersionId: parsedSnapshot.data.content.sourceVersionId,
          sourceVersionNo: parsedSnapshot.data.content.sourceVersionNo,
          sourceContent: parsedSnapshot.data.content.sourceContent,
          instruction: parsedSnapshot.data.content.instruction,
          schemeSnapshot: parsedSnapshot.data.content.schemeSnapshot,
        });

  draft.versions.push(version);
  draft.updatedAt = version.updatedAt;

  return version;
}

export async function saveManualDraftVersion(input: {
  draftId: string;
  sourceVersionId?: string;
  content: string;
}) {
  const store = state();
  const draft = store.drafts.find((item) => item.id === input.draftId);

  if (!draft) {
    return null;
  }

  const sourceVersion = draft.versions.find(
    (version) => version.id === input.sourceVersionId,
  );
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
    snapshot: createSchemeDraftSnapshot(
      getSchemeSnapshotFromDraftSnapshot(sourceVersion?.snapshot) ??
        createCurrentSnapshotForDraft(store, draft),
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  draft.versions.push(version);
  draft.updatedAt = timestamp;

  return version;
}

export async function reviseDraftFromInstruction(input: {
  draftId: string;
  versionId: string;
  instruction: string;
}) {
  const store = state();
  const draft = store.drafts.find((item) => item.id === input.draftId);
  const fragment = draft
    ? store.fragments.find((item) => item.id === draft.fragmentId)
    : null;
  const sourceVersion = draft?.versions.find(
    (version) => version.id === input.versionId,
  );

  if (!draft || !fragment || !sourceVersion) {
    return null;
  }

  const schemeSnapshot =
    getSchemeSnapshotFromDraftSnapshot(sourceVersion.snapshot) ??
    createCurrentSnapshotForDraft(store, draft);
  const version = await createAiRevisionDraftVersion({
    draft,
    fragment,
    versionNo: draft.versions.length + 1,
    sourceVersionId: sourceVersion.id,
    sourceVersionNo: sourceVersion.versionNo,
    sourceContent: sourceVersion.content,
    instruction: input.instruction.trim(),
    schemeSnapshot,
  });

  draft.versions.push(version);
  draft.updatedAt = version.updatedAt;

  return version;
}

export async function createScheme(input: {
  name: string;
  description: string;
  lawIds?: string[];
}) {
  const store = state();
  const timestamp = now();
  const scheme: Scheme = {
    id: createId("scheme"),
    userId: DEMO_USER_ID,
    name: input.name.trim(),
    description: input.description.trim(),
    lawIds: input.lawIds ?? [],
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

export async function removeLawFromScheme(input: {
  schemeId: string;
  lawId: string;
}) {
  const store = state();
  const scheme = store.schemes.find((item) => item.id === input.schemeId);

  if (!scheme) {
    return null;
  }

  scheme.lawIds = scheme.lawIds.filter((lawId) => lawId !== input.lawId);
  scheme.updatedAt = now();

  return scheme;
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
    tags: normalizeTags(input.tags),
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
  law.tags = normalizeTags(input.tags);
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
  return createSchemeSnapshotFromStore(state(), scheme);
}

function createSchemeSnapshotFromStore(
  store: DemoState,
  scheme: Scheme,
): SchemeSnapshot {
  const timestamp = now();
  const laws = scheme.lawIds
    .map((lawId) => store.laws.find((law) => law.id === lawId))
    .filter((law): law is Law => Boolean(law))
    .map((law) => ({
      lawId: law.id,
      name: law.name,
      prompt: law.prompt,
    }));

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    schemeDescription: scheme.description,
    laws,
    snapshottedAt: timestamp,
  };
}

function createCurrentSnapshotForDraft(store: DemoState, draft: Draft) {
  const scheme = store.schemes.find(
    (item) => item.id === draft.schemeSnapshot.schemeId,
  );

  return scheme
    ? createSchemeSnapshotFromStore(store, scheme)
    : draft.schemeSnapshot;
}

async function createAiDraftVersion(
  fragment: Fragment,
  draft: Draft,
  versionNo: number,
  snapshot: SchemeSnapshot,
): Promise<DraftVersion> {
  const timestamp = now();

  try {
    const result = await generateDraftContent(fragment, snapshot);

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
      snapshot: createSchemeDraftSnapshot(snapshot),
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
        error instanceof Error ? error.message : copy.errors.draftFailed,
      model: process.env.AI_MODEL ?? "openai/gpt-5.5",
      promptTemplateVersion: "v1",
      snapshot: createSchemeDraftSnapshot(snapshot),
      createdAt: timestamp,
      updatedAt: now(),
    };
  }
}

async function createAiRevisionDraftVersion({
  fragment,
  draft,
  versionNo,
  sourceVersionId,
  sourceVersionNo,
  sourceContent,
  instruction,
  schemeSnapshot,
}: {
  fragment: Fragment;
  draft: Draft;
  versionNo: number;
  sourceVersionId: string;
  sourceVersionNo: number;
  sourceContent: string;
  instruction: string;
  schemeSnapshot: SchemeSnapshot;
}): Promise<DraftVersion> {
  const timestamp = now();
  const snapshot = createRevisionDraftSnapshot({
    sourceVersionId,
    sourceVersionNo,
    sourceContent,
    instruction: instruction.trim(),
    schemeSnapshot,
    snapshottedAt: timestamp,
  });

  try {
    const result = await reviseDraftContent({
      fragment,
      snapshot: schemeSnapshot,
      currentDraft: sourceContent,
      instruction: instruction.trim(),
    });

    return {
      id: createId("draft_version"),
      draftId: draft.id,
      versionNo,
      status: "completed",
      source: "ai_revision",
      content: result.content,
      errorMessage: null,
      model: result.model,
      promptTemplateVersion: result.promptTemplateVersion,
      snapshot,
      createdAt: timestamp,
      updatedAt: now(),
    };
  } catch (error) {
    return {
      id: createId("draft_version"),
      draftId: draft.id,
      versionNo,
      status: "failed",
      source: "ai_revision",
      content: "",
      errorMessage:
        error instanceof Error ? error.message : copy.errors.revisionFailed,
      model: process.env.AI_MODEL ?? "openai/gpt-5.5",
      promptTemplateVersion: "v1-revision",
      snapshot,
      createdAt: timestamp,
      updatedAt: now(),
    };
  }
}
