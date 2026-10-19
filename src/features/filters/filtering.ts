import { boundsContain, type Bounds } from "@/domain/geo"
import { CATEGORY_BY_ID, FIELD_LABEL } from "@/domain/taxonomy"
import type { Vacancy } from "@/domain/vacancy"
import { daysUntil, isFresh } from "@/lib/dates"
import { list, type AppSearch } from "@/app/search"

export type Filters = {
  terms: string[]
  cats: string[]
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
      [...v.fields.map((f) => FIELD_LABEL[f] ?? f), CATEGORY_BY_ID[v.category].label, ...v.positionTypes].join(" "),
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

type FacetKey = "cats" | "fields" | "sources"

function passes(x: Indexed, f: Filters, saved: ReadonlySet<string>, skip?: FacetKey, now = new Date()) {
  const v = x.v
  if (f.terms.length && score(x, f.terms) === 0) return false
  if (skip !== "cats" && f.cats.length && !f.cats.includes(v.category)) return false
  if (skip !== "fields" && f.fields.length && !v.fields.some((fl) => f.fields.includes(fl))) return false
  if (skip !== "sources" && f.sources.length && ![v.source, ...v.alsoOn.map((a) => a.source)].some((s) => f.sources.includes(s)))
    return false
  if (f.savedOnly && !saved.has(v.id)) return false
  if (f.freshOnly && !isFresh(v, now)) return false
  const d = daysUntil(v.deadline, now)
  if (!f.includeClosed && d != null && d < 0) return false
  if (f.deadline === "week" && (d == null || d > 7)) return false
  if (f.deadline === "month" && (d == null || d > 30)) return false
  if (f.deadline === "none" && d != null) return false
  return true
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
  return {
    cats: count("cats", (v) => [v.category]),
    fields: count("fields", (v) => v.fields),
    sources: count("sources", (v) => [v.source, ...v.alsoOn.map((a) => a.source)]),
  }
}

export function inBounds(v: Vacancy, b: Bounds | null) {
  return !b || boundsContain(b, v.lng, v.lat)
}

export type SortKey = NonNullable<AppSearch["sort"]>

export function sortResults(rows: Indexed[], sort: SortKey, terms: string[]) {
  const far = "9999-12-31"
  const cmp: Record<SortKey, (a: Indexed, b: Indexed) => number> = {
    relevance: (a, b) => score(b, terms) - score(a, terms) || (a.v.deadline ?? far).localeCompare(b.v.deadline ?? far),
    deadline: (a, b) => (a.v.deadline ?? far).localeCompare(b.v.deadline ?? far),
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
