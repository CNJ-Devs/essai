import Link from "next/link";
import { FilePenLine } from "lucide-react";
import { createSchemeAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getWorkspaceData } from "@/lib/data/demo-store";
import { formatDate, summarize } from "@/lib/utils";

export default async function SchemesPage() {
  const { schemes, laws } = await getWorkspaceData();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">方案簿</p>
        <h1 className="page-title">出稿方案</h1>
      </header>

      <form action={createSchemeAction} className="card grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_auto]">
        <div>
          <label className="block text-sm font-medium" htmlFor="scheme-name">
            出稿方案名称
          </label>
          <input id="scheme-name" name="name" className="field mt-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="scheme-description">
            方案说明
          </label>
          <textarea
            id="scheme-description"
            name="description"
            className="field mt-2 min-h-24 resize-y"
            required
          />
        </div>
        <div className="flex items-end">
          <FormSubmitButton icon="plus" title="新建出稿方案">
            新建出稿方案
          </FormSubmitButton>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {schemes.map((scheme) => {
          const schemeLaws = scheme.lawIds
            .map((lawId) => laws.find((law) => law.id === lawId))
            .filter(Boolean);

          return (
            <Link
              key={scheme.id}
              href={`/schemes/${scheme.id}`}
              className="card block p-4 transition-colors hover:border-[var(--accent)]"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--blue-soft)] text-[var(--blue)]">
                  <FilePenLine size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold">{scheme.name}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatDate(scheme.updatedAt)}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                {summarize(scheme.description, 116)}
              </p>
              <p className="mt-4 text-sm text-[var(--muted)]">
                已绑定 {schemeLaws.length} 条法则
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
