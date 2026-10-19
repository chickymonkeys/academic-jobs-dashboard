import { shallowRef, watch } from "vue"
import { useRoute, useRouter, type LocationQuery } from "vue-router"
import { z } from "zod"

const str = z.string().min(1).optional().catch(undefined)
const flag = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional()
  .catch(undefined)

/**
 * All view state that is worth sharing lives in the URL: filters, selection, map camera, layout mode.
 * Every key is optional and self-healing (`.catch`) so stale or hand-edited links never break the app.
 */
export const searchSchema = z.object({
  q: str,
  /** comma-separated lists keep URLs readable */
  cat: str,
  field: str,
  src: str,
  region: str,
  dl: z.enum(["week", "month", "none"]).optional().catch(undefined),
  closed: flag,
  saved: flag,
  fresh: flag,
  sort: z.enum(["relevance", "deadline", "newest", "az"]).optional().catch(undefined),
  /** false = list ignores the map viewport */
  area: flag,
  sel: str,
  view: z.enum(["list", "table"]).optional().catch(undefined),
  globe: flag,
  /** camera: "lat,lng,zoom" */
  at: str,
})
export type AppSearch = z.infer<typeof searchSchema>
export type SetSearch = (
  patch: Partial<AppSearch> | ((prev: AppSearch) => Partial<AppSearch>),
  opts?: { push?: boolean },
) => void

export const list = (s: string | undefined) => (s ? s.split(",").filter(Boolean) : [])
export const unlist = (xs: string[]) => (xs.length ? xs.join(",") : undefined)

export function toggleIn(csv: string | undefined, value: string) {
  const xs = list(csv)
  return unlist(xs.includes(value) ? xs.filter((x) => x !== value) : [...xs, value])
}

function parseQuery(query: LocationQuery): AppSearch {
  const raw: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) {
    let s = Array.isArray(v) ? v[0] : v
    if (s == null) continue
    // Links shared from the previous build JSON-quoted values that looked like JSON ("123")
    if (s.length > 1 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
    raw[k] = s
  }
  return searchSchema.parse(raw)
}

function toQuery(s: AppSearch) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(s)) if (v !== undefined && v !== "") out[k] = String(v)
  return out
}

/**
 * The URL as reactive state. Writes apply immediately (so two updates in one tick both land) and
 * replace the history entry unless `push` is set; a push still pending when a replace arrives is kept,
 * so "Back closes the detail panel" survives a camera update racing the selection.
 */
export function useAppSearch() {
  const route = useRoute()
  const router = useRouter()
  const search = shallowRef<AppSearch>(parseQuery(route.query))
  let pending: AppSearch | null = null
  let pendingPush = false

  watch(
    () => route.query,
    (q) => {
      if (!pending) search.value = parseQuery(q)
    },
  )

  const set: SetSearch = (patch, opts) => {
    const prev = search.value
    const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }
    for (const k of Object.keys(next) as Array<keyof AppSearch>) if (next[k] === undefined || next[k] === "") delete next[k]
    search.value = next
    pending = next
    pendingPush ||= !!opts?.push
    const query = toQuery(next)
    const nav = pendingPush ? router.push({ query }) : router.replace({ query })
    void nav.finally(() => {
      if (pending !== next) return
      pending = null
      pendingPush = false
    })
  }

  return [search, set] as const
}

export function parseCamera(at: string | undefined) {
  const [lat, lng, zoom] = (at ?? "").split(",").map(Number)
  if ([lat, lng, zoom].some((n) => !Number.isFinite(n))) return null
  return { latitude: lat!, longitude: lng!, zoom: zoom! }
}
