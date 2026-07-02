"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createDraftsForFragment,
  createFragmentWithDrafts,
  createLaw,
  createScheme,
  deleteFragment,
  deleteLaw,
  deleteScheme,
  removeLawFromScheme,
  reviseDraftFromInstruction,
  retryDraft,
  retryDraftFromSnapshot,
  saveManualDraftVersion,
  updateFragmentContent,
  updateFragmentTitle,
  updateLaw,
  updateScheme,
} from "@/lib/data/demo-store";
import type { SchemeSelection, Visibility } from "@/lib/types";

const fragmentContentSchema = z.object({
  content: z.string().trim().min(1),
});

const fragmentTitleSchema = z.object({
  title: z.string().trim().min(1),
});

const schemeSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

const lawSchema = z.object({
  name: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  tags: z.string().trim().optional(),
  visibility: z.enum(["private", "public"]).default("private"),
});

const quickLawSchema = z.object({
  name: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  tags: z.string().trim().optional(),
});

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function parseSelections(formData: FormData): SchemeSelection[] {
  return formData
    .getAll("schemeId")
    .map(String)
    .map((schemeId) => ({
      schemeId,
      count: Number(formData.get(`count_${schemeId}`) ?? 1),
    }))
    .filter((selection) => selection.schemeId && selection.count > 0)
    .map((selection) => ({
      ...selection,
      count: Math.min(3, Math.max(1, Math.floor(selection.count))),
    }));
}

function parseTags(raw: string | undefined) {
  const tags = (raw ?? "")
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return Array.from(new Set(tags));
}

export async function collectFragmentAction(formData: FormData) {
  const parsed = fragmentContentSchema.parse({
    content: stringValue(formData, "content"),
  });

  const fragment = await createFragmentWithDrafts({
    ...parsed,
    selections: parseSelections(formData),
  });

  revalidatePath("/fragments");
  redirect(`/fragments/${fragment.id}`);
}

export async function updateFragmentAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = fragmentContentSchema.parse({
    content: stringValue(formData, "content"),
  });

  await updateFragmentContent({ id, ...parsed });
  await createDraftsForFragment(id, parseSelections(formData));

  revalidatePath(`/fragments/${id}`);
  revalidatePath("/fragments");
  redirect(`/fragments/${id}`);
}

export async function updateFragmentTitleAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = fragmentTitleSchema.parse({
    title: stringValue(formData, "title"),
  });

  await updateFragmentTitle({ id, ...parsed });

  revalidatePath(`/fragments/${id}`);
  revalidatePath("/fragments");
}

export async function deleteFragmentAction(formData: FormData) {
  await deleteFragment(stringValue(formData, "id"));

  revalidatePath("/fragments");
  redirect("/fragments");
}

export async function generateDraftsAction(formData: FormData) {
  const fragmentId = stringValue(formData, "fragmentId");

  await createDraftsForFragment(fragmentId, parseSelections(formData));

  revalidatePath(`/fragments/${fragmentId}`);
  redirect(`/fragments/${fragmentId}`);
}

export async function retryDraftAction(formData: FormData) {
  const draftId = stringValue(formData, "draftId");

  await retryDraft(draftId);

  revalidatePath(`/drafts/${draftId}`);
  redirect(`/drafts/${draftId}`);
}

export async function retryDraftFromSnapshotAction(formData: FormData) {
  const draftId = stringValue(formData, "draftId");

  await retryDraftFromSnapshot({
    draftId,
    versionId: stringValue(formData, "versionId"),
  });

  revalidatePath(`/drafts/${draftId}`);
  redirect(`/drafts/${draftId}`);
}

export async function saveDraftVersionAction(formData: FormData) {
  const draftId = stringValue(formData, "draftId");
  const content = z.string().trim().min(1).parse(stringValue(formData, "content"));

  await saveManualDraftVersion({
    draftId,
    sourceVersionId: stringValue(formData, "versionId"),
    content,
  });

  revalidatePath(`/drafts/${draftId}`);
  redirect(`/drafts/${draftId}`);
}

