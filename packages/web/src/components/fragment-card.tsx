import Link from "next/link"
import {
  deleteFragmentAction,
  updateFragmentTitleAction,
} from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { FragmentCardTitleEditor } from "@/components/fragment-title-editor"
import type { Draft, Fragment } from "@/lib/types"
import { copy } from "@/lib/i18n"
import { formatDate, summarize } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

export function FragmentCard({
  fragment,
  drafts,
}: {
  fragment: Fragment
  drafts: Draft[]
}) {
  const latestVersion = drafts
    .flatMap((draft) => draft.versions)
    .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const status =
    latestVersion?.status === "brewing" || latestVersion?.status === "failed"
      ? latestVersion.status
      : null

  const href = `/fragments/${fragment.id}`

  return (
    <Card className="gap-0 overflow-hidden bg-card py-0 shadow-xs transition-colors hover:ring-primary/25">
      <Link href={href} className="group block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <CardContent className="p-0">
          <div className="relative max-h-[15.5rem] min-h-[11.5rem] overflow-hidden bg-muted/20 px-4 py-5 text-sm leading-7 text-foreground/80 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-20 after:bg-gradient-to-b after:from-transparent after:to-card after:content-['']">
            <p className="relative z-0 break-words">
              {summarize(fragment.content, 260)}
            </p>
          </div>
        </CardContent>
      </Link>
      <CardFooter className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-1 border-border/70 bg-card px-4 py-3">
        <FragmentCardTitleEditor
          action={updateFragmentTitleAction}
          fragmentId={fragment.id}
          href={href}
          title={fragment.title}
          className="col-span-2"
        />
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(fragment.createdAt)}</span>
          {status ? (
            <Badge variant={status === "failed" ? "destructive" : "secondary"}>
              {copy.status[status]}
            </Badge>
          ) : null}
        </div>
        <ConfirmAction
          action={deleteFragmentAction}
          hiddenFields={{ id: fragment.id }}
          title={copy.fragments.deleteTitle}
          subtitle={copy.fragments.deleteDescription}
          confirmLabel={copy.action.delete}
          triggerSize="icon-xs"
          triggerClassName="text-muted-foreground hover:text-destructive"
        />
      </CardFooter>
    </Card>
  )
}
