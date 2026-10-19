import type { Block } from "../../src/domain/vacancy"

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•", euro: "€", pound: "£",
  eacute: "é", egrave: "è", ecirc: "ê", aacute: "á", agrave: "à", acirc: "â", iacute: "í", oacute: "ó",
  ocirc: "ô", uacute: "ú", ntilde: "ñ", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
}

/** Decodes HTML entities; runs twice because JOE double-escapes (`&amp;amp;`) */
export function decodeEntities(input: string): string {
  let s = input
  for (let i = 0; i < 2; i++) {
    const next = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m
      }
      return NAMED[e.toLowerCase()] ?? m
    })
    if (next === s) break
    s = next
  }
  return s
}

export const clean = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim()

/** HTML → safe structural blocks. The UI renders blocks as React text, so no markup ever reaches the DOM. */
export function htmlToBlocks(html: string): Block[] {
  const marked = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<p[^>]*>\s*<(strong|b)>([^<]{2,90})<\/\2>\s*<\/p>/gi, "\n\u0001H$2\n")
    .replace(/<h[1-6][^>]*>/gi, "\n\u0001H")
    .replace(/<li[^>]*>/gi, "\n\u0001L")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|table|section)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
  const out: Block[] = []
  for (const raw of marked.split("\n")) {
    let t: Block["t"] = "p"
    let line = raw
    if (line.startsWith("\u0001H")) {
      t = "h"
      line = line.slice(2)
    } else if (line.startsWith("\u0001L")) {
      t = "li"
      line = line.slice(2)
    }
    const text = clean(line)
    if (text) out.push({ t, text: t === "h" ? text.replace(/:$/, "") : text })
  }
  return out
}

/** Plain text (JOE) → blocks, recovering headings ("Foo:") and the short-line lists that follow them */
export function textToBlocks(text: string): Block[] {
  const lines = decodeEntities(text).replace(/\r/g, "").split("\n")
  const out: Block[] = []
  let para: string[] = []
  let inList = false
  const flush = () => {
    if (para.length) out.push({ t: "p", text: clean(para.join(" ")) })
    para = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      inList = false
      continue
    }
    const bullet = /^([-•*·▪●]|\d+[.)])\s+/.exec(line)
    if (bullet) {
      flush()
      out.push({ t: "li", text: clean(line.slice(bullet[0].length)) })
      continue
    }
    if (line.length <= 70 && line.endsWith(":")) {
      flush()
      out.push({ t: "h", text: clean(line.slice(0, -1)) })
      inList = true
      continue
    }
    if (inList && line.length <= 90 && !/[.!?]$/.test(line)) {
      out.push({ t: "li", text: clean(line) })
      continue
    }
    inList = false
    para.push(line)
  }
  flush()
  return out
}

/** Pulls the "Application Requirements" list out of the body into its own checklist */
export function extractRequirements(blocks: Block[]): { blocks: Block[]; requirements: string[] } {
  const idx = blocks.findIndex((b) => b.t === "h" && /application requirements?/i.test(b.text))
  if (idx < 0) return { blocks, requirements: [] }
  let end = idx + 1
  while (end < blocks.length && blocks[end].t === "li") end++
  const requirements = blocks.slice(idx + 1, end).map((b) => b.text)
  return { blocks: [...blocks.slice(0, idx), ...blocks.slice(end)], requirements }
}

export function summarize(blocks: Block[], max = 240): string {
  const text = blocks
    .filter((b) => b.t === "p")
    .map((b) => b.text)
    .join(" ")
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…"
}

export function normName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bthe\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** JOE ships cities in UPPERCASE; render them as names */
export function tidyPlace(s: string | null | undefined): string | null {
  const t = s ? clean(s) : ""
  if (!t) return null
  // Keep mixed case and short codes ("CA", "NSW") as published
  if (t !== t.toUpperCase() || t.length <= 3) return t
  return t.toLowerCase().replace(/(^|[\s\-'.(/])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
}

const STOP = new Set(
  "a an and at for in of on the to with position positions open rank department economics economic professor faculty".split(" "),
)
export function titleTokens(s: string): Set<string> {
  return new Set(normName(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)))
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}
