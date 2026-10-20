import type { DeadlineKind } from "../../src/domain/vacancy"

/**
 * The true deadline of a posting, read from its own words.
 *
 * Boards file a posting under one date, and it is often not the one that matters: JOE's and EJM's
 * deadline fields frequently hold the date the listing comes down ("2027-03-01") while the text says
 * "review of applications will begin November 13" or "applications received by November 15 will receive
 * full consideration". Some boards give no date at all although the text names one.
 *
 * Every dated phrase is classified by the cue nearest before it in its sentence (review begins, full or
 * priority consideration, hard deadline, final close, extension), dates about something else (start
 * dates, interviews, letters, funding periods) are dropped, and the result is reconciled with the
 * board's own date:
 *
 *   deadline   the earliest date to apply by: a review start, a full-consideration date or a deadline
 *   closesAt   a later date until which applications are still taken
 *   rolling    applications are reviewed on a rolling basis or until the position is filled
 */

export type DeadlineFacts = {
  deadline: string | null
  deadlineKind: DeadlineKind | null
  closesAt: string | null
  rolling: boolean
}

type Cue = "review" | "priority" | "deadline" | "final" | "extended"
export type Found = { date: string; cue: Cue; optional: boolean; sentence: string }

const MONTH_NAMES: ReadonlyArray<[number, string]> = [
  [1, "jan(?:uary)?|janvier|januar|januari|gennaio|enero"],
  [2, "feb(?:ruary)?|février|fevrier|februar|februari|febbraio|febrero"],
  [3, "mar(?:ch)?|mars|märz|maerz|maart|marzo"],
  [4, "apr(?:il)?|avril|aprile|abril"],
  [5, "may|mai|mei|maggio|mayo"],
  [6, "june?|juin|juni|giugno|junio"],
  [7, "july?|juillet|juli|luglio|julio"],
  [8, "aug(?:ust)?|août|aout|augustus|agosto"],
  [9, "sep(?:t(?:ember)?)?|septembre|settembre|septiembre"],
  [10, "oct(?:ober)?|octobre|oktober|ottobre|octubre"],
  [11, "nov(?:ember)?|novembre|noviembre"],
  [12, "dec(?:ember)?|décembre|decembre|dezember|dicembre|diciembre"],
]
const MONTH = `(${MONTH_NAMES.map(([, re]) => re).join("|")})\\.?`
function monthOf(s: string) {
  // "3 may be considered": the verb, not the month
  if (s === "may" || s === "mar") return 0
  const w = s.toLowerCase()
  return MONTH_NAMES.find(([, re]) => new RegExp(`^(?:${re})$`).test(w))?.[0] ?? 0
}

type Ymd = [year: number | null, month: number, day: number]
type Reading = (m: RegExpMatchArray, usOrder: boolean) => Ymd[]
const ORD = "(?:st|nd|rd|th|er|\\.)?"
/** Each pattern with the reading of its groups */
const DATE_PATTERNS: ReadonlyArray<[RegExp, Reading]> = [
  // November 15, 2026 · Nov. 15th 2026 · November 15
  [new RegExp(`\\b${MONTH}\\s+(\\d{1,2})${ORD}(?:,?\\s*(\\d{4}))?(?![\\d:])`, "giu"), (m) => [[m[3] ? +m[3] : null, monthOf(m[1]), +m[2]]]],
  // 15 November 2026 · 15th of November, 2026 · 15. November · 1er décembre 2026
  [
    new RegExp(`\\b(\\d{1,2})${ORD}\\s*(?:of\\s+|de\\s+)?${MONTH}(?:,?\\s+(?:de\\s+)?(\\d{4}))?\\b`, "giu"),
    (m) => [[m[3] ? +m[3] : null, monthOf(m[2]), +m[1]]],
  ],
  // 2026 November 01
  [new RegExp(`\\b(20\\d{2})\\s+${MONTH}\\s+(\\d{1,2})\\b`, "giu"), (m) => [[+m[1], monthOf(m[2]), +m[3]]]],
  // 2026-11-15
  [/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (m) => [[+m[1], +m[2], +m[3]]]],
  // 15.11.2026: day first
  [/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g, (m) => [[+m[3], +m[2], +m[1]]]],
  // 11/15/2026 · 15/11/26: month first in North America, unless the numbers say otherwise (or the board's date does)
  [
    /\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/g,
    (m, usOrder) => {
      const [a, b] = [+m[1], +m[2]]
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
      if (a > 12 || b > 12) return [a > 12 ? [y, b, a] : [y, a, b]]
      return usOrder ? [[y, a, b], [y, b, a]] : [[y, b, a], [y, a, b]]
    },
  ],
]

