import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import {
  generateDraftsAction,
  updateFragmentAction,
} from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { GenerateForm } from "@/components/generate-form";
import { StatusPill } from "@/components/status-pill";
import { getFragmentPageData } from "@/lib/data/demo-store";
import { draftSourceLabel, formatDate } from "@/lib/utils";

type FragmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function FragmentDetailPage({
  params,
}: FragmentDetailPageProps) {
  const { id } = await params;
  const { fragment, schemes, drafts } = await getFragmentPageData(id);

  if (!fragment) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">碎片札记</p>
        <h1 className="page-title">{fragment.title}</h1>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form action={updateFragmentAction} className="card space-y-3 p-4">
          <input type="hidden" name="id" value={fragment.id} />
          <label className="block text-sm font-medium" htmlFor="title">
            碎片标题
          </label>
          <input
            id="title"
            name="title"
            className="field"
            defaultValue={fragment.title}
            required
          />
          <label className="block text-sm font-medium" htmlFor="content">
            原始碎片内容
          </label>
          <textarea
            id="content"
            name="content"
            className="field min-h-52 resize-y"
            defaultValue={fragment.content}
            required
          />
          <div className="flex justify-end">
            <FormSubmitButton icon="save" title="保存">
              保存
            </FormSubmitButton>
          </div>
        </form>

        <div className="card p-4">
          <h2 className="section-title">札记信息</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">标题来源</dt>
              <dd>{fragment.titleSource === "ai" ? "AI" : "手动"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">创建时间</dt>
              <dd>{formatDate(fragment.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">成稿数量</dt>
              <dd>{drafts.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <GenerateForm
        fragmentId={fragment.id}
        schemes={schemes}
        action={generateDraftsAction}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">派生出的成稿</h2>
          <span className="text-sm text-[var(--muted)]">{drafts.length} 个</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => {
            const latestVersion = draft.versions.at(-1);

            return (
              <Link
                key={draft.id}
                href={`/drafts/${draft.id}`}
                className="card block p-4 transition-colors hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                      <ScrollText size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold">
                        {draft.schemeSnapshot.schemeName}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {draft.versions.length} 个稿次
                      </p>
                    </div>
                  </div>
                  {latestVersion ? <StatusPill status={latestVersion.status} /> : null}
                </div>
                {latestVersion ? (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    第 {latestVersion.versionNo} 稿，
                    {draftSourceLabel(latestVersion.source)}，
                    {formatDate(latestVersion.createdAt)}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
