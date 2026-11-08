import { XMLParser } from "fast-xml-parser"
import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import type { Discipline } from "../../src/domain/vacancy"
import { politeClient } from "../lib/http"
import { clean, dayFromText, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

const BASE = "https://www.higheredjobs.com"
/** Faculty category feeds, with the discipline and field each one implies */
const FEEDS: Record<string, { disciplines: Discipline[]; fields: string[] }> = {
  "81": { disciplines: ["econ"], fields: [] }, // Economics
  "50": { disciplines: ["econ"], fields: ["Q"] }, // Agricultural Economics and Agribusiness
  "90": { disciplines: ["polsci"], fields: [] }, // Political Science
  "209": { disciplines: ["policy"], fields: [] }, // Public Administration and Policy
}
const CA_PROVINCES = new Set("AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "))

/** Category feed XML by category id */
type Raw = Record<string, string>
type HejItem = { title?: string; description?: string; link?: string; pubDate?: string }

export const hejAdapter: SourceAdapter = {
  id: "hej",
  name: "HigherEdJobs",
  homepage: `${BASE}/faculty/search.cfm?JobCat=81`,
  rawExt: "json",

  /**
   * The site answers bots it doesn't like with a challenge page, served as 200: that is not a feed, so it is
   * retried, and a feed that still fails is carried over from the previous payload instead of being emptied.
   */
  async fetchRaw(previous, degraded) {
    const get = politeClient(1000)
    const prior = previous ? (JSON.parse(previous) as Raw) : {}
    const raw: Raw = {}
    const failed: string[] = []
    for (const cat of Object.keys(FEEDS)) {
      try {
        raw[cat] = await get(`${BASE}/rss/categoryFeed.cfm?catID=${cat}`, {
          accept: "application/rss+xml, application/xml, */*",
          check: (xml) => (xml.includes("<rss") ? null : "not an RSS feed"),
        })
      } catch (e) {
        failed.push((e as Error).message)
        if (prior[cat]) raw[cat] = prior[cat]
      }
    }
    if (failed.length === Object.keys(FEEDS).length) throw new Error(failed[0])
    if (failed.length) degraded(`${failed.length} of ${Object.keys(FEEDS).length} category feeds (${failed.join("; ")})`)
    return JSON.stringify(raw)
  },

  // The feeds carry no description, deadline or field codes: title, "Institution (City, ST)", link and date
  parse(raw) {
    const parser = new XMLParser({ parseTagValue: false, isArray: (name) => name === "item" })
    const byId = new Map<string, Draft>()
    for (const [cat, xml] of Object.entries(JSON.parse(raw) as Raw)) {
      const doc = parser.parse(xml) as { rss?: { channel?: { item?: HejItem[] } } }
      for (const item of doc.rss?.channel?.item ?? []) {
        const d = toDraft(item, FEEDS[cat] ?? { disciplines: ["econ"], fields: [] })
        if (!d) continue
        const seen = byId.get(d.id)
        if (!seen) {
          byId.set(d.id, d)
          continue
        }
        seen.fields = [...new Set([...seen.fields, ...d.fields].filter((f) => f !== "any"))]
        if (!seen.fields.length) seen.fields = ["any"]
        seen.disciplines = [...new Set([...seen.disciplines, ...d.disciplines])]
      }
    }
    return [...byId.values()]
  },
}

function toDraft(item: HejItem, feed: (typeof FEEDS)[string]): Draft | null {
  const link = clean(item.link ?? "")
  const code = link.match(/JobCode=(\d+)/i)?.[1]
  if (!code) return null
  const title = clean(item.title ?? "") || "Untitled position"
  const desc = clean(item.description ?? "")
  const m = desc.match(/^(.*)\s+\(([^()]*)\)$/)
  const parts = (m?.[2] ?? "").split(/\s*,\s*/).filter(Boolean)
  const last = parts.length > 1 ? parts[parts.length - 1] : null
  // "City, ST" is a US state (or Canadian province); anything else ends in a country name
  const country = !last
    ? findCountry("US")
    : /^[A-Z]{2}$/.test(last)
      ? findCountry(CA_PROVINCES.has(last) ? "CA" : "US")
      : findCountry(last)
  const text = fieldsFromText(title)
  return {
    id: `hej-${code}`,
    source: "hej",
    url: `${BASE}/details.cfm?JobCode=${code}`,
    alsoOn: [],
    title,
    institution: (m?.[1] ?? desc) || "Unknown institution",
    department: null,
    category: classifyCategory({ title, types: [], employer: m?.[1] }),
    disciplines: feed.disciplines,
    positionTypes: [],
    fields: feed.fields.length ? [...new Set([...feed.fields, ...text.filter((f) => f !== "any")])] : text,
    city: last ? tidyPlace(parts.slice(0, -1).join(", ")) : null,
    admin: last && /^[A-Z]{2}$/.test(last) ? last : null,
    country: country?.name ?? last ?? "Unknown",
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: dayFromText(item.pubDate),
    deadline: null,
    summary: "",
    logoUrl: null,
    detail: { blocks: [], keywords: [], salary: null, requirements: [], jel: [] },
  }
}
