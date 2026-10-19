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
  fetchRaw(): Promise<string>
  parse(raw: string): Draft[]
}

export const USER_AGENT = "academic-jobs-dashboard/0.1 (listings aggregator; ingest script)"
