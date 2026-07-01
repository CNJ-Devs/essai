import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  retryDraftAction,
  saveDraftVersionAction,
} from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusPill } from "@/components/status-pill";
import { getDraftPageData } from "@/lib/data/demo-store";
import { draftSourceLabel, formatDate } from "@/lib/utils";

type DraftPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
};

export default async function DraftPage({ params, searchParams }: DraftPageProps) {
  const { id } = await params;
  const { v } = await searchParams;
  const { draft, fragment } = await getDraftPageData(id);

  if (!draft || !fragment) {
    notFound();
  }

  const requestedVersion = Number(v ?? draft.versions.at(-1)?.versionNo ?? 1);
  const activeVersion =
    draft.versions.find((version) => version.versionNo === requestedVersion) ??
    draft.versions.at(-1);

  if (!activeVersion) {
    notFound();
  }

  const activeIndex = draft.versions.findIndex(
    (version) => version.id === activeVersion.id,
  );
  const previous = draft.versions[activeIndex - 1];
  const next = draft.versions[activeIndex + 1];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">成稿卷</p>
          <h1 className="page-title">{draft.schemeSnapshot.schemeName}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            来自碎片：
            <Link href={`/fragments/${fragment.id}`} className="font-medium text-[var(--ink)] underline underline-offset-4">
              {fragment.title}
            </Link>
          </p>
        </div>
        <form action={retryDraftAction}>
          <input type="hidden" name="draftId" value={draft.id} />
          <FormSubmitButton icon="refresh" title="再试一次">
            再试一次
          </FormSubmitButton>
        </form>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <article className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4">
            <div className="flex items-center gap-3">
              <StatusPill status={activeVersion.status} />
              <span className="text-sm font-medium">
                第 {activeVersion.versionNo} 稿，{draftSourceLabel(activeVersion.source)}
              </span>
              <span className="text-sm text-[var(--muted)]">
                {formatDate(activeVersion.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={previous ? `/drafts/${draft.id}?v=${previous.versionNo}` : "#"}
                className={`inline-flex size-10 items-center justify-center rounded-md border border-[var(--line)] bg-white ${previous ? "text-[var(--ink)]" : "pointer-events-none text-[var(--line)]"}`}
                title="上一稿"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
              <Link
                href={next ? `/drafts/${draft.id}?v=${next.versionNo}` : "#"}
                className={`inline-flex size-10 items-center justify-center rounded-md border border-[var(--line)] bg-white ${next ? "text-[var(--ink)]" : "pointer-events-none text-[var(--line)]"}`}
                title="下一稿"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {activeVersion.status === "failed" ? (
            <div className="p-4 text-sm text-[var(--danger)]">
              {activeVersion.errorMessage}
            </div>
          ) : (
            <pre className="max-h-[68vh] overflow-y-auto whitespace-pre-wrap p-5 font-sans text-[15px] leading-7 text-[var(--ink)]">
              {activeVersion.content}
            </pre>
          )}
        </article>

        <aside className="space-y-4">
          <form action={saveDraftVersionAction} className="card space-y-3 p-4">
            <input type="hidden" name="draftId" value={draft.id} />
            <label className="block text-sm font-medium" htmlFor="draft-content">
              编辑当前稿次
            </label>
            <textarea
              id="draft-content"
              name="content"
              className="field min-h-64 resize-y"
              defaultValue={activeVersion.content}
              required
            />
            <div className="flex justify-end">
              <FormSubmitButton icon="save" title="保存">
                保存
              </FormSubmitButton>
            </div>
          </form>

          <div className="card p-4">
            <h2 className="section-title">本成稿使用的出稿方案</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
              {draft.schemeSnapshot.schemeDescription}
            </p>
            <div className="mt-4 space-y-3">
              {draft.schemeSnapshot.laws.map((law) => (
                <div key={law.lawId} className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{law.name}</p>
                    <span className="text-xs text-[var(--muted)]">v{law.version}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {law.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
