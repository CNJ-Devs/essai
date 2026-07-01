"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CheckIcon, PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function FragmentCardTitleEditor({
  action,
  fragmentId,
  href,
  title,
  className,
}: {
  action: (formData: FormData) => void
  fragmentId: string
  href: string
  title: string
  className?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isEditing) return

    function handlePointerDown(event: PointerEvent) {
      const node = containerRef.current

      if (node && !node.contains(event.target as Node)) {
        event.preventDefault()
        event.stopPropagation()
        setDraftTitle(title)
        setIsEditing(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    return () => document.removeEventListener("pointerdown", handlePointerDown, true)
  }, [isEditing, title])

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className={cn("flex h-6 w-full min-w-0 items-center", className)}
      >
        <form
          action={action}
          className="flex h-6 w-full min-w-0 items-center gap-1.5"
          onSubmit={() => setIsEditing(false)}
        >
          <input type="hidden" name="id" value={fragmentId} />
          <Input
            name="title"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setDraftTitle(title)
                setIsEditing(false)
              }
            }}
            autoComplete="off"
            autoFocus
            required
            aria-label="碎片标题"
            className="h-5 min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-sm font-medium leading-5 shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-sm dark:bg-transparent"
          />
          <Button type="submit" variant="secondary" size="icon-xs" aria-label="保存标题">
            <CheckIcon aria-hidden="true" />
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn("flex h-6 w-full min-w-0 items-center gap-1.5", className)}
    >
      <Link
        href={href}
        className="min-w-0 flex-1 truncate font-medium leading-5 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {title}
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="编辑标题"
        className="shrink-0 text-muted-foreground"
        onClick={() => {
          setDraftTitle(title)
          setIsEditing(true)
        }}
      >
        <PencilIcon aria-hidden="true" />
      </Button>
    </div>
  )
}
