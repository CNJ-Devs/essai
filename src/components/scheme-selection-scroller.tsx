"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { copy } from "@/lib/i18n"
import type { Scheme } from "@/lib/types"
import { cn, summarize } from "@/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { SchemeCountToggle } from "@/components/scheme-count-toggle"
import { Button } from "@/components/ui/button"

export function SchemeSelectionScroller({
  schemes,
  compact = false,
  description,
}: {
  schemes: Scheme[]
  compact?: boolean
  description?: string | null
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const scrollerRef = useRef<HTMLDivElement>(null)

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
  }, [handleScroll, schemes.length, updateScrollState])

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
    <div className="flex min-w-0 flex-col gap-3">
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div className="relative rounded-2xl border bg-muted/45 p-3">
        {schemes.length > 0 ? (
          <>
            {scrollState.canScrollLeft ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={copy.accessibility.scrollSchemesLeft}
                className="absolute left-2 top-1/2 z-[1] -translate-y-1/2 shadow-sm"
                onClick={() => scrollByPage("left")}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
            ) : null}
            <div
              ref={scrollerRef}
              className="scroll-fade-x flex min-w-0 gap-3 overflow-x-auto px-0 pb-1"
            >
              {schemes.map((scheme) => {
                const isSelected = selected[scheme.id] === true
                const count = counts[scheme.id] ?? 1

                return (
                  <div
                    key={scheme.id}
                    className={cn(
                      "flex shrink-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs transition-colors",
                      compact ? "w-44" : "w-52",
                      isSelected ? "border-primary" : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      className="flex aspect-square flex-col gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      onClick={() => toggle(scheme.id)}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/50 bg-background",
                        )}
                        aria-hidden="true"
                      >
                        {isSelected ? "✓" : null}
                      </span>
                      <span className="line-clamp-2 font-medium">{scheme.name}</span>
                      <span className="line-clamp-4 text-xs leading-5 text-muted-foreground">
                        {summarize(scheme.description, compact ? 74 : 96)}
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-3 border-t bg-muted/35 p-3">
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
                    </div>
                    {isSelected ? (
                      <>
                        <input type="hidden" name="schemeId" value={scheme.id} />
                        <input type="hidden" name={`count_${scheme.id}`} value={count} />
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {scrollState.canScrollRight ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={copy.accessibility.scrollSchemesRight}
                className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 shadow-sm"
                onClick={() => scrollByPage("right")}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            ) : null}
          </>
        ) : (
          <EmptyState
            title={copy.schemeSelection.noSchemesTitle}
            description={copy.schemeSelection.noSchemesDescription}
            className={cn(
              "rounded-xl border border-dashed bg-card/60 p-5",
              compact ? "h-[14.5rem]" : "h-[16.5rem]",
            )}
          />
        )}
      </div>
    </div>
  )
}
