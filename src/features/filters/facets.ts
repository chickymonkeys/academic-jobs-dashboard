import { computed, type MaybeRefOrGetter, toValue } from "vue"
import { list, type AppSearch } from "@/app/search"
import { sourceLabel, sourceName } from "@/components/job/labels"
import { CATEGORIES, DISCIPLINES, FIELDS } from "@/domain/taxonomy"
import { SOURCE_IDS, type SourceId } from "@/domain/vacancy"
import { useMode } from "@/lib/theme"
import type { FacetOption } from "./FacetChip.vue"
import type { FacetCounts } from "./filtering"

/** A part of the filter sheet a chip can open it at */
export type FilterSection = "deadline" | "position" | "discipline" | "field" | "source"

/** How many filters are on: one per picked value, plus each deadline, closed, new and saved switch */
export function activeFilterCount(s: AppSearch) {
  return (
    list(s.cat).length +
    list(s.disc).length +
    list(s.field).length +
    list(s.src).length +
    Number(!!s.dl) +
    Number(!!s.closed) +
    Number(!!s.saved) +
    Number(!!s.fresh)
  )
}

/** Clears every filter, leaving the search text, sort, map and selection as they are */
export const NO_FILTERS = {
  cat: undefined,
  disc: undefined,
  field: undefined,
  src: undefined,
  dl: undefined,
  closed: undefined,
  saved: undefined,
  fresh: undefined,
} satisfies Partial<AppSearch>

/** `label` for menus, `short` for the sheet's choices, `chip` for the chip that shows the current choice */
export const DEADLINE_CHOICES = [
  { value: "any", label: "Any deadline", short: "Any", chip: "Deadline" },
  { value: "week", label: "Closing within 7 days", short: "Within 7 days", chip: "≤ 7 days" },
  { value: "month", label: "Closing within 30 days", short: "Within 30 days", chip: "≤ 30 days" },
  { value: "none", label: "Rolling or no date", short: "Rolling or no date", chip: "No date" },
] as const

/** Every facet's options with live counts, shared by the chips and the filter sheet */
export function useFacetOptions(
  facets: MaybeRefOrGetter<FacetCounts>,
  search: MaybeRefOrGetter<AppSearch>,
  sourceIds: MaybeRefOrGetter<readonly SourceId[] | undefined>,
) {
  const mode = useMode()
  const cats = computed<FacetOption[]>(() =>
    CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: toValue(facets).cats[c.id] ?? 0, color: c.color[mode.value] })),
  )
  const discs = computed<FacetOption[]>(() =>
    DISCIPLINES.map((d) => ({ id: d.id, label: d.label, count: toValue(facets).discs[d.id] ?? 0 })),
  )
  const fields = computed<FacetOption[]>(() =>
    FIELDS.map((f) => ({ id: f.id, label: f.label, count: toValue(facets).fields[f.id] ?? 0 })).sort((a, b) => b.count - a.count),
  )
  // A source the ingest leaves off has nothing to filter, unless it's selected
  const sources = computed<FacetOption[]>(() => {
    const ids = toValue(sourceIds)
    const picked = list(toValue(search).src)
    return SOURCE_IDS.filter((s) => !ids || ids.includes(s) || picked.includes(s)).map((s) => ({
      id: s,
      label: sourceName(s),
      count: toValue(facets).sources[s] ?? 0,
      tag: sourceLabel(s),
    }))
  })
  return { cats, discs, fields, sources }
}
