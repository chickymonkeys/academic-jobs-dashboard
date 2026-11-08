import { computed, toValue, type MaybeRefOrGetter } from "vue"
import { keepPreviousData, useQuery } from "@tanstack/vue-query"
import { MetaSchema, SnapshotSchema, VacancyDetailSchema } from "@/domain/vacancy"

/**
 * Data contract: a tiny `meta.json` (polled) + a versioned `vacancies.json` index + lazy per-listing details.
 * Point VITE_DATA_URL at any static host / CDN / API that serves the same shapes.
 */
const BASE = (import.meta.env.VITE_DATA_URL as string | undefined)?.replace(/\/$/, "") ?? "/data"

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-cache" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  // SPA hosting answers unknown paths with index.html and a 200, so check what actually came back
  if (!res.headers.get("content-type")?.includes("json")) throw new Error(`Not found — ${url}`)
  return res.json()
}

export const META_POLL_MS = 2 * 60_000

export const useMeta = () =>
  useQuery({
    queryKey: ["meta"],
    queryFn: async () => MetaSchema.parse(await getJson(`${BASE}/meta.json`)),
    refetchInterval: META_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })

/** Keyed by version: a new snapshot is fetched only when meta reports a new version */
export function useSnapshot(version: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ["snapshot", computed(() => toValue(version))],
    queryFn: async () => SnapshotSchema.parse(await getJson(`${BASE}/vacancies.json?v=${toValue(version)}`)),
    enabled: computed(() => !!toValue(version)),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
    // The index is read-only and scanned on every keystroke; deep proxies would only slow that down
    shallow: true,
  })
}

export function useDetail(id: MaybeRefOrGetter<string>, version: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ["detail", computed(() => toValue(id)), computed(() => toValue(version))],
    queryFn: async () =>
      VacancyDetailSchema.parse(await getJson(`${BASE}/details/${toValue(id)}.json?v=${toValue(version)}`)),
    staleTime: Infinity,
    shallow: true,
  })
}
