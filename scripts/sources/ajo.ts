import { XMLParser } from "fast-xml-parser"
import { findCountry } from "../../src/domain/geo"
import { classifyCategory, fieldsFromText } from "../../src/domain/taxonomy"
import type { Block, Discipline } from "../../src/domain/vacancy"
import { clean, dayFromText, decodeEntities, summarize, textToBlocks, tidyPlace } from "../lib/text"
import { USER_AGENT, type Draft, type SourceAdapter } from "./types"

const BASE = "https://academicjobsonline.org/ajo"
/** Every open listing, all disciplines; ours are picked out by each item's discipline list */
const FEED = `${BASE}?joblist-0-0-0-----rss--`
const ECON = /econom|financ/i
/** AJO's own discipline names ("Political Science", "Government", "Public Policy", "Urban policy") */
const DISCIPLINE_OF: ReadonlyArray<[RegExp, Discipline]> = [
  [ECON, "econ"],
  [/politic|government|international relations/i, "polsci"],
  [/polic(y|ies)|public admin/i, "policy"],
]

type AjoItem = {
  title?: string
  description?: string
  "ads:ID"?: string
  "ads:Univ"?: string
  "ads:Dept"?: string
  "ads:City"?: string
  "ads:State"?: string
  "ads:Country"?: string
  "ads:Deadline"?: string
  "ads:PostDate"?: string
  "ads:Disciplines"?: string
}

export const ajoAdapter: SourceAdapter = {
  id: "ajo",
  name: "Academic Jobs Online",
  homepage: BASE,
  rawExt: "xml",

  async fetchRaw() {
    const res = await fetch(FEED, { headers: { "User-Agent": USER_AGENT } })
    if (!res.ok) throw new Error(`AJO feed HTTP ${res.status}`)
    return res.text()
  },

  parse(raw) {
    const parser = new XMLParser({ parseTagValue: false, isArray: (name) => name === "item" })
    const doc = parser.parse(raw) as { "rdf:RDF"?: { item?: AjoItem[] } }
    return (doc["rdf:RDF"]?.item ?? []).map(toDraft).filter((d): d is Draft => d != null)
  },
}

/** Short lines standing alone ("Overview", "Qualifications") are the posting's own section headings */
const headings = (blocks: Block[]) =>
  blocks.map((b): Block => (b.t === "p" && b.text.length <= 40 && !/[.!?,;:]$/.test(b.text) ? { t: "h", text: b.text } : b))

const STOP = new Set("of the and for at in on de di du des la le und y".split(" "))
const titleCase = (line: string) => line.split(/\s+/).every((w) => !/^[a-z]/.test(w) || STOP.has(w))
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/**
 * Bodies often open with a letterhead before the first sentence: "[IMAGE]", the title (sometimes wrapped),
 * the institution, "Location: … Open Date: …". Drop leading lines while they look like that.
 */
function dropLetterhead(body: string, title: string, univ: string): string {
  const lines = body.split("\n")
  let i = 0
  for (; i < Math.min(lines.length, 10); i++) {
    const line = clean(lines[i])
    const letterhead =
      !line ||
      /^(\[image\]|location:|open date:|deadline:)/i.test(line) ||
      (line.length >= 8 && norm(title).includes(norm(line))) ||
      // …unless the next line carries on its sentence ("…at Stanford University / invites applications")
      (titleCase(line) &&
        !/^[a-z]/.test(clean(lines[i + 1] ?? "")) &&
        (line.length <= 40 || (!!univ && norm(line).includes(norm(univ)))))
    if (!letterhead) break
  }
  return lines.slice(i).join("\n")
}

/** Some institutions' names reach the feed as UTF-8 read as Latin-1 ("KoÃ§"); undo that */
const unmangle = (s: string) => (/[ÃÂ][\u0080-\u00bf]/.test(s) ? Buffer.from(s, "latin1").toString("utf8") : s)

function toDraft(item: AjoItem): Draft | null {
  const id = clean(item["ads:ID"] ?? "")
  const title = unmangle(clean(item.title ?? ""))
  const disciplines = clean(item["ads:Disciplines"] ?? "").split(/\s*;\s*/).filter(Boolean)
  const ours = DISCIPLINE_OF.filter(([re]) => disciplines.some((d) => re.test(d))).map(([, id]) => id)
  if (/\beconom/i.test(title) && !ours.includes("econ")) ours.unshift("econ")
  if (!id || !ours.length) return null

  const univ = unmangle(clean(item["ads:Univ"] ?? ""))
  const body = unmangle(decodeEntities(item.description ?? ""))
  const blocks = headings(textToBlocks(dropLetterhead(body, title, univ)))
  const country = findCountry(item["ads:Country"])
  const city = clean(item["ads:City"] ?? "") || null
  const state = clean(item["ads:State"] ?? "") || null
  return {
    id: `ajo-${id}`,
    source: "ajo",
    url: `${BASE}/jobs/${id}`,
    alsoOn: [],
    title: title || "Untitled position",
    institution: univ || "Unknown institution",
    department: clean(item["ads:Dept"] ?? "") || null,
    category: classifyCategory({ title, types: [], employer: univ }),
    disciplines: ours,
    positionTypes: [],
    fields: fieldsFromText(title, disciplines.filter((d) => ECON.test(d)).join(" ")),
    // Some listings name only a state or emirate ("Doha"): use it as the place
    city: tidyPlace(city ?? state),
    admin: city ? tidyPlace(state) : null,
    country: country?.name ?? (clean(item["ads:Country"] ?? "") || "Unknown"),
    countryCode: country?.iso2 ?? null,
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: dayFromText(item["ads:PostDate"]),
    deadline: dayFromText(item["ads:Deadline"]),
    summary: summarize(blocks),
    logoUrl: null,
    detail: { blocks, keywords: disciplines, salary: null, requirements: [], jel: [] },
  }
}
