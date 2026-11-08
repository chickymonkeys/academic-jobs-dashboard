import { format, parseISO } from "date-fns"
import type { Indexed, SortKey } from "@/features/filters/filtering"
import { daysUntil, deadlineState, nextDate } from "@/lib/dates"

export type Section = { key: string; label: string; icon: string; tone: string; count: number }
export type Entry = { kind: "header"; section: Section } | { kind: "row"; row: Indexed; index: number }

/** Where a listing sits on the deadline timeline: the next 7 days, the next 3 weeks, then month by month */
function sectionOf(x: Indexed, now: Date): Omit<Section, "count"> {
  const next = nextDate(x.v, now)
  const d = daysUntil(next, now)
  if (next == null || d == null) {
    const state = deadlineState(x.v, now)
    if (state === "rolling") return { key: "rolling", label: "Open until filled", icon: "i-lucide-infinity", tone: "text-muted" }
    if (state === "unstated") return { key: "unstated", label: "No deadline stated", icon: "i-lucide-calendar-off", tone: "text-muted" }
    return { key: "closed", label: "Closed", icon: "i-lucide-calendar-x-2", tone: "text-muted" }
  }
  if (d <= 7) return { key: "week", label: "Next 7 days", icon: "i-lucide-alarm-clock", tone: "text-urgent" }
  if (d <= 21) return { key: "soon", label: "Within 3 weeks", icon: "i-lucide-calendar-clock", tone: "text-soon" }
  const date = parseISO(next)
  return {
    key: format(date, "yyyy-MM"),
    label: format(date, date.getFullYear() === now.getFullYear() ? "MMMM" : "MMMM yyyy"),
    icon: "i-lucide-calendar-days",
    tone: "text-toned",
  }
}

/**
 * The list's entries: rows, with a header ahead of each deadline section when the list is sorted by deadline.
 * Sorted by anything else it is one flat run of rows.
 */
export function buildEntries(rows: Indexed[], sort: SortKey): Entry[] {
  if (sort !== "deadline" || rows.length === 0) return rows.map((row, index) => ({ kind: "row", row, index }))
  const now = new Date()
  const out: Entry[] = []
  let current: Section | null = null
  rows.forEach((row, index) => {
    const s = sectionOf(row, now)
    if (s.key !== current?.key) {
      current = { ...s, count: 0 }
      out.push({ kind: "header", section: current })
    }
    current!.count++
    out.push({ kind: "row", row, index })
  })
  return out
}
