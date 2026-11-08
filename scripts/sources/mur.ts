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
      ["doctorate", "PhD position", "predoc"],
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
type Code = (typeof CODES)[number]

/**
 * Whole areas, for calls that name no group (PhD rounds, some research contracts): a call open to all of
 * area 13 or 14 is open to economics or political science among the rest
 */
const AREAS: Record<string, Code> = {
  "13": { re: /^13 - /, discipline: "econ", name: "Economics and statistics" },
  "14": { re: /^14 - /, discipline: "polsci", name: "Political and social sciences" },
}
/** What a call open to several of our codes is in, by discipline */
const DISCIPLINE_NAMES: Record<Code["discipline"], string> = {
  econ: "Economics",
  polsci: "Political science",
  policy: "Public policy",
}
/** A call open to more areas than this (of 14) is a university's whole PhD round, not one in our fields */
const MAX_AREAS = 6

/** Detail pages fetched per run; the rest wait for the next run */
const DETAIL_BUDGET = 120
/** Detail rows naming the call's disciplines: its groups (13/ECON-01), sectors (ECON-01/A) or areas (13 - …) */
const CODE_ROWS = /^(G\.S\.D\.?|S\.S\.D\.?|Settore Concorsuale)$/i
/** Where the codes a detail page names are kept among its facts, "; "-separated */
const CODES_FACT = "codes"
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

/** `codes`: every code line the list gives the call, one per post, "; "-separated */
type Entry = { href: string; university: string; title: string; codes: string; deadline: string | null }
type Facts = Record<string, string>
type Raw = {
  fetchedAt: string
  /** Each list's result markup, by list key */
  lists: Record<string, string>
  /**
   * Detail-page facts by call path, for our calls and for calls whose list line names no code (for those
   * that turn out not to be ours, only the codes, or {} when the page names none). null, found in older
   * payloads, is a page that held no facts at all: it is read again.
   */
  details: Record<string, Facts | null>
}

