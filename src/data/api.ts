import { queryOptions, keepPreviousData } from "@tanstack/react-query"
import { MetaSchema, SnapshotSchema, VacancyDetailSchema } from "@/domain/vacancy"

/**
 * Data contract: a tiny `meta.json` (polled) + a versioned `vacancies.json` index + lazy per-listing details.
 * Point VITE_DATA_URL at any static host / CDN / API that serves the same shapes.
 */
const BASE = (import.meta.env.VITE_DATA_URL as string | undefined)?.replace(/\/$/, "") ?? "/data"

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-cache" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

export const META_POLL_MS = 2 * 60_000

export const metaQuery = queryOptions({
  queryKey: ["meta"],
  queryFn: async () => MetaSchema.parse(await getJson(`${BASE}/meta.json`)),
  refetchInterval: META_POLL_MS,
  refetchOnWindowFocus: true,
  staleTime: 30_000,
})

/** Keyed by version: a new snapshot is fetched only when meta reports a new version */
export const snapshotQuery = (version: string | undefined) =>
  queryOptions({
    queryKey: ["snapshot", version],
    queryFn: async () => SnapshotSchema.parse(await getJson(`${BASE}/vacancies.json?v=${version}`)),
    enabled: !!version,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  })

export const detailQuery = (id: string, version: string | undefined) =>
  queryOptions({
    queryKey: ["detail", id, version],
    queryFn: async () => VacancyDetailSchema.parse(await getJson(`${BASE}/details/${id}.json?v=${version}`)),
    staleTime: Infinity,
  })
