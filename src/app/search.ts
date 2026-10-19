import { useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { z } from "zod"

/**
 * All view state that is worth sharing lives in the URL: filters, selection, map camera, layout mode.
 * Every key is optional and self-healing (`.catch`) so stale or hand-edited links never break the app.
 */
export const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  /** comma-separated lists keep URLs readable */
  cat: z.string().optional().catch(undefined),
  field: z.string().optional().catch(undefined),
  src: z.string().optional().catch(undefined),
  region: z.string().optional().catch(undefined),
  dl: z.enum(["week", "month", "none"]).optional().catch(undefined),
  closed: z.boolean().optional().catch(undefined),
  saved: z.boolean().optional().catch(undefined),
  fresh: z.boolean().optional().catch(undefined),
  sort: z.enum(["relevance", "deadline", "newest", "az"]).optional().catch(undefined),
  /** false = list ignores the map viewport */
  area: z.boolean().optional().catch(undefined),
  sel: z.string().optional().catch(undefined),
  view: z.enum(["list", "table"]).optional().catch(undefined),
  layer: z.enum(["points", "density"]).optional().catch(undefined),
  globe: z.boolean().optional().catch(undefined),
  /** camera: "lat,lng,zoom" */
  at: z.string().optional().catch(undefined),
})
export type AppSearch = z.infer<typeof searchSchema>

export const list = (s: string | undefined) => (s ? s.split(",").filter(Boolean) : [])
export const unlist = (xs: string[]) => (xs.length ? xs.join(",") : undefined)

export function toggleIn(csv: string | undefined, value: string) {
  const xs = list(csv)
  return unlist(xs.includes(value) ? xs.filter((x) => x !== value) : [...xs, value])
}

export function useAppSearch() {
  const search = useSearch({ from: "/" })
  const navigate = useNavigate({ from: "/" })
  const set = useCallback(
    (patch: Partial<AppSearch> | ((prev: AppSearch) => Partial<AppSearch>), opts?: { push?: boolean }) =>
      navigate({
        search: (prev) => {
          const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) } as Record<string, unknown>
          for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k]
          return next as AppSearch
        },
        replace: !opts?.push,
      }),
    [navigate],
  )
  return [search, set] as const
}

export function parseCamera(at: string | undefined) {
  const [lat, lng, zoom] = (at ?? "").split(",").map(Number)
  if ([lat, lng, zoom].some((n) => !Number.isFinite(n))) return null
  return { latitude: lat, longitude: lng, zoom }
}
