import { findCountry } from "../../src/domain/geo"
import { fieldsFromText } from "../../src/domain/taxonomy"
import type { Block, Category, Discipline } from "../../src/domain/vacancy"
import { politeClient } from "../lib/http"
import { clean, summarize, tidyName, tidyPlace } from "../lib/text"
import type { Draft, SourceAdapter } from "./types"

/**
 * The Italian ministry's calls portal (run by Cineca), where Italian law has universities and research
 * bodies publish every recruitment call. It is what the ministry reposts to EURAXESS.
 */
const BASE = "https://bandi.mur.gov.it"

/** Call types: one search per list, open calls only, every field; ours are picked out by disciplinary code */
const LISTS: ReadonlyArray<{ key: string; url: string; role: string; category: Category }> = [
  ...(
    [
      ["82", "Tenure-track researcher (RTT)", "faculty"],
      ["22", "Tenure-track researcher (RTD-B)", "faculty"],
      ["21", "Fixed-term researcher (RTD-A)", "postdoc"],
      ["81", "Fixed-term researcher (RTD-A, PNRR)", "postdoc"],
    ] as const
  ).map(([qualifica, role, category]) => ({
    key: `jobs-${qualifica}`,
    url: `${BASE}/jobs.php/public/cercaJobs?jv_comp_status_id=2-3&bb_type_code=%25&idsettore=%25&idgsd24=%25&idqualifica=${qualifica}&azione=cerca`,
    role,
    category,
  })),
  {
    key: "profcalls",
    url: `${BASE}/profcalls.php/public/cercaJobs?jv_comp_status_id=2-3&bb_type_code=%25&idsettore=%25&idgsd24=%25&idqualifica=%25&azione=cerca`,
    role: "Professor",
    category: "faculty",
  },
  ...(
    [
      ["contrattidiricerca", "Research contract", "postdoc"],
      ["incarichipostdoc", "Post-doc position", "postdoc"],
      ["bandi", "Research grant (assegno di ricerca)", "postdoc"],
      ["incarichidiricerca", "Research assistant position", "predoc"],
    ] as const
  ).map(([section, role, category]) => ({
    key: section,
    url: `${BASE}/${section}.php/public/cercaFellowship?jf_comp_status_id=2-3&bb_type_code=%25&idarea=%25&idgsd24=%25&azione=cerca`,
    role,
    category,
  })),
]

/**
 * Disciplinary codes we list: the 2024 groups (ECON-01…) and their predecessors (SECS-P/01, 13/A1…),
 * each with the discipline, an English name for titles, and its JEL field when the code settles one.
 */
const CODES: ReadonlyArray<{ re: RegExp; discipline: Discipline; name: string; field?: string }> = [
  { re: /\bECON-01\b|SECS-P\/?01\b|\b13\/A1\b/, discipline: "econ", name: "Economics" },
  { re: /\bECON-02\b|SECS-P\/?02\b|\b13\/A2\b/, discipline: "econ", name: "Economic policy" },
  { re: /\bECON-03\b|SECS-P\/?03\b|\b13\/A3\b/, discipline: "econ", name: "Public finance", field: "H" },
  { re: /\bECON-04\b|SECS-P\/?06\b|\b13\/A4\b/, discipline: "econ", name: "Applied economics" },
  { re: /\bECON-05\b|SECS-P\/?05\b|\b13\/A5\b/, discipline: "econ", name: "Econometrics", field: "C" },
  { re: /\bECON-09\b|SECS-P\/?11\b|\b13\/B4\b/, discipline: "econ", name: "Finance", field: "G" },
  { re: /\bSTAT-02\b|SECS-S\/?03\b|\b13\/D2\b/, discipline: "econ", name: "Economic statistics", field: "C" },
  { re: /\bSTAT-04\b|SECS-S\/?06\b|\b13\/D4\b/, discipline: "econ", name: "Mathematical economics", field: "C" },
  { re: /\bSTEC-01\b|SECS-P\/?12\b|\b13\/C1\b/, discipline: "econ", name: "Economic history", field: "N" },
  { re: /\bAGRI-01\b|AGR\/?01\b|\b07\/A1\b/, discipline: "econ", name: "Agricultural economics", field: "Q" },
  { re: /\bGSPS-02\b|SPS\/?04\b|\b14\/A2\b/, discipline: "polsci", name: "Political science" },
]

