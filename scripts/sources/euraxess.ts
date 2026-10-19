import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromEuraxess, fieldsFromText } from "../../src/domain/taxonomy"
import type { Category, Discipline } from "../../src/domain/vacancy"
import { politeClient } from "../lib/http"
import { clean, dayFromText, summarize, tidyName, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

const BASE = "https://euraxess.ec.europa.eu"
/** Research fields searched (subfields included, so Political sciences covers Public policy) and the discipline each stands for */
const FIELDS: Record<string, Discipline> = { "117": "econ", "367": "polsci" }
/** Job offers (not funding or hosting offers) in one research field */
const search = (field: string, page: number) =>
  `${BASE}/jobs/search?f%5B0%5D=job_research_field%3A${field}&f%5B1%5D=offer_type%3Ajob_offer${page ? `&page=${page}` : ""}`
const PER_PAGE = 10
const MAX_PAGES = 100

/** EURAXESS has no feed or API; the payload is the result cards of its search pages, kept as HTML */
type Raw = { fetchedAt: string; total: number; cards: string[] }

/** Research fields (top level) that are ours */
const ROOT_DISCIPLINE: Record<string, Discipline> = { Economics: "econ", "Political sciences": "polsci" }
/** Some offers tick every research field; past a handful of them, keep an offer only if its title names one of ours */
const MAX_ROOTS = 3
const OURS_TITLE =
  /econom|financ|business|management|marketing|accounting|banking|polic|politic|government|international (relations|affairs|studies|politics|development)|trade|\btax/i

/** The most senior researcher profile on the offer, as a category hint */
const PROFILE_HINT: ReadonlyArray<[RegExp, Category]> = [
  [/\(R[34]\)/, "faculty"],
  [/\(R2\)/, "postdoc"],
  [/\(R1\)/, "predoc"],
]

export const euraxessAdapter: SourceAdapter = {
  id: "euraxess",
  name: "EURAXESS",
  homepage: `${BASE}/jobs/search`,
  rawExt: "json",
  off: "its robots.txt disallows /jobs/, both search and job pages",
  // Should it be enabled (with the operator's leave), read the listing twice a day at most, slowly
  refreshHours: 12,

  async fetchRaw() {
    const get = politeClient(5000)
    const cards = new Map<string, string>()
    let total = 0
    for (const field of Object.keys(FIELDS)) {
      let count = Infinity
      for (let page = 0; page * PER_PAGE < count && page < MAX_PAGES; page++) {
        const html = await get(search(field, page))
        const found = html.match(/id="search_results_count">[^(]*\((\d+)\)/)?.[1]
        if (found == null) throw new Error(`EURAXESS field ${field} page ${page}: result count not found`)
        count = Number(found)
        const articles = html.match(/<article class="ecl-content-item">[\s\S]*?<\/article>/g) ?? []
        if (!articles.length) break
        for (const card of articles) {
          const id = card.match(/href="\/jobs\/(\d+)"/)?.[1]
          if (id) cards.set(id, card)
        }
      }
      total += count
    }
    if (!cards.size) throw new Error("EURAXESS: no job cards found")
    return JSON.stringify({ fetchedAt: new Date().toISOString(), total, cards: [...cards.values()] } satisfies Raw)
  },

  parse(raw) {
    const { cards } = JSON.parse(raw) as Raw
    return cards.map(toDraft).filter((d): d is Draft => d != null)
  },
}

const text = (html: string | null | undefined) => (html ? clean(html.replace(/<[^>]+>/g, " ")) : "")
const links = (html: string | null | undefined) => [...(html ?? "").matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((m) => clean(m[1]))

/** The value of one labelled row ("Department", "Work-Locations", …) in a card's metadata list */
function row(card: string, name: string): string | null {
  const start = card.indexOf(`class="id-${name} `)
  if (start < 0) return null
  const next = card.indexOf('class="id-', start + 1)
  const chunk = card.slice(start, next < 0 ? undefined : card.lastIndexOf("<", next))
  const value = chunk.indexOf("ecl-text-standard")
  return value < 0 ? null : chunk.slice(chunk.indexOf(">", value) + 1)
}

/** Job boards, ministries and hiring programmes that post on behalf of the employer named in the work location */
const INTERMEDIARY =
  /^(Times Higher Education|Academic Positions|JREC-IN Portal|AcademicTransfer|Jobs\.ac\.cn|ABG\b|Serra H[uú]nter|FAPESP|Life Science Network)|\bMinist(ry|ere|ère)\b/i
/** Location parts that name an organisation unit rather than a place */
const ORG_WORDS =
  /universit|department|facult|fakult|school|scuola|escuela|[ée]cole|hochschul|institut|college|cent(er|re)\b|division|laborator|campus|academ|akadem|library|office/i

/**
 * "Number of offers: 1, Norway, Inland School of Business, Kongsvinger, 2212, Strandvegen 3": country, then the
 * organisation, then the city (the first plain place name before the postcode or street), then the rest.
 */
function workLocation(html: string | null) {
  // Several locations can run together; the first is enough to place the offer
  const first = text(html).split(/Number of offers:\s*\d+\s*,\s*/i).map((s) => s.trim()).find(Boolean) ?? ""
  const parts = first
    .split(/\s*,\s*/)
    .map((p) => p.replace(/\s*\([A-Z]{2}\)$/, "").replace(/\s+CEDEX\b.*$/i, ""))
    .filter(Boolean)
  const digit = parts.findIndex((p, i) => i >= 2 && /\d/.test(p))
  const end = digit > 0 ? digit : parts.length
  let city: string | null = null
  for (let i = 2; i < end && !city; i++) if (!ORG_WORDS.test(parts[i]) && !findCountry(parts[i])) city = parts[i]
  return { country: parts[0] ?? null, org: parts[1] ?? null, city }
}

function toDraft(card: string): Draft | null {
  const id = card.match(/href="\/jobs\/(\d+)"/)?.[1]
  if (!id) return null
  const title = text(card.match(/<h3 class="ecl-content-block__title">([\s\S]*?)<\/h3>/)?.[1]) || "Untitled position"

  // Each research field is a path: "Economics » Management studies", "Political sciences » Public policy"
  const fieldHtml = row(card, "Research-Field")
  const paths = [...(fieldHtml ?? "").matchAll(/<div>([\s\S]*?)<\/div>/g)].map((m) => links(m[1])).filter((p) => p.length)
  if (!paths.length) paths.push(...links(fieldHtml).map((f) => [f]))
  const roots = new Set(paths.map((p) => p[0]))
  const disciplines = new Set([...roots].map((r) => ROOT_DISCIPLINE[r]).filter((d) => d != null))
  if (paths.some((p) => p[p.length - 1] === "Public policy")) disciplines.add("policy")
  if (!disciplines.size) return null
  if (roots.size > MAX_ROOTS && !OURS_TITLE.test(title)) return null
  const subfields = paths.filter((p) => p[0] === "Economics" && p.length > 1).map((p) => p[p.length - 1])

  // Reposts from other job boards (Times Higher Education) carry no work location, so they can't be placed
  const locHtml = row(card, "Work-Locations")
  if (!locHtml) return null

  const meta = [...card.matchAll(/<li class="ecl-content-block__primary-meta-item">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]))
  const posted = meta.find((m) => /^Posted on/i.test(m))
  const loc = workLocation(locHtml)
  const country = findCountry(loc.country)
  const profiles = links(row(card, "Researcher-Profile"))
  const funding = text(row(card, "Funding-Programme"))
  // The teaser is the description with its tags stripped, which glues sentences together ("Business.The")
  const snippet = text(card.match(/<div class="ecl-content-block__description">([\s\S]*?)<\/div>/)?.[1])
    .replace(/([a-z)])([.:;])([A-Z])/g, "$1$2 $3")
    .replace(/\.{3}$/, "…")
  const blocks = snippet ? [{ t: "p" as const, text: snippet }] : []
  const fields = fieldsFromEuraxess(subfields)
  const poster = (meta.find((m) => m && !/^Posted on/i.test(m)) ?? "").replace(/\s+via\s+.+$/i, "")
  const employer = !poster || (INTERMEDIARY.test(poster) && loc.org) ? loc.org : poster
  const institution = employer ? tidyName(employer) : "Unknown institution"

  return {
    id: `euraxess-${id}`,
    source: "euraxess",
    url: `${BASE}/jobs/${id}`,
    alsoOn: [],
    title,
    institution,
    department: text(row(card, "Department")) || null,
    category: classifyCategory({
      title,
      types: profiles,
      employer: institution,
      hint: PROFILE_HINT.find(([re]) => profiles.some((p) => re.test(p)))?.[1],
    }),
    disciplines: [...disciplines],
    positionTypes: profiles,
    fields: fields.length ? fields : fieldsFromText(title),
    city: tidyPlace(loc.city),
    admin: null,
    country: country?.name ?? loc.country ?? "Unknown",
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: dayFromText(posted),
    deadline: dayFromText(text(row(card, "Application-Deadline"))),
    summary: summarize(blocks),
    logoUrl: null,
    detail: {
      blocks,
      keywords: [...new Set([...subfields, ...(/^Not funded/i.test(funding) ? [] : [funding].filter(Boolean))])],
      salary: null,
      requirements: [],
      jel: [],
    },
  }
}