export const murAdapter: SourceAdapter = {
  id: "mur",
  name: "MUR calls portal (Italy)",
  homepage: BASE,
  rawExt: "json",
  // New calls appear once a day or so; the lists are re-read twice a day
  refreshHours: 12,

  /**
   * Each list is its own search, and the portal's gateway gives up on a heavy one (HTTP 504 after 60 s) while
   * the others still answer: a list that fails is carried over from the previous payload, so it doesn't
   * take the other lists down with it. Only when every list fails does the whole source fall back.
   */
  async fetchRaw(previous, degraded) {
    const get = politeClient(3000)
    const prior = previous ? (JSON.parse(previous) as Raw) : null
    const lists: Raw["lists"] = {}
    const failed: Array<{ role: string; error: string }> = []
    for (const list of LISTS) {
      try {
        lists[list.key] = resultList(
          await get(list.url, { check: (html) => (resultList(html) == null ? "result list not found" : null) }),
        )!
      } catch (e) {
        failed.push({ role: list.role, error: (e as Error).message })
        // A list never read before stays empty until the portal answers
        lists[list.key] = prior?.lists[list.key] ?? ""
      }
    }
    if (failed.length === LISTS.length) throw new Error(failed[0].error)
    if (failed.length) {
      degraded(`${failed.length} of ${LISTS.length} call lists (${failed.map((f) => f.role).join("; ")}): ${failed[0].error}`)
    }

    // Detail pages: our calls' first, then those of calls whose list line names no code, to find out whether
    // they are ours (the page names the call's group, sector or area). Pages read before are carried over.
    const before: Raw["details"] = prior?.details ?? {}
    const details: Raw["details"] = {}
    const seen = new Set<string>()
    const ours: Entry[] = []
    const unsure: Entry[] = []
    for (const html of Object.values(lists)) {
      for (const e of entries(html)) {
        if (seen.has(e.href)) continue
        seen.add(e.href)
        const known = codesOf(e).length > 0
        // A list line that names codes, none of them ours, settles it
        if (!known && e.codes) continue
        const kept = before[e.href]
        if (kept) details[e.href] = kept
        else (known ? ours : unsure).push(e)
      }
    }
    for (const e of [...ours, ...unsure].slice(0, DETAIL_BUDGET)) {
      try {
        const facts = detailFacts(await get(`${BASE}${e.href}`))
        // A page with no facts at all is not the call's (an error or maintenance page served as 200): kept, it
        // would settle the call for good, so it is left for the next run to read again
        if (!facts) {
          console.warn(`  MUR ${e.href}: no call details on the page; read again next run`)
          continue
        }
        // A call that isn't ours keeps only the codes that say so
        details[e.href] = codesOf(e, facts).length ? facts : facts[CODES_FACT] ? { [CODES_FACT]: facts[CODES_FACT] } : {}
      } catch (err) {
        console.warn(`  MUR ${e.href}: ${(err as Error).message}`)
      }
    }
    return JSON.stringify({ fetchedAt: new Date().toISOString(), lists, details } satisfies Raw)
  },

  parse(raw) {
    const { lists, details } = JSON.parse(raw) as Raw
    const out = new Map<string, Draft>()
    for (const list of LISTS) {
      for (const e of entries(lists[list.key] ?? "")) {
        if (out.has(e.href)) continue
        const facts = details[e.href] ?? null
        const codes = codesOf(e, facts)
        if (codes.length) out.set(e.href, toDraft(e, list, codes, facts))
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

/** A search page's result markup, "" when it says there are no open calls, null when it is neither */
function resultList(html: string): string | null {
  const start = html.indexOf('id="hiddenresult"')
  if (start >= 0) return html.slice(start, html.indexOf('id="Pagination"', start))
  return html.includes("Non sono presenti bandi") ? "" : null
}

/**
 * "scade il 19/10/2026 …", "Univ. CHIETI-PESCARA", "Titolo: <a href=…>…</a>", then a code line per post
 * ("S.S.D. Economia politica ECON-01/A"): a call for several posts lists each one's
 */
function entries(html: string): Entry[] {
  const out: Entry[] = []
  for (const m of html.matchAll(/<p>\s*<em[^>]*>([\s\S]*?)<\/em>([\s\S]*?)<\/p>/g)) {
    const link = m[2].match(/<a href="([^"]+)">([\s\S]*?)<\/a>/)
    if (!link) continue
    const codes = [...m[2].slice(m[2].indexOf("</a>")).matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((s) => text(s[1]))
    out.push({
      href: link[1],
      title: text(link[2]),
      university: text(m[2].match(/<strong>([\s\S]*?)<\/strong>/)?.[1]),
      codes: codes.filter(Boolean).join("; "),
      deadline: italianDay(m[1]),
    })
  }
  return out
}

/**
 * The listed codes a call names: in its list line (one per post), failing that in its title, failing that
 * on its detail page, as groups or sectors, and as whole areas (13, 14) when it names no more than a few.
 * A page can name groups for one curriculum and a whole area for another: an area counts for a discipline
 * that no group already covers.
 */
function codesOf(e: Entry, facts?: Facts | null): Code[] {
  const named = (s: string | undefined) => (s ? CODES.filter((c) => c.re.test(s)) : [])
  if (e.codes) return named(e.codes)
  const inTitle = named(e.title)
  if (inTitle.length) return inTitle
  const detail = facts?.[CODES_FACT]
  if (!detail) return []
  const listed = named(detail)
  const lines = detail.split("; ")
  // A whole university's round, open to (nearly) every area, is in none of ours in particular
  if (lines.filter((l) => /^\d{2} - /.test(l)).length > MAX_AREAS) return listed
  const areas = Object.values(AREAS).filter(
    (a) => !listed.some((c) => c.discipline === a.discipline) && lines.some((l) => a.re.test(l)),
  )
  return [...listed, ...areas]
}

/** The call's own facts, and the codes it names ("13/ECON-01 - ECONOMIA POLITICA; 13 - Scienze economiche…") */
export function detailFacts(html: string): Facts | null {
  const facts: Facts = {}
  const codes: string[] = []
  for (const m of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    const key = text(m[1])
    const value = text(m[2])
    if (CODE_ROWS.test(key)) {
      if (value && value !== "-" && !codes.includes(value)) codes.push(value)
    } else if (DETAIL_KEYS.includes(key) && !(key in facts)) facts[key] = value
  }
  if (codes.length) facts[CODES_FACT] = codes.join("; ")
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

function toDraft(e: Entry, list: (typeof LISTS)[number], codes: Code[], facts: Facts | null): Draft {
  const f = facts ?? {}
  // A call open to several of our codes (a PhD round, a call for several posts) is named by discipline, and
  // carries each code's discipline and field
  const code = codes[0]
  const disciplines = [...new Set(codes.map((c) => c.discipline))]
  const subject =
    codes.length === 1 ? code.name : disciplines.map((d, i) => (i ? DISCIPLINE_NAMES[d].toLowerCase() : DISCIPLINE_NAMES[d])).join(" and ")
  const named = e.codes || f[CODES_FACT] || ""
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
  const restates = project.toLowerCase() === subject.toLowerCase() || named.toLowerCase().includes(project.toLowerCase())
  const substantive = project.length >= 8 && !restates && !BOILERPLATE.test(project)
  const short = project.length <= 110
  const title = `${role} in ${subject}${substantive && short ? `: ${tidyName(project)}` : ""}`

  const blocks: Block[] = []
  const add = (t: Block["t"], s: string | undefined) => s && blocks.push({ t, text: s })
  if (substantive && !short) add("p", tidyName(project))
  add("p", f["Descrizione sintetica in inglese"] || f["Descrizione sintetica in italiano"])
  add("p", f["Descrizione del bando in inglese"] || f["Descrizione del bando in italiano"])
  add("p", `Disciplinary code${named.includes("; ") ? "s" : ""}: ${named || subject}.`)

  // Fellowship pages name the funder, which is the host unless it's someone else (the European Commission…)
  const org = f["Organizzazione/Ente"] || f["Nome dell'Ente finanziatore"]
  const hosted = !!org && sameBody(org, e.university)
  const institution = hosted ? tidyName(org) : portalName(e.university)
  const department = f["Facoltà/Dipartimento/Laboratorio di ricerca"]
  const fields = [
    ...new Set([...codes.flatMap((c) => (c.field ? [c.field] : [])), ...fieldsFromText(title).filter((x) => x !== "any")]),
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
    disciplines,
    positionTypes: [role],
    fields: fields.length ? fields : ["any"],
    // A host on two campuses gives both ("Bergamo - Dalmine"): the first is the one a geocoder can find
    city: hosted ? tidyPlace(f["Città"]?.split(/\s+-\s+/)[0]) : null,
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
      keywords: [named, f["Sottocampo della ricerca"]].filter((k): k is string => !!k),
      salary: null,
      requirements: [],
      jel: [],
    },
  }
}
