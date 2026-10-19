import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import type { Discipline } from "../../src/domain/vacancy"
import { politeClient } from "../lib/http"
import { clean, htmlToBlocks, summarize, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

const BASE = "https://www.academictransfer.com"
/**
 * Its search pages render only their first ten results (the rest load from an API that robots.txt
 * closes), so the vacancy sitemap is the index. A job page is opened only when its slug looks like one
 * of ours, then kept or dropped on the research field the page states.
 */
const CANDIDATE = /econom|econometr|banking|politic|politiek|polic(y|ies)|governance|public-admin|bestuurskunde|beleidswetenschap/
/** Job pages fetched per run at its requested 10 s spacing (about five minutes); the rest wait for the next run */
const POSTING_BUDGET = 30
/** AcademicTransfer research fields ("Economics", "Political sciences", …) and the discipline each stands for */
const FIELD_DISCIPLINE: ReadonlyArray<[RegExp, Discipline]> = [
  [/econom/i, "econ"],
  [/politic/i, "polsci"],
  [/public admin|governance|policy/i, "policy"],
]

const DUTCH_NAME = /^(Universiteit|Hogeschool|Rijksuniversiteit)\b/

type JobPosting = {
  title?: string
  description?: string
  datePosted?: string
  validThrough?: string
  occupationalCategory?: string
  baseSalary?: { currency?: string; value?: { unitText?: string; minValue?: number; maxValue?: number } } | null
  hiringOrganization?: { name?: string; logo?: string }
  jobLocation?: { address?: { addressLocality?: string; addressCountry?: string } }
}
type Raw = {
  fetchedAt: string
  /** Candidate job URLs by vacancy id */
  urls: Record<string, string>
  /** Each candidate's schema.org JobPosting; null = page had none */
  postings: Record<string, JobPosting | null>
}

export const academicTransferAdapter: SourceAdapter = {
  id: "academictransfer",
  name: "AcademicTransfer",
  homepage: `${BASE}/en/jobs/`,
  rawExt: "json",
  refreshHours: 12,

  async fetchRaw(previous) {
    const get = politeClient(10_000)
    const sitemap = await get(`${BASE}/sitemap-vacancies.xml`, "application/xml")
    if (!sitemap.includes("<loc>")) throw new Error("AcademicTransfer: empty vacancy sitemap")
    const urls: Raw["urls"] = {}
    for (const [, url, lang, id, slug] of sitemap.matchAll(/<loc>(https:\/\/[^<]+\/(en|nl)\/jobs\/(\d+)\/([^/<]+)\/)<\/loc>/g)) {
      // Prefer the English page when a vacancy is listed in both languages
      if (CANDIDATE.test(slug) && (!urls[id] || lang === "en")) urls[id] = url
    }

    const before: Raw["postings"] = previous ? ((JSON.parse(previous) as Raw).postings ?? {}) : {}
    const postings: Raw["postings"] = {}
    let budget = POSTING_BUDGET
    for (const [id, url] of Object.entries(urls)) {
      if (id in before) {
        postings[id] = before[id]
        continue
      }
      if (budget-- <= 0) continue
      try {
        postings[id] = jobPosting(await get(url))
      } catch (e) {
        console.warn(`  AcademicTransfer ${id}: ${(e as Error).message}`)
      }
    }
    return JSON.stringify({ fetchedAt: new Date().toISOString(), urls, postings } satisfies Raw)
  },

  // Some employers post each vacancy twice, once per language ("Utrecht University", "Universiteit Utrecht"):
  // same title, deadline and city is one position, listed under its English name
  parse(raw) {
    const { urls, postings } = JSON.parse(raw) as Raw
    const byKey = new Map<string, Draft>()
    for (const [id, url] of Object.entries(urls)) {
      const d = toDraft(id, url, postings[id] ?? null)
      if (!d) continue
      const key = `${d.title.toLowerCase()}|${d.deadline}|${d.city}`
      const seen = byKey.get(key)
      if (!seen || (DUTCH_NAME.test(seen.institution) && !DUTCH_NAME.test(d.institution))) byKey.set(key, d)
    }
    return [...byKey.values()]
  },
}

/** The JobPosting is the `mainEntity` of the page's WebPage block */
function jobPosting(html: string): JobPosting | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as { "@type"?: string; mainEntity?: { "@type"?: string } }
      const posting = data["@type"] === "JobPosting" ? data : data.mainEntity
      if (posting?.["@type"] !== "JobPosting") continue
      const { title, description, datePosted, validThrough, occupationalCategory, baseSalary, hiringOrganization, jobLocation } =
        posting as JobPosting
      return { title, description, datePosted, validThrough, occupationalCategory, baseSalary, hiringOrganization, jobLocation }
    } catch {
      /* not the block we want */
    }
  }
  return null
}

const day = (iso: string | undefined) => iso?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null

function salaryText(s: JobPosting["baseSalary"]) {
  const v = s?.value
  if (!v?.minValue) return null
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })
  const unit = { MONTH: "a month", YEAR: "a year", HOUR: "an hour" }[v.unitText ?? ""] ?? ""
  const sign = s?.currency === "EUR" ? "€" : s?.currency ? `${s.currency} ` : ""
  const range = v.maxValue && v.maxValue !== v.minValue ? `${fmt(v.minValue)}–${fmt(v.maxValue)}` : fmt(v.minValue)
  return `${sign}${range} ${unit}`.trim()
}

function toDraft(id: string, url: string, p: JobPosting | null): Draft | null {
  if (!p) return null
  const disciplines = FIELD_DISCIPLINE.filter(([re]) => re.test(p.occupationalCategory ?? "")).map(([, d]) => d)
  if (!disciplines.length) return null
  const title = clean(p.title ?? "") || "Untitled position"
  const institution = clean(p.hiringOrganization?.name ?? "") || "Unknown institution"
  const address = p.jobLocation?.address
  const country = findCountry(address?.addressCountry) ?? findCountry("NL")
  const blocks = htmlToBlocks(p.description ?? "")
  return {
    id: `academictransfer-${id}`,
    source: "academictransfer",
    url,
    alsoOn: [],
    title,
    institution,
    department: null,
    category: classifyCategory({ title, types: [], employer: institution }),
    disciplines,
    positionTypes: [],
    fields: fieldsFromText(title),
    city: tidyPlace(address?.addressLocality),
    admin: null,
    country: country?.name ?? "Netherlands",
    countryCode: country?.iso2 ?? "NL",
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: day(p.datePosted),
    deadline: day(p.validThrough),
    summary: summarize(blocks),
    logoUrl: p.hiringOrganization?.logo ?? null,
    detail: {
      blocks,
      keywords: p.occupationalCategory ? [p.occupationalCategory] : [],
      salary: salaryText(p.baseSalary),
      requirements: [],
      jel: [],
    },
  }
}
