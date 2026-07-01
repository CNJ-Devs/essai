"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import type { Scheme } from "@/lib/types";
import { cn, summarize } from "@/lib/utils";
import { FormSubmitButton } from "@/components/form-submit-button";

type CollectFormProps = {
  schemes: Scheme[];
  action: (formData: FormData) => void;
};

export function CollectForm({ schemes, action }: CollectFormProps) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const selectedEntries = useMemo(() => Object.entries(selected), [selected]);

  function setCount(schemeId: string, count: number) {
    setSelected((current) => {
      const next = Math.min(3, Math.max(1, count));
      return { ...current, [schemeId]: next };
    });
  }

  function toggle(schemeId: string) {
    setSelected((current) => {
      if (current[schemeId]) {
        const next = { ...current };
        delete next[schemeId];
        return next;
      }
      return { ...current, [schemeId]: 1 };
    });
  }

  return (
    <form action={action} className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="fragment-title">
            碎片标题
          </label>
          <input
            id="fragment-title"
            name="title"
            className="field"
            placeholder="可空，系统会自动起名"
          />

          <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="fragment-content">
            碎片内容
          </label>
          <textarea
            id="fragment-content"
            name="content"
            className="field min-h-40 resize-y"
            placeholder="一个关键词、一句话、一段乱想，都可以先收住。"
            required
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[var(--ink)]">选择出稿方案</span>
            <span className="text-xs text-[var(--muted)]">×1 / ×2 / ×3</span>
          </div>
          <div className="flex max-w-full gap-3 overflow-x-auto pb-2 lg:max-h-72 lg:flex-col lg:overflow-y-auto lg:pb-0">
            {schemes.map((scheme) => {
              const count = selected[scheme.id] ?? 1;
              const active = Boolean(selected[scheme.id]);

              return (
                <div
                  key={scheme.id}
                  className={cn(
                    "min-w-72 max-w-[calc(100vw-4rem)] rounded-md border p-3 transition-colors lg:min-w-0 lg:max-w-none",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--soft)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-[var(--ink)]"
                      onClick={() => toggle(scheme.id)}
                      title={active ? "取消选择" : "选择出稿方案"}
                    >
                      <CheckCircle2
                        size={20}
                        aria-hidden="true"
                        className={active ? "fill-[var(--accent)] text-white" : "text-[var(--muted)]"}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-[var(--ink)]">{scheme.name}</p>
                        <div className="flex h-8 items-center rounded-md border border-[var(--line)] bg-white">
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center"
                            title="减少稿次"
                            onClick={() => setCount(scheme.id, count - 1)}
                          >
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="min-w-8 text-sm font-semibold"
                            title="选择并切换稿次数量"
                            onClick={() => setCount(scheme.id, count === 3 ? 1 : count + 1)}
                          >
                            ×{count}
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center"
                            title="增加稿次"
                            onClick={() => setCount(scheme.id, count + 1)}
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {summarize(scheme.description, 82)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedEntries.map(([schemeId, count]) => (
            <span key={schemeId}>
              <input type="hidden" name="schemeId" value={schemeId} />
              <input type="hidden" name={`count_${schemeId}`} value={count} />
            </span>
          ))}

          <p className="text-sm leading-6 text-[var(--muted)]">
            收集后会进入拾光集。已选出稿方案会自动酝酿成稿，也可以稍后在碎片札记里出稿。
          </p>
          <FormSubmitButton icon="sparkles" className="w-full" title="收集">
            收集
          </FormSubmitButton>
        </div>
      </div>
    </form>
  );
}
