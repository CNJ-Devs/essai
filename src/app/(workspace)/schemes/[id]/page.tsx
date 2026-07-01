import { notFound } from "next/navigation";
import {
  deleteSchemeAction,
  updateSchemeAction,
} from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getSchemePageData } from "@/lib/data/demo-store";

type SchemePageProps = {
  params: Promise<{ id: string }>;
};

export default async function SchemePage({ params }: SchemePageProps) {
  const { id } = await params;
  const { scheme, laws } = await getSchemePageData(id);

  if (!scheme) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">方案笺</p>
        <h1 className="page-title">{scheme.name}</h1>
      </header>

      <form action={updateSchemeAction} className="card space-y-4 p-4">
        <input type="hidden" name="id" value={scheme.id} />
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <label className="block text-sm font-medium" htmlFor="name">
              出稿方案名称
            </label>
            <input
              id="name"
              name="name"
              className="field mt-2"
              defaultValue={scheme.name}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="description">
              方案说明
            </label>
            <textarea
              id="description"
              name="description"
              className="field mt-2 min-h-44 resize-y"
              defaultValue={scheme.description}
              required
            />
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="section-title">绑定的创作法则</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {laws.map((law) => {
              const activeIndex = scheme.lawIds.indexOf(law.id);
              const active = activeIndex >= 0;

              return (
                <label
                  key={law.id}
                  className="flex gap-3 rounded-md border border-[var(--line)] bg-[var(--soft)] p-3"
                >
                  <input
                    type="checkbox"
                    name="lawId"
                    value={law.id}
                    defaultChecked={active}
                    className="mt-1 size-4"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{law.name}</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                      {law.prompt}
                    </span>
                  </span>
                  <input
                    name={`order_${law.id}`}
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={active ? activeIndex + 1 : laws.length}
                    className="field h-10 w-16"
                    aria-label={`${law.name} 顺序`}
                  />
                </label>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-3">
          <FormSubmitButton icon="save" title="保存出稿方案">
            保存出稿方案
          </FormSubmitButton>
        </div>
      </form>

      <form action={deleteSchemeAction} className="flex justify-end">
        <input type="hidden" name="id" value={scheme.id} />
        <FormSubmitButton icon="trash" variant="danger" title="删除出稿方案">
          删除出稿方案
        </FormSubmitButton>
      </form>
    </div>
  );
}
