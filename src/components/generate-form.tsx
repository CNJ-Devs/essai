"use client";

import { useState } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import type { Scheme } from "@/lib/types";
import { cn, summarize } from "@/lib/utils";
import { FormSubmitButton } from "@/components/form-submit-button";

type GenerateFormProps = {
  fragmentId: string;
  schemes: Scheme[];
  action: (formData: FormData) => void;
};

export function GenerateForm({ fragmentId, schemes, action }: GenerateFormProps) {
  const [selected, setSelected] = useState<Record<string, number>>({});

  function setCount(schemeId: string, count: number) {
    setSelected((current) => ({
      ...current,
      [schemeId]: Math.min(3, Math.max(1, count)),
    }));
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
    <form action={action} className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm">
      <input type="hidden" name="fragmentId" value={fragmentId} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">手动出稿</h2>
        <span className="text-xs text-[var(--muted)]">每个方案可出 1 到 3 稿</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {schemes.map((scheme) => {
          const count = selected[scheme.id] ?? 1;
          const active = Boolean(selected[scheme.id]);

          return (
            <div
              key={scheme.id}
              className={cn(
                "rounded-md border p-3",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-[var(--soft)]",
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full"
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
                    <p className="font-medium">{scheme.name}</p>
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
                    {summarize(scheme.description, 76)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {Object.entries(selected).map(([schemeId, count]) => (
        <span key={schemeId}>
          <input type="hidden" name="schemeId" value={schemeId} />
          <input type="hidden" name={`count_${schemeId}`} value={count} />
        </span>
      ))}
      <div className="mt-4 flex justify-end">
        <FormSubmitButton icon="wand" title="出稿">
          出稿
        </FormSubmitButton>
      </div>
    </form>
  );
}
