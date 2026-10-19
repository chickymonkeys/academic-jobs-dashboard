import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns"

export type DeadlineState = "closed" | "urgent" | "soon" | "open" | "rolling"

export function daysUntil(date: string | null, now = new Date()) {
  return date ? differenceInCalendarDays(parseISO(date), now) : null
}

export function deadlineState(date: string | null, now = new Date()): DeadlineState {
  const d = daysUntil(date, now)
  if (d == null) return "rolling"
  if (d < 0) return "closed"
  if (d <= 7) return "urgent"
  if (d <= 21) return "soon"
  return "open"
}

export function deadlineLabel(date: string | null, now = new Date()) {
  const d = daysUntil(date, now)
  if (d == null) return "Open until filled"
  if (d < 0) return `Closed ${format(parseISO(date!), "MMM d")}`
  if (d === 0) return "Closes today"
  if (d === 1) return "Closes tomorrow"
  if (d <= 21) return `${d} days left`
  return `Due ${format(parseISO(date!), parseISO(date!).getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy")}`
}

export const fmtDate = (date: string | null) => (date ? format(parseISO(date), "MMM d, yyyy") : "—")

export const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })

export function isFresh(v: { postedAt: string | null }, now = new Date()) {
  const d = daysUntil(v.postedAt, now)
  return d != null && d >= -7
}