// Cues, matched in the clause before a date: the one ending nearest the date classifies it.
const REVIEW =
  /\breview(?:ing|s)?\b[^.;]{0,70}?\b(?:begin|begins|began|start|starts|commenc\w*|starting|beginning|from|on|after|as of)\b(?:\s+(?:on|by|in|from|after|around|approximately))?|\bnot be (?:reviewed|considered) (?:before|until|prior to)\b|\b(?:begin|start|commenc)\w*\s+(?:to\s+)?(?:review|consider|screen|evaluat|assess)\w*(?:\s+(?:of\s+)?(?:applications?|files|candidates|applicants))?|\breviewed\b[^.;]{0,40}?\b(?:starting|beginning|from|after|as of|on or after)\b|\bnext review date\b|\b(?:first|initial) (?:review|screening)\b(?:[^.;]{0,40}?\b(?:on|for|by|from|begins?|starts?|after|targeted)\b)?|\bscreening\b[^.;]{0,30}\b(?:begin|begins|start|starts|commenc\w*)\b|\bconsideration of (?:applications|candidates)\b[^.;]{0,30}\bcommenc\w*\b|\breview date\b/gi
const PRIORITY =
  /\bfull(?:est)? (?:consideration|review)\b|\bpriorit\w*\b|\bpreference\b|\bpreferred (?:deadline|date)\b|\bensure (?:full )?consideration\b|\bguarantee\w*\b|\b(?:optimal|best|first) consideration\b|\bencourage[sd]?\b[^.;]{0,30}?\bto (?:apply|submit)\b|\brecommend(?:s|ed)?\b|\bmain timeline\b|\bpreferabl[ey]\b|\b(?:strongly|highly) (?:encouraged|recommended)\b|\bfirst round\b|\binitial (?:deadline|cut-?off)\b|\bearly (?:deadline|application)\b|\bwill be considered first\b/gi
const EXTENDED = /\bextended\b|\bnew deadline\b|\bpostponed\b|\bverlängert\b|\bprorogat\w*\b/gi
const FINAL =
  /\bfinal (?:application )?(?:deadline|date|closing)\b|\bapplications? (?:will |shall )?close[sd]?\b|\b(?:closes?|closing) on\b|\badvertising closes\b|\b(?:accepted|considered|received|open|reviewed|apply|continue\w*) (?:until|through|till)\b|\buntil\b|\bcloses?\s*:/gi
const DEADLINE =
  /\bdeadline\b|\bclosing date\b|\bdue\b|\bmust (?:be )?(?:received|submitted|submit|apply|reach)\b|\bno later than\b|\b(?:apply|submi\w*|send|upload\w*|receiv\w*|applications?|materials|dossiers?|documents)\b[^.;]{0,150}?\b(?:by|before|on or before|prior to|not later than)\b|\breceipt of applications\b|\bscadenza\b|\bentro (?:il|le)\b|\bbewerbungs(?:frist|schluss)\b|\bbis (?:zum|spätestens)\b|\bdate limite\b|\bavant le\b|\bplazo\b|\bhasta el\b|\buiterlijk\b|\bsluitingsdatum\b|\bclosing\b|\bclose\b|\bexpir\w*\b|\bLINK\s+(?:by|before|no later than)\b/gi
