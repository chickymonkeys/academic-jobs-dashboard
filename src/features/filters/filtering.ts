import { boundsContain, type Bounds } from "@/domain/geo"
import { CATEGORY_BY_ID, DISCIPLINE_LABEL, FIELD_LABEL } from "@/domain/taxonomy"
import type { Vacancy } from "@/domain/vacancy"
import { daysUntil, deadlineState, isFresh, nextDate } from "@/lib/dates"
import { list, type AppSearch } from "@/app/search"

export type Filters = {
  terms: string[]
  cats: string[]
  discs: string[]
  fields: string[]
  sources: string[]
  region: string | null
  deadline: "any" | "week" | "month" | "none"
  includeClosed: boolean
  savedOnly: boolean
  freshOnly: boolean
}

export function filtersFrom(search: AppSearch): Filters {
  return {
    terms: tokenize(search.q ?? ""),
    cats: list(search.cat),
    discs: list(search.disc),
    fields: list(search.field),
    sources: list(search.src),
    region: search.region ?? null,
    deadline: search.dl ?? "any",
    includeClosed: !!search.closed,
    savedOnly: !!search.saved,
    freshOnly: !!search.fresh,
  }
}

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

export const tokenize = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean)

export type Indexed = {
  v: Vacancy
  hay: string
  title: string
  inst: string
  place: string
}

/** Precomputed once per snapshot so every keystroke is a cheap substring scan */
export function buildIndex(items: Vacancy[]): Indexed[] {
  return items.map((v) => {
    const place = normalize([v.city, v.admin, v.country].filter(Boolean).join(" "))
    const title = normalize(v.title)
    const inst = normalize(`${v.institution} ${v.department ?? ""}`)
    const extra = normalize(
      [
        ...v.disciplines.map((d) => DISCIPLINE_LABEL[d]),
        ...v.fields.map((f) => FIELD_LABEL[f] ?? f),
        CATEGORY_BY_ID[v.category].label,
        ...v.positionTypes,
      ].join(" "),
    )
    return { v, title, inst, place, hay: `${title} ${inst} ${place} ${extra}` }
  })
}

export function score(x: Indexed, terms: string[]) {
  let s = 0
  for (const t of terms) {
    if (!x.hay.includes(t)) return 0
    if (x.title.includes(t)) s += 3
    if (x.inst.includes(t)) s += 2.5
    if (x.place.includes(t)) s += 2
    s += 1
  }
  return s
}

type FacetKey = "cats" | "discs" | "fields" | "sources" | "dl"

/** Which deadline bucket a listing falls in, for the Deadline filter and its counts */
export function deadlineBucket(v: Vacancy, now = new Date()): "week" | "month" | "later" | "none" {
  const d = daysUntil(nextDate(v, now), now)
  if (d == null) return "none"
  return d <= 7 ? "week" : d <= 30 ? "month" : "later"
}

function passes(x: Indexed, f: Filters, saved: ReadonlySet<string>, skip?: FacetKey, now = new Date()) {
  const v = x.v
  if (f.terms.length && score(x, f.terms) === 0) return false
  if (skip !== "cats" && f.cats.length && !f.cats.includes(v.category)) return false
  if (skip !== "discs" && f.discs.length && !v.disciplines.some((d) => f.discs.includes(d))) return false
  if (skip !== "fields" && f.fields.length && !v.fields.some((fl) => f.fields.includes(fl))) return false
  if (skip !== "sources" && f.sources.length && ![v.source, ...v.alsoOn.map((a) => a.source)].some((s) => f.sources.includes(s)))
    return false
  if (f.savedOnly && !saved.has(v.id)) return false
  if (f.freshOnly && !isFresh(v, now)) return false
  if (!f.includeClosed && deadlineState(v, now) === "closed") return false
  if (skip === "dl" || f.deadline === "any") return true
  // The date that matters today: a full-consideration date, or the later close once that has passed
  const b = deadlineBucket(v, now)
  if (f.deadline === "week") return b === "week"
  if (f.deadline === "month") return b === "week" || b === "month"
  return b === "none"
}

export function applyFilters(index: Indexed[], f: Filters, saved: ReadonlySet<string>) {
  const now = new Date()
  return index.filter((x) => passes(x, f, saved, undefined, now))
}

/** Faceted counts: each facet is counted with every *other* filter applied */
export function facetCounts(index: Indexed[], f: Filters, saved: ReadonlySet<string>) {
  const now = new Date()
  const count = (key: FacetKey, pick: (v: Vacancy) => string[]) => {
    const out: Record<string, number> = {}
    for (const x of index) {
      if (!passes(x, f, saved, key, now)) continue
      for (const k of new Set(pick(x.v))) out[k] = (out[k] ?? 0) + 1
    }
    return out
  }
  // Deadline choices nest ("within 30 days" holds "within 7"), so each counts every bucket it takes in
  const buckets = count("dl", (v) => [deadlineBucket(v, now)])
  const dls = {
    any: (buckets.week ?? 0) + (buckets.month ?? 0) + (buckets.later ?? 0) + (buckets.none ?? 0),
    week: buckets.week ?? 0,
    month: (buckets.week ?? 0) + (buckets.month ?? 0),
    none: buckets.none ?? 0,
  }
  return {
    cats: count("cats", (v) => [v.category]),
    discs: count("discs", (v) => v.disciplines),
    fields: count("fields", (v) => v.fields),
    sources: count("sources", (v) => [v.source, ...v.alsoOn.map((a) => a.source)]),
    dls,
  }
}
export type FacetCounts = ReturnType<typeof facetCounts>

export function inBounds(v: Vacancy, b: Bounds | null) {
  return !b || boundsContain(b, v.lng, v.lat)
}

export type SortKey = NonNullable<AppSearch["sort"]>

/** What the list holds: a picked map group, a picked region, the visible map area, or everything */
export type Scope = "group" | "region" | "area" | "world" | "everywhere"

/** Listings with no date ahead sort after every dated one, in a fixed order, so the deadline sections stay whole */
const UNDATED_RANK: Partial<Record<ReturnType<typeof deadlineState>, string>> = {
  rolling: "9999-12-29",
  unstated: "9999-12-30",
  closed: "9999-12-31",
}

export function sortResults(rows: Indexed[], sort: SortKey, terms: string[]) {
  const now = new Date()
  const due = new Map(rows.map((x) => [x.v.id, nextDate(x.v, now) ?? UNDATED_RANK[deadlineState(x.v, now)] ?? "9999-12-31"]))
  const byDue = (a: Indexed, b: Indexed) => due.get(a.v.id)!.localeCompare(due.get(b.v.id)!)
  const cmp: Record<SortKey, (a: Indexed, b: Indexed) => number> = {
    relevance: (a, b) => score(b, terms) - score(a, terms) || byDue(a, b),
    deadline: byDue,
    newest: (a, b) => (b.v.postedAt ?? b.v.firstSeenAt).localeCompare(a.v.postedAt ?? a.v.firstSeenAt),
    az: (a, b) => a.v.institution.localeCompare(b.v.institution),
  }
  return [...rows].sort(cmp[sort])
}

/** Great-circle distance in km, for "nearby positions" */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
