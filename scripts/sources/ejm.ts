import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromEjm } from "../../src/domain/taxonomy"
import { clean, htmlToBlocks, summarize, tidyPlace } from "../lib/text"
import { USER_AGENT, type Draft, type SourceAdapter } from "./types"

const FEED = "https://backend.econjobmarket.org/data/zz_public/json/Ads"

type Named = { name?: string | null }
type EjmLocation = {
  city?: string | null
  state?: string | null
  country_code?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}
type EjmAd = {
  adtitle?: string
  adtext?: string
  startdate?: string | null
  deadline_date?: string | null
  department?: string | null
  name?: string
  latitude?: number | string | null
  longitude?: number | string | null
  locations?: EjmLocation[] | string | null
  position_types?: Named[] | string | null
  categories?: Named[] | string | null
  url: string
  logo?: string | null
  logo_url?: string | null
}

// The feed has historically mixed JSON arrays with Python-repr strings for nested fields; accept both.
function names(v: Named[] | string | null | undefined): string[] {
  if (Array.isArray(v)) return v.map((x) => x?.name ?? "").filter(Boolean)
  if (typeof v === "string") return [...v.matchAll(/'name':\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  return []
}

function locations(v: EjmAd["locations"]): EjmLocation[] {
  if (Array.isArray(v)) return v
  if (typeof v === "string") {
    try {
      return JSON.parse(v.replace(/'/g, '"').replace(/\bNone\b/g, "null"))
    } catch {
      return []
    }
  }
  return []
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN
  return Number.isFinite(n) ? n : null
}
const day = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

export const ejmAdapter: SourceAdapter = {
  id: "ejm",
  name: "EconJobMarket",
  homepage: "https://econjobmarket.org",
  rawExt: "json",

  async fetchRaw() {
    const res = await fetch(FEED, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } })
    if (!res.ok) throw new Error(`EJM feed HTTP ${res.status}`)
    return res.text()
  },

  parse(raw) {
    const ads = JSON.parse(raw) as EjmAd[]
    return ads.map((ad): Draft => {
      const sourceId = ad.url.match(/positions\/(\d+)/)?.[1] ?? ad.url.replace(/\W+/g, "")
      const blocks = htmlToBlocks(ad.adtext ?? "")
      const loc = locations(ad.locations)[0]
      const country = findCountry(loc?.country_code)
      const types = names(ad.position_types)
      const categories = names(ad.categories)
      const title = clean(ad.adtitle ?? "Untitled position")
      const lat = num(ad.latitude ?? loc?.latitude)
      const lng = num(ad.longitude ?? loc?.longitude)
      return {
        id: `ejm-${sourceId}`,
        source: "ejm",
        url: ad.url,
        alsoOn: [],
        title,
        institution: clean(ad.name ?? "Unknown institution"),
        department: ad.department ? clean(ad.department) : null,
        category: classifyCategory({ title, types }),
        positionTypes: types,
        fields: fieldsFromEjm(categories),
        city: tidyPlace(loc?.city),
        admin: tidyPlace(loc?.state),
        country: country?.name ?? loc?.country_code ?? "Unknown",
        countryCode: country?.iso2 ?? loc?.country_code ?? null,
        lat,
        lng,
        geoPrecision: lat != null && lng != null ? "exact" : null,
        postedAt: day(ad.startdate),
        deadline: day(ad.deadline_date),
        summary: summarize(blocks),
        logoUrl: ad.logo && ad.logo_url ? ad.logo_url : null,
        detail: { blocks, keywords: categories, salary: null, requirements: [], jel: [] },
      }
    })
  },
}
