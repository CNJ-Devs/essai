import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { createLawAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getWorkspaceData } from "@/lib/data/demo-store";
import { formatDate, summarize } from "@/lib/utils";

export default async function LawsPage() {
  const { laws } = await getWorkspaceData();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">创作法典</p>
        <h1 className="page-title">创作法则</h1>
      </header>

      <form action={createLawAction} className="card grid gap-4 p-4 xl:grid-cols-[240px_minmax(0,1fr)_180px_auto]">
        <div>
          <label className="block text-sm font-medium" htmlFor="law-name">
            法则名称
          </label>
          <input id="law-name" name="name" className="field mt-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="law-prompt">
            法则 prompt
          </label>
          <textarea
            id="law-prompt"
            name="prompt"
            className="field mt-2 min-h-24 resize-y"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <label className="block text-sm font-medium" htmlFor="law-tags">
              标签
            </label>
            <input id="law-tags" name="tags" className="field mt-2" />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="visibility">
              可见性
            </label>
            <select id="visibility" name="visibility" className="field mt-2" defaultValue="private">
              <option value="private">私有</option>
              <option value="public">公开</option>
            </select>
          </div>
        </div>
        <div className="flex items-end">
          <FormSubmitButton icon="plus" title="收录法则">
            收录法则
          </FormSubmitButton>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {laws.map((law) => (
          <Link
            key={law.id}
            href={`/laws/${law.id}`}
            className="card block p-4 transition-colors hover:border-[var(--accent)]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                  <BookOpenText size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">{law.name}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    v{law.version} · {formatDate(law.updatedAt)}
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-[var(--soft)] px-2 py-1 text-xs text-[var(--muted)]">
                {law.visibility === "private" ? "私有" : "公开"}
              </span>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)]">
              {summarize(law.prompt, 116)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {law.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-[var(--blue-soft)] px-2 py-1 text-xs text-[var(--blue)]">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
