import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import type { Category, Discipline } from "../../src/domain/vacancy"
import { politeClient } from "../lib/http"
import { clean, dayFromText, htmlToBlocks, summarize, tidyName, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

const BASE = "https://www.timeshighereducation.com/unijobs"
/** Subject browse pages, and the discipline each stands for. THE closes its search and RSS paths to crawlers. */
const CATEGORIES: Record<string, Discipline> = {
  "economics-and-econometrics": "econ",
  "politics-and-international-studies": "polsci",
}
const MAX_PAGES = 10
/**
 * Institution-wide hiring schemes are filed under dozens of disciplines ("90 Scholars for 90th Anniversary"):
 * past this many, a listing stays only if its title names one of ours
 */
const MAX_DISCIPLINES = 8
const OURS = /econom|financ|business|trade|\btax|polic|politic|international|government|governance|public|social science/i
/** Job pages fetched per run; the rest wait for the next run, listed from their card meanwhile */
const POSTING_BUDGET = 100

type JobPosting = {
  description?: string
  datePosted?: string
  validThrough?: string
  hiringOrganization?: { name?: string; logo?: string }
  jobLocation?: Array<{ address?: { addressCountry?: string } }>
}
/** What a job page adds to its card: the JobPosting, the page's tag metadata (job type, location) and its closing date */
type Posting = { ld: JobPosting | null; meta: Record<string, string>; closing: string | null }
type Raw = {
  fetchedAt: string
  /** Listing cards (HTML) by job id */
  cards: Record<string, string>
  disciplines: Record<string, Discipline[]>
  postings: Record<string, Posting | null>
}

/** The tag metadata worth keeping from a job page's analytics data layer */
const META_KEYS = ["LocationDescription", "Job Type", "Academic Discipline", "Contract Type", "Hours", "SalaryDescription"]

export const theJobsAdapter: SourceAdapter = {
  id: "thejobs",
  name: "Times Higher Education",
  homepage: `${BASE}/listings/economics-and-econometrics/`,
  rawExt: "json",

  async fetchRaw(previous) {
    const get = politeClient(2000)
    const cards: Raw["cards"] = {}
    const disciplines: Raw["disciplines"] = {}
    for (const [category, discipline] of Object.entries(CATEGORIES)) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const html = await get(`${BASE}/listings/${category}/${page > 1 ? `${page}/` : ""}`)
        // Each card runs up to its footer (shortlist form, "n days ago"), which carries nothing we use
        for (const chunk of html.split('<li class="lister__item').slice(1)) {
          const id = chunk.match(/id="item-(\d+)"/)?.[1]
          if (!id) continue
          const end = chunk.indexOf('class="lister__footer')
          cards[id] = end < 0 ? chunk : chunk.slice(0, end)
          const tags = (disciplines[id] ??= [])
          if (!tags.includes(discipline)) tags.push(discipline)
        }
        if (!html.includes(`/listings/${category}/${page + 1}/`)) break
      }
    }
    if (!Object.keys(cards).length) throw new Error("THE: no job cards found")

    const before: Raw["postings"] = previous ? ((JSON.parse(previous) as Raw).postings ?? {}) : {}
    const postings: Raw["postings"] = {}
    let budget = POSTING_BUDGET
    for (const [id, card] of Object.entries(cards)) {
      if (id in before) {
        postings[id] = before[id]
        continue
      }
      if (budget-- <= 0) continue
      try {
        postings[id] = jobPage(await get(`https://www.timeshighereducation.com${cardPath(card)}`))
      } catch (e) {
        console.warn(`  THE ${id}: ${(e as Error).message}`)
      }
    }
    return JSON.stringify({ fetchedAt: new Date().toISOString(), cards, disciplines, postings } satisfies Raw)
  },

  parse(raw) {
    const { cards, disciplines, postings } = JSON.parse(raw) as Raw
    return Object.entries(cards)
      .map(([id, card]) => toDraft(id, card, disciplines[id] ?? ["econ"], postings[id] ?? null))
      .filter((d): d is Draft => d != null)
  },
}

const cardPath = (card: string) => card.match(/href="\s*(\/unijobs\/listing\/\d+\/[^"?\s]*)/)?.[1] ?? null

function jobPage(html: string): Posting {
  let ld: JobPosting | null = null
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as { "@type"?: string }
      if (data["@type"] === "JobPosting") ld = data as JobPosting
    } catch {
      /* not the block we want */
    }
  }
  const meta: Record<string, string> = {}
  const layer = html.match(/ClientGoogleTagManagerDataLayer\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])/)?.[1]
  if (layer) {
    try {
      const [all] = JSON.parse(layer) as Array<Record<string, string>>
      for (const k of META_KEYS) if (all?.[k]) meta[k] = all[k]
    } catch {
      /* metadata is a nice-to-have */
    }
  }
  const closing = html.match(/Closing date[\s\S]{0,300}?(\d{1,2} [A-Z][a-z]{2,8} \d{4})/)?.[1] ?? null
  return { ld, meta, closing }
}

