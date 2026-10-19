import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import { clean, htmlToBlocks, summarize, tidyPlace } from "../lib/text"
import { USER_AGENT, type Draft, type SourceAdapter } from "./types"

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
    const res = await fetch(`${BASE}/jobs`, { headers: { "User-Agent": USER_AGENT } })
    if (!res.ok) throw new Error(`APPAM HTTP ${res.status}`)
    const html = await res.text()
    const state = html.match(/<script id="[^"]*" type="application\/json">([\s\S]*?)<\/script>/)?.[1]
    if (!state) throw new Error("APPAM: no embedded results")
    // Angular escapes the JSON as &q; &a; &s; &l; &g;
    const json = state.replace(/&(q|a|s|l|g);/g, (_, c: string) => ({ q: '"', a: "&", s: "'", l: "<", g: ">" })[c]!)
    const data = JSON.parse(json) as Record<string, { items?: AppamJob[]; totalCount?: number }>
    const search = Object.entries(data).find(([k]) => k.includes("job/search"))?.[1]
    if (!search?.items) throw new Error("APPAM: no job search results in the page")
    return JSON.stringify({ fetchedAt: new Date().toISOString(), total: search.totalCount ?? search.items.length, items: search.items } satisfies Raw)
  },

  parse(raw) {
    return (JSON.parse(raw) as Raw).items.map(toDraft)
  },
}

const day = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().slice(0, 10) : null)
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
    deadline: day(job.applicationDeadline),
    summary: summarize(blocks),
    // Its logos are bare file names whose storage location the page doesn't expose
    logoUrl: null,
    detail: { blocks, keywords: [], salary, requirements: [], jel: [] },
  }
}