/** Detail pages fetched per run; the rest wait for the next run */
const DETAIL_BUDGET = 120
/** Labels kept from a detail page: the call's own facts, not its contact people */
const DETAIL_KEYS = [
  "Titolo del progetto di ricerca in italiano",
  "Titolo del progetto di ricerca in inglese",
  "Descrizione sintetica in italiano",
  "Descrizione sintetica in inglese",
  "Descrizione del bando in italiano",
  "Descrizione del bando in inglese",
  "Campo principale della ricerca",
  "Sottocampo della ricerca",
  "Data del bando",
  "Data di scadenza del bando",
  "Organizzazione/Ente",
  "Nome dell'Ente finanziatore",
  "Facoltà/Dipartimento/Laboratorio di ricerca",
  "Città",
]

type Entry = { href: string; university: string; title: string; codes: string; deadline: string | null }
type Raw = {
  fetchedAt: string
  /** Each list's result markup, by list key */
  lists: Record<string, string>
  /** Detail-page facts by call path; null = page had none */
  details: Record<string, Record<string, string> | null>
}

export const murAdapter: SourceAdapter = {
  id: "mur",
  name: "MUR calls portal (Italy)",
  homepage: BASE,
  rawExt: "json",
  // New calls appear once a day or so; the lists are re-read twice a day
  refreshHours: 12,

  async fetchRaw(previous) {
    const get = politeClient(3000)
    const lists: Raw["lists"] = {}
    for (const list of LISTS) {
      const html = await get(list.url)
      const start = html.indexOf('id="hiddenresult"')
      if (start >= 0) lists[list.key] = html.slice(start, html.indexOf('id="Pagination"', start))
      else if (html.includes("Non sono presenti bandi")) lists[list.key] = ""
      else throw new Error(`MUR ${list.key}: result list not found`)
    }

    const before: Raw["details"] = previous ? ((JSON.parse(previous) as Raw).details ?? {}) : {}
    const details: Raw["details"] = {}
    let budget = DETAIL_BUDGET
    for (const html of Object.values(lists)) {
      for (const e of entries(html)) {
        if (!codeOf(e) || e.href in details) continue
        if (e.href in before) {
          details[e.href] = before[e.href]
          continue
        }
        if (budget-- <= 0) continue
        try {
          details[e.href] = detailFacts(await get(`${BASE}${e.href}`))
        } catch (err) {
          console.warn(`  MUR ${e.href}: ${(err as Error).message}`)
        }
      }
    }
    return JSON.stringify({ fetchedAt: new Date().toISOString(), lists, details } satisfies Raw)
  },

  parse(raw) {
    const { lists, details } = JSON.parse(raw) as Raw
    const out = new Map<string, Draft>()
    for (const list of LISTS) {
      for (const e of entries(lists[list.key] ?? "")) {
        const code = codeOf(e)
        if (!code || out.has(e.href)) continue
        out.set(e.href, toDraft(e, list, code, details[e.href] ?? null))
      }
    }
    return [...out.values()]
  },
}

