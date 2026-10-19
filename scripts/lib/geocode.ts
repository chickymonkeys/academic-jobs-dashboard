import { readFile, writeFile } from "node:fs/promises"
import { findCountry } from "../../src/domain/geo"
import type { GeoPrecision } from "../../src/domain/vacancy"
import type { Draft } from "../sources/types"
import { USER_AGENT } from "../sources/types"
import { normName } from "./text"

type Hit = { lat: number; lng: number; precision: GeoPrecision }

/**
 * Resolution order (cheapest first):
 *   1. coordinates another source already published for the same institution
 *   2. persistent cache (data/geocache.json)
 *   3. Nominatim — institution, then city — throttled to 1 req/s per the OSM usage policy
 *   4. country fallback point (flagged as low precision in the UI)
 * A per-run budget bounds network time; unresolved lookups are not cached, so later runs refine them.
 */
export class Geocoder {
  private known = new Map<string, Hit & { cc: string | null }>()
  private lastCall = 0
  private dirty = 0
  stats = { known: 0, cached: 0, network: 0, country: 0, failed: 0 }

  private constructor(
    private file: string,
    private cache: Record<string, Hit | null>,
    private budget: number,
  ) {}

  static async load(file: string, budget: number) {
    let cache: Record<string, Hit | null> = {}
    try {
      cache = JSON.parse(await readFile(file, "utf8"))
    } catch {
      /* first run */
    }
    return new Geocoder(file, cache, budget)
  }

  indexKnown(drafts: Draft[]) {
    for (const d of drafts) {
      if (d.lat != null && d.lng != null) {
        this.known.set(normName(d.institution), { lat: d.lat, lng: d.lng, precision: "exact", cc: d.countryCode })
      }
    }
  }

  async resolve(d: Draft): Promise<boolean> {
    const known = this.known.get(normName(d.institution))
    if (known && (!known.cc || !d.countryCode || known.cc === d.countryCode)) {
      this.stats.known++
      return this.assign(d, known)
    }
    const country = findCountry(d.countryCode ?? d.country)
    const cc = country?.iso2.toLowerCase()
    const place = [d.city, d.admin, country?.name].filter(Boolean).join(", ")

    let hit = await this.lookup(`inst|${normName(d.institution)}|${normName(d.city ?? "")}|${cc ?? ""}`, "exact", {
      q: [d.institution, d.city, country?.name].filter(Boolean).join(", "),
      countrycodes: cc,
    })
    if (!hit && d.city) hit = await this.lookup(`city|${normName(place)}`, "city", { q: place, countrycodes: cc })
    if (hit) return this.assign(d, hit)
    if (country) {
      this.stats.country++
      return this.assign(d, { lat: country.lat, lng: country.lng, precision: "country" })
    }
    this.stats.failed++
    return false
  }

  async save() {
    await writeFile(this.file, JSON.stringify(this.cache, null, 0))
  }

  private assign(d: Draft, hit: Hit) {
    d.lat = hit.lat
    d.lng = hit.lng
    d.geoPrecision = hit.precision
    return true
  }

  private async lookup(key: string, precision: GeoPrecision, params: Record<string, string | undefined>) {
    if (key in this.cache) {
      this.stats.cached++
      return this.cache[key]
    }
    if (this.budget <= 0) return null
    this.budget--
    const wait = this.lastCall + 1100 - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.lastCall = Date.now()

    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("limit", "1")
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v)
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const [first] = (await res.json()) as Array<{ lat: string; lon: string }>
      const hit = first ? { lat: +first.lat, lng: +first.lon, precision } : null
      this.cache[key] = hit
      this.stats.network++
      if (++this.dirty % 20 === 0) await this.save()
      return hit
    } catch (e) {
      console.warn(`  geocode failed for "${params.q}": ${(e as Error).message}`)
      return null
    }
  }
}
