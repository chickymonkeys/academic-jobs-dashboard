import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns"
import type { Vacancy } from "@/domain/vacancy"

export type DeadlineState = "closed" | "urgent" | "soon" | "open" | "rolling" | "unstated"
type Dates = Pick<Vacancy, "deadline" | "deadlineKind" | "closesAt" | "rolling">

export function daysUntil(date: string | null, now = new Date()) {
  return date ? differenceInCalendarDays(parseISO(date), now) : null
}

/**
 * The date that matters today: the date to apply by, or once that has passed, the later date the posting
 * still takes applications until. Null when neither is ahead.
 */
export function nextDate(v: Dates, now = new Date()): string | null {
  for (const date of [v.deadline, v.closesAt]) if (date && daysUntil(date, now)! >= 0) return date
  return null
}

export function deadlineState(v: Dates, now = new Date()): DeadlineState {
  const d = daysUntil(nextDate(v, now), now)
  if (d != null) return d <= 7 ? "urgent" : d <= 21 ? "soon" : "open"
  // A search that has started reviewing goes on until someone is hired
  if (v.rolling || v.deadlineKind === "review") return "rolling"
  return v.deadline ? "closed" : "unstated"
}

export function deadlineLabel(v: Dates, now = new Date()) {
  const next = nextDate(v, now)
  const d = daysUntil(next, now)
  if (next == null || d == null) {
    const state = deadlineState(v, now)
    if (state === "rolling") return "Open until filled"
    if (state === "unstated") return "No deadline stated"
    return `Closed ${format(parseISO(v.closesAt ?? v.deadline!), "MMM d")}`
  }
  // Only a hard deadline "closes"; a review start or a full-consideration date is the day to be in by
  const hard = next === v.closesAt || v.deadlineKind === "deadline"
  if (d === 0) return hard ? "Closes today" : "Due today"
  if (d === 1) return hard ? "Closes tomorrow" : "Due tomorrow"
  if (d <= 21) return `${d} days left`
  return `Due ${format(parseISO(next), parseISO(next).getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy")}`
}

const KIND_NOTE: Record<NonNullable<Vacancy["deadlineKind"]>, [ahead: string, passed: string]> = {
  review: ["Review begins", "Review began"],
  priority: ["Full consideration by", "Full consideration was by"],
  deadline: ["Deadline", "Deadline was"],
}

/** What the posting's dates mean, one line each: "Full consideration by Nov 15, 2026", "Accepted until Mar 1, 2027" */
export function deadlineNotes(v: Dates, now = new Date()): string[] {
  const notes: string[] = []
  if (v.deadline && v.deadlineKind) {
    const passed = daysUntil(v.deadline, now)! < 0
    notes.push(`${KIND_NOTE[v.deadlineKind][passed ? 1 : 0]} ${fmtDate(v.deadline)}`)
  }
  if (v.closesAt) {
    const closed = daysUntil(v.closesAt, now)! < 0
    notes.push(`${closed ? "Closed" : "Accepted until"} ${fmtDate(v.closesAt)}${v.rolling && !closed ? " or until filled" : ""}`)
  } else if (v.rolling) notes.push(v.deadline ? "Then open until filled" : "Open until filled")
  return notes
}

export const fmtDate = (date: string | null) => (date ? format(parseISO(date), "MMM d, yyyy") : "—")

export const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })

export function isFresh(v: { postedAt: string | null }, now = new Date()) {
  const d = daysUntil(v.postedAt, now)
  return d != null && d >= -7
}
