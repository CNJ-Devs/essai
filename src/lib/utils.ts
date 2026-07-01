import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { zhCN } from "@/lib/i18n"
import type { DraftStatus, DraftVersionSource } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value))
}

export function summarize(value: string, maxLength = 96) {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength)}…`
}

export function draftStatusLabel(status: DraftStatus) {
  return zhCN.status[status]
}

export function draftSourceLabel(source: DraftVersionSource) {
  return zhCN.source[source]
}

export function countVersionsByStatus(
  statuses: DraftStatus[],
): Record<DraftStatus, number> {
  return statuses.reduce(
    (acc, status) => {
      acc[status] += 1
      return acc
    },
    { brewing: 0, completed: 0, failed: 0 },
  )
}
