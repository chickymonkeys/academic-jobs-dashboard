import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import type { Discipline } from "../../src/domain/vacancy"
import { politeClient } from "../lib/http"
import { clean, htmlToBlocks, summarize, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

const BASE = "https://www.jobs.ac.uk"
const PER_PAGE = 25
const MAX_PAGES = 20
/** Academic discipline facets searched, and the discipline each stands for */
const FACETS: Record<string, Discipline> = { economics: "econ", "politics-and-government": "polsci" }
const search = (facet: string, start: number) =>
  `${BASE}/search/?activeFacet=academicDisciplineFacet&sortOrder=1&pageSize=${PER_PAGE}&startIndex=${start}&academicDisciplineFacet%5B0%5D=${facet}`
/** Job pages fetched per run; the rest wait for the next run, listed from their search card meanwhile */
const POSTING_BUDGET = 150

type Address = { addressLocality?: string; addressRegion?: string; addressCountry?: string }
type JobPosting = {
  title?: string
  description?: string
  datePosted?: string
  validThrough?: string
  employmentType?: string
  hiringOrganization?: { name?: string; logo?: string; department?: { name?: string } }
  jobLocation?: { address?: Address } | Array<{ address?: Address }>
}
/**
 * Search-result cards (HTML), each job page's schema.org JobPosting by job code (null = page had none), and
 * the disciplines whose search turned up each code (payloads from before the politics search lack it: economics)
 */
type Raw = {
  fetchedAt: string
  cards: string[]
  postings: Record<string, JobPosting | null>
  disciplines?: Record<string, Discipline[]>
}

/**
 * Cards give only a city, and a job page without schema.org data gives nothing more: the UK is the default,
 * except in the cities of British universities' branch campuses
 */
const OVERSEAS_CAMPUS: Record<string, string> = {
  suzhou: "CN",
  ningbo: "CN",
  semenyih: "MY",
  "kuala lumpur": "MY",
  putrajaya: "MY",
  dubai: "AE",
  "ras al khaimah": "AE",
  "hong kong": "HK",
  singapore: "SG",
}

/**
 * A university's whole PhD round can land in the economics facet (biomedical studentships, say): a
 * studentship is kept only when its title or department names a social science
 */
const SOCIAL_SCIENCE =
  /econom|politic|polic(y|ies)|social scien|esrc|financ|government|international|public admin|business|management|accounting|trade|labou?r|welfare|development (studies|economics)|international development/i

const codeOf = (card: string) => card.match(/href="\/job\/([A-Z0-9]+)\//)?.[1] ?? null

export const jobsAcUkAdapter: SourceAdapter = {
  id: "jobsacuk",
  name: "jobs.ac.uk",
  homepage: `${BASE}/jobs/economics`,
  rawExt: "json",

  async fetchRaw(previous) {
    const get = politeClient(1500)
    const cards = new Map<string, string>()
    const disciplines: Record<string, Discipline[]> = {}
    for (const [facet, discipline] of Object.entries(FACETS)) {
      let total = Infinity
      for (let page = 0; page * PER_PAGE < total && page < MAX_PAGES; page++) {
        const html = await get(search(facet, page * PER_PAGE + 1))
        const count = html.match(/class="job-count">\s*(\d+)/)?.[1]
        if (count == null) throw new Error(`jobs.ac.uk ${facet} page ${page}: job count not found`)
        total = Number(count)
        // Each card runs up to its save-job toggle; slicing there keeps the page footer out of the last one
        const found = html
          .split('<div class="j-search-result__result')
          .slice(1)
          .map((c) => {
            const end = c.indexOf("j-search-result__save-job")
            return end < 0 ? c : c.slice(0, end)
          })
        if (!found.length) break
        for (const card of found) {
          const code = codeOf(card)
          if (!code) continue
          cards.set(code, card)
          const tags = (disciplines[code] ??= [])
          if (!tags.includes(discipline)) tags.push(discipline)
        }
      }
    }
    if (!cards.size) throw new Error("jobs.ac.uk: no job cards found")

    const before: Raw["postings"] = previous ? ((JSON.parse(previous) as Raw).postings ?? {}) : {}
    const postings: Raw["postings"] = {}
    let budget = POSTING_BUDGET
    for (const [code, card] of cards) {
      if (code in before) {
        postings[code] = before[code]
        continue
      }
      if (budget-- <= 0) continue
      const path = card.match(/href="(\/job\/[^"]+)"/)?.[1]
      try {
        const page = await get(`${BASE}${path}`)
        postings[code] = jobPosting(page)
      } catch (e) {
        console.warn(`  jobs.ac.uk ${code}: ${(e as Error).message}`)
      }
    }
    return JSON.stringify({ fetchedAt: new Date().toISOString(), cards: [...cards.values()], postings, disciplines } satisfies Raw)
  },

  parse(raw) {
    const { fetchedAt, cards, postings, disciplines = {} } = JSON.parse(raw) as Raw
    return cards
      .map((card) => toDraft(card, postings, disciplines, fetchedAt))
      .filter((d): d is Draft => d != null)
  },
}

function jobPosting(html: string): JobPosting | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as { "@type"?: string }
      if (data["@type"] === "JobPosting") return data as JobPosting
    } catch {
      /* not the block we want */
    }
  }
  return null
}