/** A date about something other than applying: the post's start, interviews, letters, funding, a degree */
const OTHER =
  /\bstart(?:s|ing)?\b|\bcommenc\w+\s+(?:on|in|employment|work|duties)\b|\bto commence\b|\bappointment\b|\bemployment\b|\beffective\b|\bavailable\b|\bcontract\b|\bfund(?:ing|ed)\b|\binterview\w*\b|\bconference\b|\bmeetings?\b|\bASSA\b|\bworkshop\b|\bwebinar\b|\binformation session\b|\bopen day\b|\bdegree\b|\bph\.?d\.?\b|\bdoctorate\b|\bdissertation\b|\bdefen[cs]e\b|\bgraduat\w*\b|\bconferred\b|\bposted\b|\bpublished\b|\bopening date\b|\bportal opens\b|\bopens\b|\bnotif\w*\b|\bdecisions?\b|\bannounce\w*\b|\boffers?\b|\bterm\b|\bsemester\b|\bacademic year\b|\bduration\b|\bperiod\b|\bends?\b|\bended\b|\bsalary\b|\bborn\b|\bjob talks?\b|\bvisit\w*\b|\bfly-?outs?\b|\bheld\b|\bvalid\b|\byears?'? (?:of )?(?:full-time |part-time |research |postdoctoral |post-?ph\.?d\.? )*(?:research|experience)\b|\bexperience\b|\beligib\w*|\bwho have completed\b/gi
/** Letters' own deadline: "Deadline for recommendation letters:", "Reference letters should arrive by" */
const LETTERS =
  /\b(?:deadline|due date)s? for (?:the |all |your )?(?:recommendation |reference )?letters\b|(?:^|[.;:]\s*|\b(?:the|your|all)\s+)(?:(?:recommendation|reference) )?letters?(?: of (?:recommendation|reference))?\s+(?:should|must|are|need|have to|will need to|can|may)\b[^.;]{0,60}$|\breferees?\b[^.;]{0,40}$/gi
const CUES: ReadonlyArray<[Cue | "other", RegExp]> = [
  ["review", REVIEW],
  ["priority", PRIORITY],
  ["final", FINAL],
  ["deadline", DEADLINE],
  ["other", OTHER],
  ["other", LETTERS],
]

/** Words that tie a phrase to the application: one after an "other" cue keeps the date */
const APPLICATION =
  /\bappl(?:y|ying|ied|ications?|icants?)\b|\bsubmi\w*|\bmaterials\b|\bdossiers?\b|\bcandida\w*|\bnominations?\b|\breview\w*|\bconsider\w*|\bdeadline\b|\bclos\w*|\bdue\b|\breceiv\w*|\bscadenza\b|\bbewerbung\w*/gi

const ROLLING =
  /\buntil (?:the |all |a )?(?:positions?|posts?|vacanc\w+|roles?|search|job|it|they)?\s*(?:is |are |has been |have been )?(?:filled|completed?|concluded|closed)\b|\buntil filled\b|\brolling\b|\bon an ongoing basis\b|\bcontinu\w+ until (?:the )?(?:position|post|search)\b|\b(?:open|remain open) until (?:the position|filled)\b|\buntil a suitable candidate\b/i

/** A date offered on a condition ("If you would like to start early…", "For candidates following the AEA timeline…") */
const CONDITIONAL =
  /^(?:if\b|for (?:applicants|candidates|those|students|anyone)\b|(?:applicants|candidates) (?:who|that) (?:wish|would like|plan|want|are attending)|(?:applicants|candidates) with an? \w+|those (?:who|wishing))|\b(?:will|may) also be considered\b/i

/** "Applications may be submitted before October 1": a permission, not a deadline */
const PERMISSIVE = /\b(?:may|can) (?:already )?(?:be )?(?:submit\w*|sen[dt]|appl\w*)\b[^.;]{0,30}\b(?:before|prior to)\s+(?:the\s+)?$/i