const text = (html: string | null | undefined) => (html ? clean(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")) : "")
const italianDay = (s: string | null | undefined) => {
  const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** "scade il 19/10/2026 …", "Univ. CHIETI-PESCARA", "Titolo: <a href=…>…</a>", "S.S.D. Economia politica ECON-01/A" */
function entries(html: string): Entry[] {
  const out: Entry[] = []
  for (const m of html.matchAll(/<p>\s*<em[^>]*>([\s\S]*?)<\/em>([\s\S]*?)<\/p>/g)) {
    const link = m[2].match(/<a href="([^"]+)">([\s\S]*?)<\/a>/)
    if (!link) continue
    out.push({
      href: link[1],
      title: text(link[2]),
      university: text(m[2].match(/<strong>([\s\S]*?)<\/strong>/)?.[1]),
      codes: text(m[2].slice(m[2].indexOf("</a>")).match(/<strong>([\s\S]*?)<\/strong>/)?.[1]),
      deadline: italianDay(m[1]),
    })
  }
  return out
}

/** The listed code a call names, in its code line or (failing that) its title */
const codeOf = (e: Entry) => CODES.find((c) => c.re.test(e.codes)) ?? (e.codes ? undefined : CODES.find((c) => c.re.test(e.title)))

function detailFacts(html: string): Record<string, string> | null {
  const facts: Record<string, string> = {}
  for (const m of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    const key = text(m[1])
    if (DETAIL_KEYS.includes(key) && !(key in facts)) facts[key] = text(m[2])
  }
  return Object.keys(facts).length ? facts : null
}

/** The portal's short host names: "Univ. CHIETI-PESCARA" → "Università Chieti-Pescara" */
const portalName = (s: string) =>
  s
    .replace(/^Univ\.\s*/i, "Università ")
    .replace(/\p{Lu}{3,}/gu, (w) => w[0] + w.slice(1).toLowerCase())
    .trim()

const nameWords = (s: string) =>
  new Set(
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 4 && !/^(univ|universit|degli|studi|della|politecnico|scuola|istituto)/.test(w)),
  )
/** "Bocconi University" and "Univ. Bocconi MILANO" share "bocconi"; the European Commission shares nothing */
function sameBody(a: string, b: string) {
  const wa = nameWords(a)
  return [...nameWords(b)].some((w) => wa.has(w))
}

/** Titles that only restate the procedure or the code are not worth repeating after the role */
const BOILERPLATE =
  /concorso|competition|selezione|selection|procedura|procedure|bando|call for|reclutamento|recruitment|\b\d{2}\/[A-Z]{4}-\d{2}\b|^\d+\s|\bart\.|\bRT[TD]\b|tenure.track|permanent position/i

function toDraft(e: Entry, list: (typeof LISTS)[number], code: (typeof CODES)[number], facts: Record<string, string> | null): Draft {
  const f = facts ?? {}
  const project = f["Titolo del progetto di ricerca in inglese"] || f["Titolo del progetto di ricerca in italiano"] || e.title
  const role =
    list.key === "profcalls"
      ? /prima fascia/i.test(e.title)
        ? "Full professor"
        : /seconda fascia/i.test(e.title)
          ? "Associate professor"
          : "Professor"
      : list.role
  // "Economia Politica" for an ECON-01 call says nothing the code doesn't
  const restates = project.toLowerCase() === code.name.toLowerCase() || e.codes.toLowerCase().includes(project.toLowerCase())
  const substantive = project.length >= 8 && !restates && !BOILERPLATE.test(project)
  const short = project.length <= 110
  const title = `${role} in ${code.name}${substantive && short ? `: ${tidyName(project)}` : ""}`

  const blocks: Block[] = []
  const add = (t: Block["t"], s: string | undefined) => s && blocks.push({ t, text: s })
  if (substantive && !short) add("p", tidyName(project))
  add("p", f["Descrizione sintetica in inglese"] || f["Descrizione sintetica in italiano"])
  add("p", f["Descrizione del bando in inglese"] || f["Descrizione del bando in italiano"])
  add("p", `Disciplinary code: ${e.codes || code.name}.`)

  // Fellowship pages name the funder, which is the host unless it's someone else (the European Commission…)
  const org = f["Organizzazione/Ente"] || f["Nome dell'Ente finanziatore"]
  const hosted = !!org && sameBody(org, e.university)
  const institution = hosted ? tidyName(org) : portalName(e.university)
  const department = f["Facoltà/Dipartimento/Laboratorio di ricerca"]
  const fields = [
    ...new Set([...(code.field ? [code.field] : []), ...fieldsFromText(title).filter((x) => x !== "any")]),
  ]
  const italy = findCountry("IT")
  return {
    // Job and fellowship calls are numbered separately: "/jobs.php/…/152785" → "mur-jobs-152785"
    id: `mur-${e.href.match(/^\/(\w+)\.php/)?.[1]}-${e.href.match(/(\d+)\/?$/)?.[1]}`,
    source: "mur",
    url: `${BASE}${e.href}`,
    alsoOn: [],
    title,
    institution,
    department: department ? tidyName(department) : null,
    category: list.category,
    disciplines: [code.discipline],
    positionTypes: [role],
    fields: fields.length ? fields : ["any"],
    city: hosted ? tidyPlace(f["Città"]) : null,
    admin: null,
    country: italy?.name ?? "Italy",
    countryCode: "IT",
    lat: null,
    lng: null,
    geoPrecision: null,
    postedAt: italianDay(f["Data del bando"]),
    deadline: e.deadline ?? italianDay(f["Data di scadenza del bando"]),
    summary: summarize(blocks),
    logoUrl: null,
    detail: {
      blocks,
      keywords: [e.codes, f["Sottocampo della ricerca"]].filter((k): k is string => !!k),
      salary: null,
      requirements: [],
      jel: [],
    },
  }
}
