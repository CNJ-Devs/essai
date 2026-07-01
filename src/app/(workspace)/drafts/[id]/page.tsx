import { notFound } from "next/navigation"
import { WandSparklesIcon } from "lucide-react"
import {
  retryDraftAction,
  retryDraftFromSnapshotAction,
  reviseDraftAction,
  saveDraftVersionAction,
} from "@/app/actions"
import { DraftVersionPanel } from "@/components/draft-version-panel"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { getDraftPageData } from "@/lib/data/demo-store"
import { copy } from "@/lib/i18n"

type DraftPageProps = {
  params: Promise<{ id: string }>
}

export default async function DraftPage({ params }: DraftPageProps) {
  const { id } = await params
  const { draft, fragment, scheme, laws } = await getDraftPageData(id)

  if (!draft || !fragment) {
    notFound()
  }

  if (draft.versions.length === 0) {
    notFound()
  }

  const schemeName = scheme?.name ?? draft.schemeSnapshot.schemeName
  const schemeDescription =
    scheme?.description ?? draft.schemeSnapshot.schemeDescription
  const currentLaws = scheme
    ? laws.map((law) => ({
        id: law.id,
        name: law.name,
        prompt: law.prompt,
      }))
    : draft.schemeSnapshot.laws.map((law) => ({
        id: law.lawId,
        name: law.name,
        prompt: law.prompt,
      }))

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-6">
      <section className="paper-surface flex flex-col gap-5 rounded-2xl border p-5 shadow-xs">
        <div className="min-w-0">
          <h1 className="max-w-3xl text-2xl font-medium leading-snug text-pretty">
            {schemeName}
          </h1>
          <p className="mt-4 max-w-4xl whitespace-pre-wrap text-base leading-8 text-muted-foreground">
            {schemeDescription}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h2 className="section-title">{copy.drafts.principlesTitle}</h2>
            {currentLaws.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentLaws.map((law) => (
                  <HoverCard key={law.id}>
                    <HoverCardTrigger render={<button type="button" className="focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />}>
                      <Badge variant="secondary">{law.name}</Badge>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="flex flex-col gap-2">
                        <h3 className="font-medium">{law.name}</h3>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {law.prompt}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ))}
              </div>
            ) : (
              <EmptyState
                title={copy.drafts.noPrinciplesTitle}
                description={copy.drafts.noPrinciplesDescription}
                className="min-h-20 items-start rounded-xl border border-dashed bg-muted/30 p-4 text-left"
                align="left"
              />
            )}
          </div>

          <form action={retryDraftAction} className="shrink-0">
            <input type="hidden" name="draftId" value={draft.id} />
            <Button type="submit">
              <WandSparklesIcon data-icon="inline-start" aria-hidden="true" />
              {copy.drafts.generate}
            </Button>
          </form>
        </div>
      </section>

      <DraftVersionPanel
        draftId={draft.id}
        versions={draft.versions}
        retryFromSnapshotAction={retryDraftFromSnapshotAction}
        reviseDraftAction={reviseDraftAction}
        saveDraftVersionAction={saveDraftVersionAction}
      />
    </div>
  )
}
