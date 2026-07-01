import { notFound } from "next/navigation";
import { deleteLawAction, updateLawAction } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getLawPageData } from "@/lib/data/demo-store";

type LawPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LawPage({ params }: LawPageProps) {
  const { id } = await params;
  const { law } = await getLawPageData(id);

  if (!law) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">法则条文</p>
        <h1 className="page-title">{law.name}</h1>
      </header>

      <form action={updateLawAction} className="card space-y-4 p-4">
        <input type="hidden" name="id" value={law.id} />
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="name">
                法则名称
              </label>
              <input
                id="name"
                name="name"
                className="field mt-2"
                defaultValue={law.name}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="tags">
                标签
              </label>
              <input
                id="tags"
                name="tags"
                className="field mt-2"
                defaultValue={law.tags.join("，")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="visibility">
                可见性
              </label>
              <select
                id="visibility"
                name="visibility"
                className="field mt-2"
                defaultValue={law.visibility}
              >
                <option value="private">私有</option>
                <option value="public">公开</option>
              </select>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm text-[var(--muted)]">
              当前版本：v{law.version}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="prompt">
              法则 prompt
            </label>
            <textarea
              id="prompt"
              name="prompt"
              className="field mt-2 min-h-80 resize-y"
              defaultValue={law.prompt}
              required
            />
          </div>
        </div>
        <div className="flex justify-end">
          <FormSubmitButton icon="save" title="修订法则">
            修订法则
          </FormSubmitButton>
        </div>
      </form>

      <form action={deleteLawAction} className="flex justify-end">
        <input type="hidden" name="id" value={law.id} />
        <FormSubmitButton icon="trash" variant="danger" title="删除法则">
          删除法则
        </FormSubmitButton>
      </form>
    </div>
  );
}
