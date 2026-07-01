"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createDraftsForFragment,
  createFragmentWithDrafts,
  createLaw,
  createScheme,
  deleteLaw,
  deleteScheme,
  retryDraft,
  saveManualDraftVersion,
  updateFragment,
  updateLaw,
  updateScheme,
} from "@/lib/data/demo-store";
import type { SchemeSelection, Visibility } from "@/lib/types";

const fragmentSchema = z.object({
  title: z.string().trim().optional(),
  content: z.string().trim().min(1),
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
  return (raw ?? "")
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function collectFragmentAction(formData: FormData) {
  const parsed = fragmentSchema.parse({
    title: stringValue(formData, "title"),
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
  const parsed = fragmentSchema.required({ title: true }).parse({
    title: stringValue(formData, "title"),
    content: stringValue(formData, "content"),
  });

  await updateFragment({ id, ...parsed });

  revalidatePath(`/fragments/${id}`);
  redirect(`/fragments/${id}`);
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

export async function saveDraftVersionAction(formData: FormData) {
  const draftId = stringValue(formData, "draftId");
  const content = z.string().trim().min(1).parse(stringValue(formData, "content"));

  await saveManualDraftVersion({ draftId, content });

  revalidatePath(`/drafts/${draftId}`);
  redirect(`/drafts/${draftId}`);
}

export async function createSchemeAction(formData: FormData) {
  const parsed = schemeSchema.parse({
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description"),
  });

  const scheme = await createScheme(parsed);

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

  await updateScheme({ id, ...parsed, lawIds: orderedLawIds });

  revalidatePath(`/schemes/${id}`);
  redirect(`/schemes/${id}`);
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
    visibility: stringValue(formData, "visibility") as Visibility,
  });

  const law = await createLaw({
    ...parsed,
    tags: parseTags(parsed.tags),
  });

  revalidatePath("/laws");
  redirect(`/laws/${law.id}`);
}

export async function updateLawAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = lawSchema.parse({
    name: stringValue(formData, "name"),
    prompt: stringValue(formData, "prompt"),
    tags: stringValue(formData, "tags"),
    visibility: stringValue(formData, "visibility") as Visibility,
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