const text = (html: string | null | undefined) => (html ? clean(html.replace(/<[^>]+>/g, " ")) : "")
const day = (iso: string | undefined) => iso?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null

/** Job types that settle the category on their own */
const TYPE_HINT: ReadonlyArray<[RegExp, Category]> = [
  [/postdoc/i, "postdoc"],
  [/\bphd/i, "predoc"],
]

/**
 * Card locations read "Vienna (Landbezirke) (AT)", "Hong Kong (HK)" or "Wenzhou, China";
 * the job page's "Abu Dhabi, United Arab Emirates" is preferred when it was fetched.
 */
function place(card: string, meta: Record<string, string>, ld: JobPosting | null) {
  const cardText = text(card.match(/lister__meta-item--location">([\s\S]*?)<\/li>/)?.[1]).replace(/\s*\/\s*(hybrid|remote)$/i, "")
  const code = cardText.match(/\(([A-Z]{2})\)$/)?.[1]
  const cardParts = cardText.replace(/\s*\([^)]*\)/g, "").split(/\s*,\s*/).filter(Boolean)
  const pageParts = (meta.LocationDescription ?? "")
    .replace(/\s*\/\s*(hybrid|remote)$/i, "")
    .split(/\s*,\s*/)
    .filter(Boolean)
  const country =
    findCountry(ld?.jobLocation?.[0]?.address?.addressCountry) ??
    findCountry(code) ??
    findCountry(pageParts.at(-1)) ??
    findCountry(cardParts.at(-1))
  const parts = pageParts.length > 1 ? pageParts : cardParts
  const city = parts.length > 1 || code ? parts[0] : null
  return { country, city: city && !findCountry(city) ? city : null }
}

function toDraft(id: string, card: string, disciplines: Discipline[], p: Posting | null): Draft | null {
  const path = cardPath(card)
  if (!path) return null
  const title = text(card.match(/<h3 class="lister__header">([\s\S]*?)<\/h3>/)?.[1]) || "Untitled position"
  // Discipline names can hold commas themselves ("Agriculture, Food & Forestry"), so this count runs high
  const terms = (p?.meta["Academic Discipline"] ?? "").split(",").map(clean).filter(Boolean)
  if (terms.length > MAX_DISCIPLINES && !OURS.test(title)) return null
  const employer = p?.ld?.hiringOrganization?.name ?? text(card.match(/lister__meta-item--recruiter">([\s\S]*?)<\/li>/)?.[1])
  const institution = employer ? tidyName(clean(employer)) : "Unknown institution"
  const { country, city } = place(card, p?.meta ?? {}, p?.ld ?? null)
  const types = (p?.meta["Job Type"] ?? "").split(",").map(clean).filter((t) => t && t !== "Academic Posts")
  const blocks = htmlToBlocks(p?.ld?.description ?? "")
  if (!blocks.length) {
    const teaser = text(card.match(/lister__description[^>]*>([\s\S]*?)<\/p>/)?.[1]).replace(/\s*\.{3}$/, "…")
    if (teaser) blocks.push({ t: "p", text: teaser })
  }
  const logo = p?.ld?.hiringOrganization?.logo ?? card.match(/class="lister__logo[^"]*" src="([^"]+)"/)?.[1]
  const salary = text(card.match(/lister__meta-item--salary">([\s\S]*?)<\/li>/)?.[1]) || p?.meta.SalaryDescription || null
  return {
    id: `thejobs-${id}`,
    source: "thejobs",
    url: `https://www.timeshighereducation.com${path}`,
    alsoOn: [],
    title,
    institution,
    department: null,
    category: classifyCategory({
      title,
      types,
      employer: institution,
      hint: TYPE_HINT.find(([re]) => types.some((t) => re.test(t)))?.[1],
    }),
    disciplines,
    positionTypes: types,
    fields: fieldsFromText(title),
    city: tidyPlace(city),
    admin: null,
    country: country?.name ?? "Unknown",
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: day(p?.ld?.datePosted),
    deadline: dayFromText(p?.closing) ?? day(p?.ld?.validThrough),
    summary: summarize(blocks),
    logoUrl: logo ? new URL(logo, "https://www.timeshighereducation.com").href : null,
    detail: {
      blocks,
      keywords: [...new Set(terms.filter((t) => OURS.test(t)))],
      salary,
      requirements: [],
      jel: [],
    },
  }
}
