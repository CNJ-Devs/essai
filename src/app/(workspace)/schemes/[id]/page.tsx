import { notFound } from "next/navigation"
import { XIcon } from "lucide-react"
import {
  deleteSchemeAction,
  removeLawFromSchemeAction,
  updateSchemeAction,
} from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { SchemeEditorDialog } from "@/components/scheme-editor-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSchemePageData } from "@/lib/data/demo-store"
import type { Law } from "@/lib/types"

type SchemePageProps = {
  params: Promise<{ id: string }>
}

export default async function SchemePage({ params }: SchemePageProps) {
  const { id } = await params
  const { scheme, laws } = await getSchemePageData(id)

  if (!scheme) {
    notFound()
  }

  const boundLaws = scheme.lawIds
    .map((lawId) => laws.find((law) => law.id === lawId))
    .filter((law): law is Law => Boolean(law))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{scheme.name}</h1>
          <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-muted-foreground">
            {scheme.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SchemeEditorDialog
            action={updateSchemeAction}
            laws={laws}
            scheme={scheme}
          />
          <ConfirmAction
            action={deleteSchemeAction}
            hiddenFields={{ id: scheme.id }}
            title="删除出稿方案"
            subtitle="删除后不会影响已经生成的旧成稿快照，但之后不能再选择这个方案。"
            confirmLabel="删除"
          />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">创作法则</h2>
        {boundLaws.length > 0 ? (
          <div className="flex flex-col gap-3">
            {boundLaws.map((law, index) => (
              <Card key={law.id} className="min-h-32">
                <CardHeader>
                  <CardTitle className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 break-words">{law.name}</span>
                  </CardTitle>
                  <CardAction>
                    <form action={removeLawFromSchemeAction}>
                      <input type="hidden" name="schemeId" value={scheme.id} />
                      <input type="hidden" name="lawId" value={law.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`移除 ${law.name}`}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </form>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                    {law.prompt}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            这个方案还没有绑定创作法则。
          </div>
        )}
      </section>
    </div>
  )
}
