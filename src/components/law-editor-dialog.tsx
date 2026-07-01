"use client"

import { PlusIcon, SaveIcon } from "lucide-react"
import type { Law } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function LawEditorDialog({
  action,
  law,
}: {
  action: (formData: FormData) => void
  law?: Law
}) {
  const isEdit = Boolean(law)

  return (
    <Dialog>
      <DialogTrigger render={<Button variant={isEdit ? "outline" : "default"} />}>
        {isEdit ? (
          <SaveIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {isEdit ? "修订" : "收录法则"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "修订创作法则" : "收录创作法则"}</DialogTitle>
          <DialogDescription>
            一条法则就是一条可复用的创作判断。它会在出稿时和方案一起被快照保存。
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          {law ? <input type="hidden" name="id" value={law.id} /> : null}
          <input type="hidden" name="visibility" value="private" />
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="law-name">名称</FieldLabel>
                <Input
                  id="law-name"
                  name="name"
                  autoComplete="off"
                  placeholder="例如：黄金三秒…"
                  defaultValue={law?.name}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="law-prompt">法则内容</FieldLabel>
                <Textarea
                  id="law-prompt"
                  name="prompt"
                  autoComplete="off"
                  placeholder="例如：开头 3 秒内必须让观众知道这条内容和自己有什么关系…"
                  defaultValue={law?.prompt}
                  className="min-h-56"
                  required
                />
                <FieldDescription>
                  这段内容会作为 AI 出稿时的创作规则之一。
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="law-tags">标签</FieldLabel>
                <Input
                  id="law-tags"
                  name="tags"
                  autoComplete="off"
                  placeholder="开头，表达，短视频…"
                  defaultValue={law?.tags.join("，")}
                />
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              {isEdit ? "保存修订" : "收录"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
