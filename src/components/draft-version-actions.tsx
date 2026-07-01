"use client"

import { EyeIcon, PencilIcon, RefreshCwIcon, SaveIcon } from "lucide-react"
import { parseDraftVersionSnapshot } from "@/lib/draft-snapshot"
import type { SchemeSnapshot } from "@/lib/types"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type ServerAction = (formData: FormData) => void

export function SnapshotDialog({
  action,
  draftId,
  versionId,
  snapshot,
}: {
  action: ServerAction
  draftId: string
  versionId: string
  snapshot: unknown
}) {
  const parsedSnapshot = parseDraftVersionSnapshot(snapshot)

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <EyeIcon data-icon="inline-start" aria-hidden="true" />
        查看来路
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {parsedSnapshot.ok ? "这一稿的来路" : "无法显示来路"}
          </DialogTitle>
          <DialogDescription>
            {parsedSnapshot.ok
              ? "这里记录的是这一稿当时如何被酝酿出来。"
              : "这份记录缺少可识别的生成信息。"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          {!parsedSnapshot.ok ? (
            <div className="grid min-h-52 place-items-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
              无法显示内容
            </div>
          ) : parsedSnapshot.data.type === "scheme" ? (
            <SchemeOriginView
              snapshot={parsedSnapshot.data.content}
              title="出稿方案"
            />
          ) : (
            <>
              <section className="rounded-xl border bg-muted/35 p-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  改写心愿
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {parsedSnapshot.data.content.instruction}
                </p>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    所依原稿
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {parsedSnapshot.data.content.sourceVersionNo}
                  </span>
                </div>
                <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
                  {parsedSnapshot.data.content.sourceContent}
                </pre>
              </section>

              <SchemeOriginView
                snapshot={parsedSnapshot.data.content.schemeSnapshot}
                title="仍参考的出稿方案"
              />
            </>
          )}
        </DialogBody>
        {parsedSnapshot.ok ? (
          <DialogFooter>
            <form action={action}>
              <input type="hidden" name="draftId" value={draftId} />
              <input type="hidden" name="versionId" value={versionId} />
              <Button type="submit">
                <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                再来一次
              </Button>
            </form>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SchemeOriginView({
  snapshot,
  title,
}: {
  snapshot: SchemeSnapshot
  title: string
}) {
  return (
    <>
      <section className="rounded-xl border bg-muted/35 p-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="mt-3 font-heading text-base font-medium">
          {snapshot.schemeName}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {snapshot.schemeDescription}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          创作准则
        </h3>
        {snapshot.laws.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.laws.map((law) => (
              <div key={law.lawId} className="rounded-lg border bg-card p-3">
                <p className="font-medium">{law.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {law.prompt}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
            这里没有记录创作准则。
          </div>
        )}
      </section>
    </>
  )
}

export function RetryFromSnapshotButton({
  action,
  draftId,
  versionId,
}: {
  action: ServerAction
  draftId: string
  versionId: string
}) {
  return (
    <form action={action}>
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="versionId" value={versionId} />
      <Button type="submit" variant="outline" size="sm">
        <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
        再来一次
      </Button>
    </form>
  )
}

export function DraftEditDialog({
  action,
  draftId,
  versionId,
  content,
}: {
  action: ServerAction
  draftId: string
  versionId: string
  content: string
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <PencilIcon data-icon="inline-start" aria-hidden="true" />
        编辑内容
      </DialogTrigger>
      <DialogContent className="h-[min(88vh,calc(100vh-2rem))] w-[calc(100vw-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>编辑这一稿</DialogTitle>
          <DialogDescription>
            保存后会作为新的稿次加入这个成稿卷，原稿会保留。
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          <input type="hidden" name="draftId" value={draftId} />
          <input type="hidden" name="versionId" value={versionId} />
          <DialogBody className="flex flex-1 overflow-hidden py-1">
            <FieldGroup className="min-h-0 flex-1">
              <Field className="min-h-0 flex-1">
                <FieldLabel htmlFor={`draft-content-${versionId}`}>
                  稿件内容
                </FieldLabel>
                <Textarea
                  id={`draft-content-${versionId}`}
                  name="content"
                  autoComplete="off"
                  className="min-h-0 flex-1 resize-none overflow-y-auto [field-sizing:fixed] bg-background leading-7 focus-visible:ring-inset"
                  defaultValue={content}
                  required
                />
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              存为新稿
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
