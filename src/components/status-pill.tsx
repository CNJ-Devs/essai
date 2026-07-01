import type { DraftStatus } from "@/lib/types";
import { cn, draftStatusLabel } from "@/lib/utils";

export function StatusPill({ status }: { status: DraftStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-medium",
        status === "completed" && "bg-[var(--success-soft)] text-[var(--success)]",
        status === "brewing" && "bg-[var(--warning-soft)] text-[var(--warning)]",
        status === "failed" && "bg-[var(--danger-soft)] text-[var(--danger)]",
      )}
    >
      {draftStatusLabel(status)}
    </span>
  );
}
