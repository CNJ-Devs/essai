"use client"

import { SaveIcon, SparklesIcon } from "lucide-react"
import type { Fragment, Scheme } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { SchemeSelectionScroller } from "@/components/scheme-selection-scroller"

const schemeSelectionHelp =
  "想让这条碎片现在就长出几种稿子，可以在下面点选方案并设置数量；也可以先收起来，之后在碎片札记里再慢慢出稿。"

export function FragmentComposeForm({
  action,
  fragment,
  schemes,
  mode,
}: {
  action: (formData: FormData) => void
  fragment?: Fragment
  schemes: Scheme[]
  mode: "create" | "edit"
}) {
  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col gap-5">
      {fragment ? <input type="hidden" name="id" value={fragment.id} /> : null}
      <FieldGroup className="min-h-0 flex-1 gap-5">
        <Field className="min-h-[20rem] flex-1">
          <FieldLabel htmlFor="fragment-content" className="sr-only">
            碎片内容
          </FieldLabel>
          <Textarea
            id="fragment-content"
            name="content"
            autoComplete="off"
            placeholder="把刚冒出来的词、句子、情绪、观点、吐槽或素材放在这里…"
            defaultValue={fragment?.content}
            required
            rows={10}
            className="field-sizing-fixed min-h-0 flex-1 resize-none overflow-y-auto bg-card p-4 text-base leading-8 md:text-base"
          />
        </Field>

        <div className="shrink-0">
          <SchemeSelectionScroller
            schemes={schemes}
            description={schemeSelectionHelp}
          />
        </div>
      </FieldGroup>

      <div className="sticky bottom-4 z-20 flex shrink-0 justify-end">
        <Button type="submit" size="lg" className="shadow-md">
          {mode === "create" ? (
            <SparklesIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {mode === "create" ? "收集" : "确认"}
        </Button>
      </div>
    </form>
  )
}
