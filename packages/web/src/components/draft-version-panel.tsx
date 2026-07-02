"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SendHorizontalIcon,
} from "lucide-react"
import { copy } from "@/lib/i18n"
import type { DraftStatus, DraftVersion } from "@/lib/types"
import { cn, draftStatusLabel, formatDate, summarize } from "@/lib/utils"
import {
  DraftEditDialog,
  RetryFromSnapshotButton,
  SnapshotDialog,
} from "@/components/draft-version-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type ServerAction = (formData: FormData) => void

export function DraftVersionPanel({
  draftId,
  versions,
  retryFromSnapshotAction,
  reviseDraftAction,
  saveDraftVersionAction,
}: {
  draftId: string
  versions: DraftVersion[]
  retryFromSnapshotAction: ServerAction
  reviseDraftAction: ServerAction
  saveDraftVersionAction: ServerAction
}) {
  const orderedVersions = useMemo(
    () => [...versions].sort((a, b) => a.versionNo - b.versionNo),
    [versions],
  )
  const latestVersion = orderedVersions.at(-1)
  const [activeVersionId, setActiveVersionId] = useState(latestVersion?.id)
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeVersion =
    orderedVersions.find((version) => version.id === activeVersionId) ??
    latestVersion
  const activeIndex = activeVersion
    ? orderedVersions.findIndex((version) => version.id === activeVersion.id)
    : -1
  const previousVersion = activeIndex > 0 ? orderedVersions[activeIndex - 1] : null
  const nextVersion =
    activeIndex >= 0 && activeIndex < orderedVersions.length - 1
      ? orderedVersions[activeIndex + 1]
      : null

  const getScrollState = useCallback((node: HTMLDivElement, scrollLeft: number) => {
    const maxScrollLeft = node.scrollWidth - node.clientWidth
    const threshold = 2

    return {
      canScrollLeft: scrollLeft > threshold,
      canScrollRight: maxScrollLeft - scrollLeft > threshold,
    }
  }, [])

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current

    if (!node) return

    setScrollState(getScrollState(node, node.scrollLeft))
  }, [getScrollState])

  const handleScroll = useCallback(() => {
    const node = scrollerRef.current

    if (!node) return

    setScrollState(getScrollState(node, node.scrollLeft))
  }, [getScrollState])

  useEffect(() => {
    const node = scrollerRef.current

    if (!node) return

    updateScrollState()

    const resizeObserver = new ResizeObserver(updateScrollState)

    resizeObserver.observe(node)
    if (node.firstElementChild) {
      resizeObserver.observe(node.firstElementChild)
    }

    node.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      resizeObserver.disconnect()
      node.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll, orderedVersions.length, updateScrollState])

  useEffect(() => {
    const node = scrollerRef.current
    const activeButton = node?.querySelector<HTMLElement>('[data-active="true"]')

    activeButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    })
  }, [activeVersionId])

  if (!activeVersion) {
    return null
  }

  function selectVersion(version: DraftVersion | null) {
    if (!version) return

    setActiveVersionId(version.id)
  }

  function scrollByPage(direction: "left" | "right") {
    const node = scrollerRef.current
    if (!node) return

    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth)
    const pageWidth = node.clientWidth * 0.75
    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, node.scrollLeft + (direction === "right" ? pageWidth : -pageWidth)),
    )

    setScrollState(getScrollState(node, nextScrollLeft))

    node.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    })
  }

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="relative -mx-1">
        {scrollState.canScrollLeft ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={copy.accessibility.scrollDraftsLeft}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 shadow-sm"
            onClick={() => scrollByPage("left")}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
        ) : null}
        <div
          ref={scrollerRef}
          className="flex shrink-0 gap-3 overflow-x-auto px-1 py-1"
        >
          {orderedVersions.map((version) => {
            const isActive = version.id === activeVersion.id
            const preview =
              version.status === "failed"
                ? version.errorMessage || copy.drafts.failedPreview
                : version.content || copy.drafts.brewingPreview

            return (
              <button
                key={version.id}
                type="button"
                aria-pressed={isActive}
                data-active={isActive ? "true" : undefined}
                className={cn(
                  "flex aspect-square w-40 shrink-0 flex-col justify-between rounded-xl border bg-card p-3 text-left text-card-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "border-primary ring-1 ring-primary/40"
                    : "border-border hover:border-primary/50",
                )}
                onClick={() => setActiveVersionId(version.id)}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-heading text-2xl font-medium leading-none">
                    {version.versionNo}
                  </span>
                  <StatusBadge status={version.status} />
                </span>
                <span className="line-clamp-4 text-xs leading-5 text-muted-foreground">
                  {summarize(preview, 96)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(version.createdAt)}
                </span>
              </button>
            )
          })}
        </div>
        {scrollState.canScrollRight ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={copy.accessibility.scrollDraftsRight}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 shadow-sm"
            onClick={() => scrollByPage("right")}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Card className="min-w-0 flex-1">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <StatusBadge status={activeVersion.status} />
              <span className="text-sm text-muted-foreground">
                {formatDate(activeVersion.createdAt)}
              </span>
              <SnapshotDialog
                action={retryFromSnapshotAction}
                draftId={draftId}
                versionId={activeVersion.id}
                snapshot={activeVersion.snapshot}
              />
              <DraftEditDialog
                action={saveDraftVersionAction}
                draftId={draftId}
                versionId={activeVersion.id}
                content={activeVersion.content}
              />
              <RetryFromSnapshotButton
                action={retryFromSnapshotAction}
                draftId={draftId}
                versionId={activeVersion.id}
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="text-sm font-medium">
                {activeIndex + 1}/{orderedVersions.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={copy.accessibility.previousDraft}
                  disabled={!previousVersion}
                  onClick={() => selectVersion(previousVersion)}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={copy.accessibility.nextDraft}
                  disabled={!nextVersion}
                  onClick={() => selectVersion(nextVersion)}
                >
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "flex min-h-40 flex-1 flex-col",
            activeVersion.status === "failed" && "text-sm text-destructive",
          )}
        >
          {activeVersion.status === "failed" ? (
            activeVersion.errorMessage
          ) : (
            <pre className="flex-1 whitespace-pre-wrap font-sans text-[15px] leading-7 text-foreground">
              {activeVersion.content}
            </pre>
          )}
        </CardContent>

        {activeVersion.status === "failed" ? null : (
          <CardFooter className="border-t-0 bg-transparent">
            <form
              action={reviseDraftAction}
              className="flex h-36 w-full flex-col rounded-xl border bg-muted/35 p-3"
            >
              <input type="hidden" name="draftId" value={draftId} />
              <input type="hidden" name="versionId" value={activeVersion.id} />
              <FieldGroup className="h-full min-h-0 gap-2">
                <Field className="min-h-0 flex-1">
                  <FieldLabel
                    htmlFor={`draft-revision-${activeVersion.id}`}
                    className="sr-only"
                  >
                    {copy.drafts.revisionLabel}
                  </FieldLabel>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                    <Textarea
                      id={`draft-revision-${activeVersion.id}`}
                      name="instruction"
                      required
                      placeholder={copy.drafts.revisionPlaceholder}
                      className="h-full min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                    />
                    <Button type="submit" className="sm:self-end">
                      <SendHorizontalIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      {copy.action.revise}
                    </Button>
                  </div>
                </Field>
              </FieldGroup>
            </form>
          </CardFooter>
        )}
      </Card>
    </section>
  )
}

function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <Badge
      variant={
        status === "failed"
          ? "destructive"
          : status === "brewing"
            ? "secondary"
            : "outline"
      }
      className={cn(status === "completed" && "text-muted-foreground")}
    >
      {draftStatusLabel(status)}
    </Badge>
  )
}
