import Link from "next/link"
import { notFound } from "next/navigation"
import { PencilIcon } from "lucide-react"
import {
  deleteFragmentAction,
  generateDraftsAction,
} from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { DraftGenerateDialog } from "@/components/draft-generate-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { getFragmentPageData } from "@/lib/data/demo-store"
import { cn, formatDate, summarize } from "@/lib/utils"

type FragmentDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function FragmentDetailPage({
  params,
}: FragmentDetailPageProps) {
  const { id } = await params
  const { fragment, schemes, drafts } = await getFragmentPageData(id)

  if (!fragment) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="page-title min-w-0 break-words">{fragment.title}</h1>
          <div className="text-sm text-muted-foreground">
            {formatDate(fragment.createdAt)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/fragments/${fragment.id}/edit`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-foreground/20 bg-card shadow-xs",
            )}
          >
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            调整内容
          </Link>
          <DraftGenerateDialog
            action={generateDraftsAction}
            fragmentId={fragment.id}
            schemes={schemes}
          />
          <ConfirmAction
            action={deleteFragmentAction}
            hiddenFields={{ id: fragment.id }}
            title="删除碎片"
            subtitle="这条碎片和它派生出的成稿都会被删除。这个操作不能撤销。"
            confirmLabel="删除"
          />
        </div>
      </header>

      <article className="paper-surface rounded-2xl border p-5 text-base leading-8 shadow-xs">
        {fragment.content}
      </article>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="section-title">已酿成稿</h2>
        </div>

        {drafts.length > 0 ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {drafts.map((draft) => {
              const latestVersion = draft.versions.at(-1)
              const currentScheme = schemes.find(
                (scheme) => scheme.id === draft.schemeSnapshot.schemeId,
              )
              const needsBadge =
                latestVersion?.status === "brewing" ||
                latestVersion?.status === "failed"

              return (
                <Link key={draft.id} href={`/drafts/${draft.id}`} className="group focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Card className="aspect-[4/5] transition-colors group-hover:border-primary/50">
                    <CardContent className="flex flex-1 flex-col justify-between gap-3">
                      <div>
                        <h3 className="line-clamp-3 font-heading text-lg font-medium">
                          {currentScheme?.name ?? draft.schemeSnapshot.schemeName}
                        </h3>
                        <p className="mt-3 line-clamp-6 text-sm leading-6 text-muted-foreground">
                          {summarize(latestVersion?.content || "这一稿还在酝酿中。", 160)}
                        </p>
                      </div>
                      {needsBadge ? (
                        <Badge variant={latestVersion.status === "failed" ? "destructive" : "secondary"}>
                          {latestVersion.status === "failed" ? "出稿失败" : "酝酿中"}
                        </Badge>
                      ) : null}
                    </CardContent>
                    <CardFooter>
                      <span className="text-sm text-muted-foreground">
                        {draft.versions.length} 个稿次
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
            还没有成稿。点击右上角「出稿」选择方案开始酝酿。
          </div>
        )}
      </section>
    </div>
  )
}
