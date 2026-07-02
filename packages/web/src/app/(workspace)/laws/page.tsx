import Link from "next/link"
import { createLawAction, deleteLawAction } from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import { LawEditorDialog } from "@/components/law-editor-dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getWorkspaceData } from "@/lib/data/demo-store"
import { copy } from "@/lib/i18n"
import { formatDate, summarize } from "@/lib/utils"

export default async function LawsPage() {
  const { laws } = await getWorkspaceData()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="max-w-2xl text-xl font-medium leading-snug text-pretty sm:text-2xl">
            {copy.laws.slogan}
          </h1>
        </div>
        <LawEditorDialog action={createLawAction} />
      </header>

      {laws.length > 0 ? (
        <section className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {laws.map((law) => (
            <Card
              key={law.id}
              className="h-full min-h-48 transition-colors hover:ring-primary/25"
            >
              <CardHeader>
                <Link
                  href={`/laws/${law.id}`}
                  className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <CardTitle className="line-clamp-2 transition-colors hover:text-primary">
                    {law.name}
                  </CardTitle>
                </Link>
                {law.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.from(new Set(law.tags)).slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardHeader>
              <Link
                href={`/laws/${law.id}`}
                className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CardContent className="flex-1">
                  <p className="line-clamp-5 text-sm leading-6 text-muted-foreground">
                    {summarize(law.prompt, 160)}
                  </p>
                </CardContent>
              </Link>
              <CardFooter className="justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(law.updatedAt)}
                </span>
                <ConfirmAction
                  action={deleteLawAction}
                  hiddenFields={{ id: law.id }}
                  title={copy.laws.deleteTitle(law.name)}
                  subtitle={copy.laws.deleteDescription(law.name)}
                  confirmLabel={copy.action.delete}
                  triggerSize="icon-xs"
                  triggerClassName="text-muted-foreground hover:text-destructive"
                />
              </CardFooter>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          title={copy.laws.emptyTitle}
          description={copy.laws.emptyDescription}
          className="min-h-[42svh] justify-start pt-16"
        />
      )}
    </div>
  )
}
