import { notFound } from "next/navigation"
import { deleteLawAction, updateLawAction } from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { LawEditorDialog } from "@/components/law-editor-dialog"
import { Badge } from "@/components/ui/badge"
import { getLawPageData } from "@/lib/data/demo-store"

type LawPageProps = {
  params: Promise<{ id: string }>
}

export default async function LawPage({ params }: LawPageProps) {
  const { id } = await params
  const { law } = await getLawPageData(id)

  if (!law) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{law.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {law.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LawEditorDialog action={updateLawAction} law={law} />
          <ConfirmAction
            action={deleteLawAction}
            hiddenFields={{ id: law.id }}
            title="删除创作法则"
            subtitle="删除后，已生成成稿中的快照不会受影响，但它会从当前法典和已绑定方案里移除。"
            confirmLabel="删除"
          />
        </div>
      </header>

      <article className="paper-surface rounded-2xl border p-5 text-base leading-8 shadow-xs">
        {law.prompt}
      </article>
    </div>
  )
}
