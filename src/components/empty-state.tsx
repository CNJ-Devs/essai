import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description?: string
  className?: string
  align?: "center" | "left"
}

export function EmptyState({
  title,
  description,
  className,
  align = "center",
}: EmptyStateProps) {
  return (
    <Empty
      className={cn(
        "border-0 bg-transparent p-8 text-muted-foreground/85",
        align === "left" && "items-start text-left",
        className,
      )}
    >
      <EmptyHeader
        className={cn(
          "max-w-md",
          align === "left" && "items-start text-left",
        )}
      >
        <EmptyTitle className="text-muted-foreground">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="text-muted-foreground/75">
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}
