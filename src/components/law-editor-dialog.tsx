"use client"

import { PlusIcon, SaveIcon } from "lucide-react"
import { copy } from "@/lib/i18n"
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
        {isEdit ? copy.laws.editTrigger : copy.laws.createTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? copy.laws.editTitle : copy.laws.createTitle}
          </DialogTitle>
          <DialogDescription>{copy.laws.editorDescription}</DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          {law ? <input type="hidden" name="id" value={law.id} /> : null}
          <input type="hidden" name="visibility" value="private" />
          <DialogBody className="px-5 pb-4 pt-1 scroll-pb-4">
            <FieldGroup className="pb-1">
              <Field>
                <FieldLabel htmlFor="law-name">{copy.laws.nameLabel}</FieldLabel>
                <Input
                  id="law-name"
                  name="name"
                  autoComplete="off"
                  placeholder={copy.laws.namePlaceholder}
                  defaultValue={law?.name}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="law-prompt">
                  {copy.laws.promptLabel}
                </FieldLabel>
                <Textarea
                  id="law-prompt"
                  name="prompt"
                  autoComplete="off"
                  placeholder={copy.laws.promptPlaceholder}
                  defaultValue={law?.prompt}
                  className="min-h-56"
                  required
                />
                <FieldDescription>
                  {copy.laws.promptDescription}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="law-tags">{copy.laws.tagsLabel}</FieldLabel>
                <Input
                  id="law-tags"
                  name="tags"
                  autoComplete="off"
                  placeholder={copy.laws.tagsPlaceholder}
                  defaultValue={law?.tags.join("，")}
                />
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              {isEdit ? copy.laws.editSubmit : copy.laws.createSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
