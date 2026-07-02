"use client"

import { useState } from "react"
import { CheckIcon, WandSparklesIcon } from "lucide-react"
import { copy } from "@/lib/i18n"
import type { Scheme } from "@/lib/types"
import { cn, summarize } from "@/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { SchemeCountToggle } from "@/components/scheme-count-toggle"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export function DraftGenerateDialog({
  action,
  fragmentId,
  schemes,
}: {
  action: (formData: FormData) => void
  fragmentId: string
  schemes: Scheme[]
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <WandSparklesIcon data-icon="inline-start" aria-hidden="true" />
        {copy.draftGenerate.trigger}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{copy.draftGenerate.title}</DialogTitle>
          <DialogDescription>{copy.draftGenerate.description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          <input type="hidden" name="fragmentId" value={fragmentId} />
          <DialogBody>
            <DraftSchemeGridSelector schemes={schemes} />
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={schemes.length === 0}>
              <WandSparklesIcon data-icon="inline-start" aria-hidden="true" />
              {copy.draftGenerate.trigger}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DraftSchemeGridSelector({ schemes }: { schemes: Scheme[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})

  function toggle(schemeId: string) {
    setSelected((current) => {
      if (current[schemeId]) {
        const next = { ...current }
        delete next[schemeId]
        return next
      }

      return { ...current, [schemeId]: true }
    })
  }

  function setCount(schemeId: string, count: number) {
    setCounts((current) => ({ ...current, [schemeId]: count }))
    setSelected((current) => ({ ...current, [schemeId]: true }))
  }

  return (
    <div className="p-1">
      {schemes.length > 0 ? (
        <section className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
          {schemes.map((scheme) => {
            const isSelected = selected[scheme.id] === true
            const count = counts[scheme.id] ?? 1

            return (
              <Card
                key={scheme.id}
                size="sm"
                className={cn(
                  "h-52 overflow-visible transition-colors",
                  isSelected
                    ? "ring-primary/70"
                    : "hover:ring-primary/35",
                )}
              >
                <button
                  type="button"
                  className="flex flex-1 flex-col gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => toggle(scheme.id)}
                  aria-pressed={isSelected}
                >
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{scheme.name}</CardTitle>
                    <CardAction>
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border transition-colors [&>svg]:size-3",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/50 bg-background",
                        )}
                        aria-hidden="true"
                      >
                        {isSelected ? <CheckIcon /> : null}
                      </span>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1">
                    <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
                      {summarize(scheme.description, 132)}
                    </p>
                  </CardContent>
                </button>
                <CardFooter className="justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {copy.schemeSelection.countLabel}
                  </span>
                  <SchemeCountToggle
                    count={count}
                    label={copy.accessibility.schemeCount(scheme.name)}
                    onCountChange={(nextCount) =>
                      setCount(scheme.id, nextCount)
                    }
                  />
                </CardFooter>
                {isSelected ? (
                  <>
                    <input type="hidden" name="schemeId" value={scheme.id} />
                    <input type="hidden" name={`count_${scheme.id}`} value={count} />
                  </>
                ) : null}
              </Card>
            )
          })}
        </section>
      ) : (
        <EmptyState
          title={copy.draftGenerate.noSchemesTitle}
          description={copy.draftGenerate.noSchemesDescription}
          className="min-h-52 rounded-xl border border-dashed bg-muted/30 p-5"
        />
      )}
    </div>
  )
}