export async function reviseDraftAction(formData: FormData) {
  const draftId = stringValue(formData, "draftId");
  const versionId = stringValue(formData, "versionId");
  const instruction = z
    .string()
    .trim()
    .min(1)
    .parse(stringValue(formData, "instruction"));

  await reviseDraftFromInstruction({
    draftId,
    versionId,
    instruction,
  });

  revalidatePath(`/drafts/${draftId}`);
  redirect(`/drafts/${draftId}`);
}

export async function createSchemeAction(formData: FormData) {
  const parsed = schemeSchema.parse({
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description"),
  });
  const lawIds = formData.getAll("lawId").map(String).filter(Boolean);
  const newLawName = stringValue(formData, "newLawName").trim();
  const newLawPrompt = stringValue(formData, "newLawPrompt").trim();

  if (newLawName && newLawPrompt) {
    const law = await createLaw({
      name: newLawName,
      prompt: newLawPrompt,
      tags: parseTags(stringValue(formData, "newLawTags")),
      visibility: "private",
    });
    lawIds.push(law.id);
  }

  const scheme = await createScheme({ ...parsed, lawIds });

  revalidatePath("/schemes");
  redirect(`/schemes/${scheme.id}`);
}

export async function updateSchemeAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = schemeSchema.parse({
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description"),
  });
  const orderedLawIds = formData
    .getAll("lawId")
    .map(String)
    .map((lawId) => ({
      lawId,
      order: Number(formData.get(`order_${lawId}`) ?? 999),
    }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.lawId);
  const newLawName = stringValue(formData, "newLawName").trim();
  const newLawPrompt = stringValue(formData, "newLawPrompt").trim();

  if (newLawName && newLawPrompt) {
    const law = await createLaw({
      name: newLawName,
      prompt: newLawPrompt,
      tags: parseTags(stringValue(formData, "newLawTags")),
      visibility: "private",
    });
    orderedLawIds.push(law.id);
  }

  await updateScheme({ id, ...parsed, lawIds: orderedLawIds });

  revalidatePath(`/schemes/${id}`);
  redirect(`/schemes/${id}`);
}

export async function removeLawFromSchemeAction(formData: FormData) {
  const schemeId = stringValue(formData, "schemeId");

  await removeLawFromScheme({
    schemeId,
    lawId: stringValue(formData, "lawId"),
  });

  revalidatePath(`/schemes/${schemeId}`);
  redirect(`/schemes/${schemeId}`);
}

export async function deleteSchemeAction(formData: FormData) {
  await deleteScheme(stringValue(formData, "id"));

  revalidatePath("/schemes");
  redirect("/schemes");
}

export async function createLawAction(formData: FormData) {
  const parsed = lawSchema.parse({
    name: stringValue(formData, "name"),
    prompt: stringValue(formData, "prompt"),
    tags: stringValue(formData, "tags"),
    visibility: (stringValue(formData, "visibility") || "private") as Visibility,
  });

  const law = await createLaw({
    ...parsed,
    tags: parseTags(parsed.tags),
  });

  revalidatePath("/laws");
  redirect(`/laws/${law.id}`);
}

export async function createLawFromSchemeDialogAction(input: {
  name: string;
  prompt: string;
  tags?: string;
}) {
  const parsed = quickLawSchema.parse(input);
  const law = await createLaw({
    ...parsed,
    tags: parseTags(parsed.tags),
    visibility: "private",
  });

  revalidatePath("/laws");
  revalidatePath("/schemes");

  return law;
}

export async function updateLawAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = lawSchema.parse({
    name: stringValue(formData, "name"),
    prompt: stringValue(formData, "prompt"),
    tags: stringValue(formData, "tags"),
    visibility: (stringValue(formData, "visibility") || "private") as Visibility,
  });

  await updateLaw({
    id,
    ...parsed,
    tags: parseTags(parsed.tags),
  });

  revalidatePath(`/laws/${id}`);
  redirect(`/laws/${id}`);
}

export async function deleteLawAction(formData: FormData) {
  await deleteLaw(stringValue(formData, "id"));

  revalidatePath("/laws");
  revalidatePath("/schemes");
  redirect("/laws");
}
