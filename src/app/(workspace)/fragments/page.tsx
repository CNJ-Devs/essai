import Link from "next/link";
import { FileText, ScrollText } from "lucide-react";
import { collectFragmentAction } from "@/app/actions";
import { CollectForm } from "@/components/collect-form";
import { StatusPill } from "@/components/status-pill";
import { getWorkspaceData } from "@/lib/data/demo-store";
import { formatDate, summarize } from "@/lib/utils";

export default async function FragmentsPage() {
  const { fragments, schemes, drafts } = await getWorkspaceData();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">EssAI 一闪</p>
          <h1 className="page-title">拾光集</h1>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
          灵光乍现，也有去处。
        </p>
      </header>

      <CollectForm schemes={schemes} action={collectFragmentAction} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">碎片</h2>
          <span className="text-sm text-[var(--muted)]">{fragments.length} 条</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fragments.map((fragment) => {
            const fragmentDrafts = drafts.filter(
              (draft) => draft.fragmentId === fragment.id,
            );
            const latestVersion = fragmentDrafts
              .flatMap((draft) => draft.versions)
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              )[0];

            return (
              <Link
                key={fragment.id}
                href={`/fragments/${fragment.id}`}
                className="card block p-4 transition-colors hover:border-[var(--accent)]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--blue-soft)] text-[var(--blue)]">
                      <FileText size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-semibold text-[var(--ink)]">
                        {fragment.title}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDate(fragment.createdAt)}
                      </p>
                    </div>
                  </div>
                  {latestVersion ? <StatusPill status={latestVersion.status} /> : null}
                </div>
                <p className="min-h-12 text-sm leading-6 text-[var(--muted)]">
                  {summarize(fragment.content, 110)}
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
                  <ScrollText size={16} aria-hidden="true" />
                  <span>{fragmentDrafts.length} 个成稿</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
