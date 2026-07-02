"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const DRAFT_COUNT_OPTIONS = [1, 2, 3] as const

export function SchemeCountToggle({
  count,
  onCountChange,
  label,
}: {
  count: number
  onCountChange: (count: number) => void
  label: string
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[String(count)]}
      onValueChange={(value) => {
        const next = Number(value.at(-1))

        if (DRAFT_COUNT_OPTIONS.includes(next as 1 | 2 | 3)) {
          onCountChange(next)
        }
      }}
      size="sm"
      spacing={1}
    >
      {DRAFT_COUNT_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={String(option)}
          onClick={() => onCountChange(option)}
          className="min-w-8 rounded-md border border-border bg-background hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {option}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