const text = (html: string | null | undefined) => (html ? clean(html.replace(/<[^>]+>/g, " ")) : "")
const day = (iso: string | undefined) => iso?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
/** Cards print "19 Oct" with no year: take the year that puts it on the right side of the fetch date */
function cardDay(s: string | undefined, fetchedAt: string, side: "past" | "future"): string | null {
  const m = s?.match(/(\d{1,2})\s+([a-z]{3})/i)
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1
  if (!m || month < 0) return null
  const ref = new Date(fetchedAt)
  let year = ref.getUTCFullYear()
  const at = (y: number) => Date.UTC(y, month, Number(m[1]))
  if (side === "past" && at(year) > ref.getTime() + 86_400_000) year--
  if (side === "future" && at(year) < ref.getTime() - 30 * 86_400_000) year++
  return new Date(at(year)).toISOString().slice(0, 10)
}

function toDraft(
  card: string,
  postings: Raw["postings"],
  disciplines: NonNullable<Raw["disciplines"]>,
  fetchedAt: string,
): Draft | null {
  const code = codeOf(card)
  if (!code) return null
  const path = card.match(/href="(\/job\/[^"]+)"/)![1]
  const p = postings[code] ?? null
  const org = p?.hiringOrganization
  const address = [p?.jobLocation].flat()[0]?.address
  const cardPlace = text(card.match(/<div>Location:([\s\S]*?)<\/div>/)?.[1])
  // A page's own country stands even when the table doesn't know it, rather than defaulting to the UK
  const country = address?.addressCountry
    ? findCountry(address.addressCountry)
    : (findCountry(cardPlace.split(",").pop()) ??
      findCountry(OVERSEAS_CAMPUS[cardPlace.split(",")[0].trim().toLowerCase()] ?? "United Kingdom"))
  const city = address?.addressLocality ?? (cardPlace.split(",")[0] || null)
  const title = clean(p?.title ?? text(card.match(/<a href="\/job\/[^"]+">([\s\S]*?)<\/a>/)?.[1])) || "Untitled position"
  const department =
    clean(org?.department?.name ?? text(card.match(/class="j-search-result__department">([\s\S]*?)<\/div>/)?.[1])) || null
  if (/studentship/i.test(title) && !SOCIAL_SCIENCE.test(`${title} ${department ?? ""}`)) return null
  const blocks = htmlToBlocks(p?.description ?? "")
  const logo = org?.logo ?? card.match(/<img class="j-image j-small-logo" src="([^"]+)"/)?.[1]
  return {
    id: `jobsacuk-${code}`,
    source: "jobsacuk",
    url: `${BASE}${path}`,
    alsoOn: [],
    title,
    institution:
      clean(org?.name ?? text(card.match(/class="j-search-result__employer">([\s\S]*?)<\/div>/)?.[1])) ||
      "Unknown institution",
    department,
    // In UK titles a Research Associate is a postdoc (in US ones it's often a research assistant)
    category: classifyCategory({
      title,
      types: [],
      employer: org?.name,
      hint: /\bresearch associate\b/i.test(title) ? "postdoc" : null,
    }),
    disciplines: disciplines[code] ?? ["econ"],
    positionTypes: (p?.employmentType ?? "").split(",").map(clean).filter(Boolean),
    fields: fieldsFromText(title),
    city: tidyPlace(city),
    admin: tidyPlace(address?.addressRegion),
    country: country?.name ?? (clean(address?.addressCountry ?? "") || "Unknown"),
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: day(p?.datePosted) ?? cardDay(card.match(/Date Placed:\s*<\/strong>([^<]*)/)?.[1], fetchedAt, "past"),
    deadline: day(p?.validThrough) ?? cardDay(card.match(/j-search-result__date--blue[^>]*>([^<]*)/)?.[1], fetchedAt, "future"),
    summary: summarize(blocks),
    logoUrl: logo ? new URL(logo, BASE).href : null,
    detail: {
      blocks,
      keywords: [],
      salary: text(card.match(/<strong>Salary:\s*<\/strong>([\s\S]*?)<\/div>/)?.[1]) || null,
      requirements: [],
      jel: [],
    },
  }
}