/** Sentence breaks; "Nov. 15" and "U.S. Department" stay whole often enough, a capital after ". " splits */
const SENTENCES = /(?<=[.!?;])\s+(?=["“(]?[A-Z])|\n+/

function lastEnd(re: RegExp, s: string): number {
  let end = -1
  for (const m of s.matchAll(re)) end = Math.max(end, (m.index ?? 0) + m[0].length)
  return end
}

/** Where the cue nearest the end of `s` starts: the words leading into the next date */
function cueStart(s: string): number {
  let end = -1
  let start = s.length
  for (const [, re] of CUES)
    for (const m of s.matchAll(re)) {
      const e = (m.index ?? 0) + m[0].length
      if (e > end || (e === end && (m.index ?? 0) < start)) [end, start] = [e, m.index ?? 0]
    }
  return end >= 0 && end >= s.trimEnd().length - 4 ? start : s.length
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const valid = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 && new Date(Date.UTC(y, m - 1, d)).getUTCMonth() === m - 1
const shift = (day: string, days: number) => new Date(Date.parse(day) + days * 86_400_000).toISOString().slice(0, 10)
const between = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000

function sentences(text: string): string[] {
  const out: string[] = []
  let carry = ""
  // A link's dots would end a clause: "…at https://apply.interfolio.com/189148 by September 13"
  const plain = text.replace(/\b(?:https?:\/\/|www\.)[^\s)]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "LINK")
  for (const raw of plain.split(SENTENCES)) {
    const s = raw.replace(/\s+/g, " ").trim()
    if (!s) continue
    // A label on its own line ("Closing date:", "Application deadline") belongs to the line after it
    if (s.length <= 60 && (s.endsWith(":") || /\b(deadline|closing date|due|closes)$/i.test(s))) {
      carry += `${s.replace(/:?$/, ":")} `
      continue
    }
    out.push(carry + s)
    carry = ""
  }
  if (carry) out.push(carry.trim())
  return out
}

/**
 * Every application date a posting's text names. `ref` (when it was posted, or first seen) dates the
 * phrases that leave out the year: "November 15" is the first November 15 from two months before it on.
 */
export function findDates(
  text: string,
  opts: { ref: string; usOrder: boolean; listed?: string | null },
): { found: Found[]; rolling: boolean } {
  const found: Found[] = []
  const floor = shift(opts.ref, -60)
  const refYear = +opts.ref.slice(0, 4)
  for (const sentence of sentences(text)) {
    const spans: Array<{ at: number; end: number; date: string }> = []
    for (const [re, read] of DATE_PATTERNS) {
      for (const m of sentence.matchAll(re)) {
        const at = m.index ?? 0
        if (spans.some((s) => at < s.end && at + m[0].length > s.at)) continue
        const readings = read(m, opts.usOrder)
          .map(([y, mo, d]) =>
            y != null
              ? valid(y, mo, d)
                ? iso(y, mo, d)
                : null
              : ([refYear - 1, refYear, refYear + 1].map((yy) => (valid(yy, mo, d) ? iso(yy, mo, d) : "")).find((x) => x >= floor) ?? null),
          )
          .filter((x): x is string => !!x)
        const date = readings.find((x) => opts.listed && between(x, opts.listed) <= 3) ?? readings[0]
        if (date) spans.push({ at, end: at + m[0].length, date })
      }
    }
    spans.sort((a, b) => a.at - b.at)
    const optional = CONDITIONAL.test(sentence)
    let prevEnd = 0
    spans.forEach((s, i) => {
      // The clause leading up to this date, back to the date before it (with a little overlap) or the sentence
      // start, and the words after it up to where the next date's own cue begins
      const left = sentence.slice(Math.max(0, prevEnd - 40), s.at)
      const after = sentence.slice(s.end, spans[i + 1]?.at ?? sentence.length)
      prevEnd = s.end
      const cue = classify(left, spans[i + 1] ? after.slice(0, cueStart(after)) : after)
      if (cue) found.push({ date: s.date, cue, optional, sentence })
    })
  }
  return { found, rolling: ROLLING.test(text) }
}

function classify(left: string, right: string): Cue | null {
  // "…extended the deadline to February 1": the extension is what counts, however near "deadline" sits
  if (lastEnd(EXTENDED, left) >= 0) return "extended"
  if (PERMISSIVE.test(left)) return null
  let best: Cue | "other" | null = null
  let at = -1
  for (const [cue, re] of CUES) {
    const end = lastEnd(re, left)
    if (end > at) {
      at = end
      best = cue
    }
  }
  if (best === "other") return null
  // "…an anticipated start date no later than October 1": a cue about something else just before, with no word
  // about applying after it, makes the deadline-sounding words its own. ("Reviewed starting" is one cue, ending at the same place.)
  const otherAt = lastEnd(OTHER, left)
  if (otherAt >= 0 && otherAt < at && at - otherAt <= 60 && otherAt > lastEnd(APPLICATION, left)) return null
  if (best == null) {
    // "November 15 is the deadline", "15 January 2027 (closing date)"
    if (/^\W{0,4}(?:\(|is\b|will be\b|as\b)[^.;]{0,30}\b(?:deadline|closing date|due date|final date)\b/i.test(right)) return "deadline"
    return null
  }
  // "Applications received by November 15 will receive full consideration"
  if (best === "deadline" && (lastEnd(PRIORITY, left) >= 0 || lastEnd(PRIORITY, right) >= 0)) return "priority"
  return best
}

/**
 * Reconciles the dates a posting's text names with the date its board lists (`listed`). `ref` is when it
 * was posted (or first seen), `usOrder` whether numeric dates read month first.
 */
export function resolveDeadline(input: { text: string; listed: string | null; ref: string; usOrder: boolean }): DeadlineFacts {
  const { found: all, rolling } = findDates(input.text, input)
  // Dates far off the posting's own time are leftovers of an earlier round, or not deadlines at all
  const sane = all.filter((f) => f.date >= shift(input.ref, -400) && f.date <= shift(input.ref, 550))
  const latestExtension = sane.filter((f) => f.cue === "extended").map((f) => f.date).sort().at(-1) ?? null
  const live = sane.filter((f) => !latestExtension || f.date >= latestExtension)

  let listed = input.listed
  if (listed && latestExtension && listed < latestExtension) listed = null
  // A board's date within a few days of one the text gives is the same date (time zones, "by the 15th" vs the 16th)
  if (listed && live.some((f) => between(f.date, listed!) <= 3)) listed = null

  const first = pick(live.filter((f) => !f.optional), listed) ?? pick(live, null)
  if (!first) return { deadline: null, deadlineKind: null, closesAt: null, rolling }

  // A later date applications are still taken until: the text's last hard date, or the board's when the text
  // has none. A board date past the text's last hard date is when the listing comes down, not a deadline.
  const hard = live.filter((f) => f.cue === "deadline" || f.cue === "final" || f.cue === "extended").map((f) => f.date)
  const lastHard = hard.sort().at(-1) ?? null
  const later = [...hard, ...(listed && (!lastHard || listed <= lastHard) ? [listed] : [])].filter((d) => d > first.date).sort()
  return { deadline: first.date, deadlineKind: first.kind, closesAt: later.at(-1) ?? null, rolling }
}

/**
 * The date to apply by. A full-consideration date beats a review start before it (everything in by then
 * is read), and a review start beats a hard deadline after it (the search is under way by then); a hard
 * deadline earlier than either comes first. With no date in the text, the board's date stands.
 */
function pick(found: Found[], listed: string | null): { date: string; kind: DeadlineKind } | null {
  const earliest = (cues: Cue[]) =>
    found
      .filter((f) => cues.includes(f.cue))
      .map((f) => f.date)
      .sort()[0]
  const hard = earliest(["deadline", "final", "extended"])
  const priority = earliest(["priority"])
  const review = earliest(["review"])
  const lead = priority ? { date: priority, kind: "priority" as const } : review ? { date: review, kind: "review" as const } : null
  if (lead && (!hard || lead.date <= hard)) return lead
  if (hard) return { date: hard, kind: "deadline" }
  return listed ? { date: listed, kind: "deadline" } : null
}
