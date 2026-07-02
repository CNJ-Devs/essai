"use client"

import { Children, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type AdaptiveMasonryProps = {
  children: React.ReactNode
  className?: string
  gap?: number
  minColumnWidth?: number
}

export function AdaptiveMasonry({
  children,
  className,
  gap = 16,
  minColumnWidth = 172,
}: AdaptiveMasonryProps) {
  const ref = useRef<HTMLElement>(null)
  const [columnCount, setColumnCount] = useState(1)
  const childItems = Children.toArray(children)
  const columns = Array.from({ length: columnCount }, () => [] as React.ReactNode[])

  childItems.forEach((child, index) => {
    columns[index % columnCount]?.push(child)
  })

  useEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

    function update(width: number) {
      const next = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)))
      setColumnCount(next)
    }

    update(node.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (entry) {
        update(entry.contentRect.width)
      }
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [gap, minColumnWidth])

  return (
    <section
      ref={ref}
      className={cn("masonry", className)}
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {columns.map((column, index) => (
        <div key={index} className="flex min-w-0 flex-col" style={{ gap: `${gap}px` }}>
          {column}
        </div>
      ))}
    </section>
  )
}
