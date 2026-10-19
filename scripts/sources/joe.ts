import { XMLParser } from "fast-xml-parser"
import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromJel } from "../../src/domain/taxonomy"
import { clean, extractRequirements, summarize, textToBlocks, tidyPlace } from "../lib/text"
import { USER_AGENT, type Draft, type SourceAdapter } from "./types"

const BASE = "https://www.aeaweb.org/joe"

type JoeLocation = { country?: string; state?: string; city?: string }
type JoeJel = { jc_code?: string; jc_description?: string }
type JoePosition = {
  "@_jp_id": string
  jp_section?: string
  jp_title?: string
  jp_institution?: string
  jp_division?: string
  jp_department?: string
  jp_salary_range?: string
  jp_application_deadline?: string
  jp_full_text?: string
  jp_keywords?: string
  locations?: { location?: JoeLocation[] } | string
  JEL_Classifications?: { jel_class?: JoeJel[] } | string
}
type JoeIssue = { "@_joe_issue_ID": string; position?: JoePosition[] }
type JoeYear = { "@_joe_year_ID": string; issue?: JoeIssue[] }

const ARRAYS = new Set(["year", "issue", "position", "location", "jel_class"])

export const joeAdapter: SourceAdapter = {
  id: "joe",
  name: "AEA Job Openings for Economists",
  homepage: `${BASE}/listings`,
  rawExt: "xml",

  async fetchRaw() {
    // The listings page embeds the export link for the current set of active listings.
    const page = await fetch(`${BASE}/listings`, { headers: { "User-Agent": USER_AGENT } })
    if (!page.ok) throw new Error(`JOE listings HTTP ${page.status}`)
    const q = (await page.text()).match(/resultset_output\.php\?mode=full_xml&(?:amp;)?q=([^"&]+)/)?.[1]
    if (!q) throw new Error("JOE export link not found on listings page")
    const res = await fetch(`${BASE}/resultset_output.php?mode=full_xml&q=${q}`, {
      headers: { "User-Agent": USER_AGENT },
    })
    if (!res.ok) throw new Error(`JOE export HTTP ${res.status}`)
    return res.text()
  },

  parse(raw) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false,
      parseAttributeValue: false,
      isArray: (name) => ARRAYS.has(name),
    })
    const doc = parser.parse(raw) as { JOE_EXPORT?: { year?: JoeYear[] } }
    const out: Draft[] = []
    for (const year of doc.JOE_EXPORT?.year ?? []) {
      for (const issue of year.issue ?? []) {
        for (const p of issue.position ?? []) out.push(toDraft(p, year["@_joe_year_ID"], issue["@_joe_issue_ID"]))
      }
    }
    return out
  },
}

function toDraft(p: JoePosition, year: string, issue: string): Draft {
  const jpId = p["@_jp_id"]
  const loc = (typeof p.locations === "object" ? p.locations.location?.[0] : undefined) ?? {}
  const country = findCountry(loc.country)
  const jel = (typeof p.JEL_Classifications === "object" ? p.JEL_Classifications.jel_class ?? [] : [])
    .map((j) => ({ code: clean(j.jc_code ?? ""), label: clean(j.jc_description ?? "") }))
    .filter((j) => j.code)
  const section = clean(p.jp_section ?? "")
  const title = clean(p.jp_title ?? "Untitled position")
  const { blocks, requirements } = extractRequirements(textToBlocks(p.jp_full_text ?? ""))
  const deadline = p.jp_application_deadline?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  const department = clean(p.jp_department || p.jp_division || "")
  return {
    id: `joe-${jpId}`,
    source: "joe",
    url: `${BASE}/listing.php?JOE_ID=${year}-${issue.padStart(2, "0")}_${jpId}`,
    alsoOn: [],
    title,
    institution: clean(p.jp_institution ?? "Unknown institution"),
    department: department || null,
    category: classifyCategory({ title, types: [], section }),
    disciplines: ["econ"],
    positionTypes: section ? [section.replace(/^(US|International):\s*/, "")] : [],
    fields: fieldsFromJel(jel.map((j) => j.code)),
    city: tidyPlace(loc.city),
    admin: tidyPlace(loc.state),
    country: country?.name ?? tidyPlace(loc.country) ?? "Unknown",
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: null,
    deadline,
    summary: summarize(blocks),
    logoUrl: null,
    detail: {
      blocks,
      keywords: (p.jp_keywords ?? "").split("\n").map(clean).filter(Boolean),
      salary: clean(p.jp_salary_range ?? "") || null,
      requirements,
      jel: jel.filter((j) => !j.code.startsWith("0") && j.code.length > 1),
    },
  }
}
