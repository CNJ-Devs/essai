import Link from "next/link"
import { notFound } from "next/navigation"
import { PencilIcon } from "lucide-react"
import {
  deleteFragmentAction,
  generateDraftsAction,
} from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { DraftGenerateDialog } from "@/components/draft-generate-dialog"
import { EmptyState } from "@/components/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { getFragmentPageData } from "@/lib/data/demo-store"
import { copy } from "@/lib/i18n"
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
            {copy.fragments.editContentAction}
          </Link>
          <DraftGenerateDialog
            action={generateDraftsAction}
            fragmentId={fragment.id}
            schemes={schemes}
          />
          <ConfirmAction
            action={deleteFragmentAction}
            hiddenFields={{ id: fragment.id }}
            title={copy.fragments.deleteTitle}
            subtitle={copy.fragments.deleteDescription}
            confirmLabel={copy.action.delete}
          />
        </div>
      </header>

      <article className="paper-surface rounded-2xl border p-5 text-base leading-8 shadow-xs">
        {fragment.content}
      </article>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="section-title">{copy.fragments.draftsTitle}</h2>
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
                          {summarize(
                            latestVersion?.content ||
                              copy.fragments.pendingDraftPreview,
                            160,
                          )}
                        </p>
                      </div>
                      {needsBadge ? (
                        <Badge variant={latestVersion.status === "failed" ? "destructive" : "secondary"}>
                          {copy.status[latestVersion.status]}
                        </Badge>
                      ) : null}
                    </CardContent>
                    <CardFooter>
                      <span className="text-sm text-muted-foreground">
                        {copy.fragments.versionCount(draft.versions.length)}
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={copy.fragments.noDraftsTitle}
            description={copy.fragments.noDraftsDescription}
            className="min-h-52 rounded-2xl border border-dashed bg-card/60 p-6"
          />
        )}
      </section>
    </div>
  )
}
