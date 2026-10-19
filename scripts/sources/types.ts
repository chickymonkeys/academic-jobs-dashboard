import type { GeoPrecision, SourceId, Vacancy, VacancyDetail } from "../../src/domain/vacancy"

/** What an adapter emits: a vacancy before geocoding, dedupe and first-seen bookkeeping */
export type Draft = Omit<Vacancy, "worldRegion" | "lat" | "lng" | "geoPrecision" | "firstSeenAt"> & {
  lat: number | null
  lng: number | null
  geoPrecision: GeoPrecision | null
  detail: Omit<VacancyDetail, "id">
}

/**
 * A listings source. Adding a source = implementing this interface and registering it in scripts/ingest.ts.
 * `fetchRaw` is network-only; `parse` is pure, so cached raw payloads can be re-parsed offline.
 */
export interface SourceAdapter {
  id: SourceId
  name: string
  homepage: string
  rawExt: "json" | "xml"
  /** Minimum hours between live fetches; a younger cached payload is reused instead */
  refreshHours?: number
  /** Why the source is not read (its robots.txt or terms, say): the ingest skips it unless run with --enable=<id> */
  off?: string
  /** `previous` is the last cached payload, so per-listing pages fetched before need not be fetched again */
  fetchRaw(previous: string | null): Promise<string>
  parse(raw: string): Draft[]
}

export const USER_AGENT = "academic-jobs-dashboard/0.1 (listings aggregator; ingest script)"
