import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import { politeClient } from "../lib/http"
import { clean, htmlToBlocks, summarize, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

/** APPAM Career Connections, the public policy association's job board (an mcjobboard.net site) */
const BASE = "https://appam.mcjobboard.net"

type AppamJob = {
  id: number
  title: string
  employerName?: string | null
  employerAddressCity?: string | null
  employerAddressState?: string | null
  employerAddressCountry?: string | null
  description?: string | null
  salaryFrom?: number | null
  salaryTo?: number | null
  /** 5 = a year */
  salaryTypeId?: number | null
  applicationDeadline?: number | null
  postedDate?: number | null
  remote?: boolean
  industryTypes?: Array<{ name: string }>
}
type Raw = { fetchedAt: string; total: number; items: AppamJob[] }

export const appamAdapter: SourceAdapter = {
  id: "appam",
  name: "APPAM Career Connections",
  homepage: `${BASE}/jobs`,
  rawExt: "json",

  /**
   * The board is an Angular app whose server render embeds the first page of results (25 listings, newest
   * and featured first) as transfer state. Later pages come from its API, which robots.txt closes, so a
   * board longer than that is read in part.
   */
  async fetchRaw() {
    // A single request; the client brings retries, a timeout and the check that the page was rendered in full
    const html = await politeClient(0)(`${BASE}/jobs`, {
      check: (page) => (embeddedResults(page) ? null : "no job search results in the page"),
    })
    const { items, totalCount } = embeddedResults(html)!
    return JSON.stringify({ fetchedAt: new Date().toISOString(), total: totalCount ?? items.length, items } satisfies Raw)
  },

  parse(raw) {
    return (JSON.parse(raw) as Raw).items.map(toDraft)
  },
}

/** The job search the server render embeds as transfer state, or null when the page came back without it */
function embeddedResults(html: string): { items: AppamJob[]; totalCount?: number } | null {
  const state = html.match(/<script id="[^"]*" type="application\/json">([\s\S]*?)<\/script>/)?.[1]
  if (!state) return null
  // Angular escapes the JSON as &q; &a; &s; &l; &g;
  const json = state.replace(/&(q|a|s|l|g);/g, (_, c: string) => ({ q: '"', a: "&", s: "'", l: "<", g: ">" })[c]!)
  try {
    const data = JSON.parse(json) as Record<string, { items?: AppamJob[]; totalCount?: number }>
    const search = Object.entries(data).find(([k]) => k.includes("job/search"))?.[1]
    return search?.items ? { items: search.items, totalCount: search.totalCount } : null
  } catch {
    return null
  }
}

const day = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().slice(0, 10) : null)
/** Deadlines are the employer's local midnight (05:00 UTC in New York, 16:00 UTC the day before in Hong Kong): the nearest UTC day is the one meant */
const deadlineDay = (ms: number | null | undefined) => (ms ? day(ms + 12 * 3_600_000) : null)
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })

function toDraft(job: AppamJob): Draft {
  const title = clean(job.title) || "Untitled position"
  const institution = clean(job.employerName ?? "") || "Unknown institution"
  const country = findCountry(clean(job.employerAddressCountry ?? "").replace(/\s*\(the\)$/i, "")) ?? findCountry("US")
  const industries = (job.industryTypes ?? []).map((t) => t.name)
  const blocks = htmlToBlocks(job.description ?? "")
  const us = country?.iso2 === "US"
  const salary =
    job.salaryTypeId === 5 && job.salaryFrom
      ? `${us ? "$" : ""}${money(job.salaryFrom)}${job.salaryTo && job.salaryTo !== job.salaryFrom ? `–${money(job.salaryTo)}` : ""} a year`
      : null
  return {
    id: `appam-${job.id}`,
    source: "appam",
    url: `${BASE}/jobs/${job.id}`,
    alsoOn: [],
    title,
    institution,
    department: null,
    category: classifyCategory({
      title,
      types: [],
      employer: institution,
      // Government, non-profit and think-tank posts are the board's non-academic side
      hint: industries.length && !industries.includes("Academic") ? "nonacademic" : null,
    }),
    disciplines: ["policy"],
    positionTypes: industries,
    fields: fieldsFromText(title),
    city: tidyPlace(job.employerAddressCity),
    admin: us || country?.iso2 === "CA" ? clean(job.employerAddressState ?? "") || null : null,
    country: country?.name ?? "Unknown",
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: day(job.postedDate),
    deadline: deadlineDay(job.applicationDeadline),
    summary: summarize(blocks),
    // Its logos are bare file names whose storage location the page doesn't expose
    logoUrl: null,
    detail: { blocks, keywords: [], salary, requirements: [], jel: [] },
  }
}
