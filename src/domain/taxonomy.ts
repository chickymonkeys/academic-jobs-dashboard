import type { Category } from "./vacancy"

/**
 * Position categories. Colors are the validated categorical palette, slots 1–5 in fixed order
 * (blue, orange, aqua, yellow, magenta) — the order is what keeps adjacent hues CVD-separable.
 */
export const CATEGORIES: ReadonlyArray<{
  id: Category
  label: string
  description: string
  color: { light: string; dark: string }
}> = [
  {
    id: "faculty",
    label: "Faculty",
    description: "Tenure-track & permanent faculty",
    color: { light: "#2a78d6", dark: "#3987e5" },
  },
  {
    id: "postdoc",
    label: "Postdoc",
    description: "Postdocs & research fellowships",
    color: { light: "#eb6834", dark: "#d95926" },
  },
  {
    id: "teaching",
    label: "Visiting & teaching",
    description: "Visiting, teaching, adjunct & fixed-term",
    color: { light: "#1baf7a", dark: "#199e70" },
  },
  {
    id: "nonacademic",
    label: "Non-academic",
    description: "Government, central banks, industry & consulting",
    color: { light: "#eda100", dark: "#c98500" },
  },
  {
    id: "predoc",
    label: "Pre-doc & PhD",
    description: "Research assistants, pre-docs & PhD positions",
    color: { light: "#e87ba4", dark: "#d55181" },
  },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  Category,
  (typeof CATEGORIES)[number]
>

/** Field taxonomy: JEL top-level letters with short, scannable labels */
export const FIELDS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "any", label: "Any field" },
  { id: "D", label: "Microeconomics" },
  { id: "E", label: "Macro & monetary" },
  { id: "C", label: "Econometrics & methods" },
  { id: "G", label: "Finance" },
  { id: "J", label: "Labor" },
  { id: "L", label: "Industrial organization" },
  { id: "H", label: "Public" },
  { id: "F", label: "International" },
  { id: "I", label: "Health, education & welfare" },
  { id: "O", label: "Development & growth" },
  { id: "Q", label: "Environment, energy & agri" },
  { id: "R", label: "Urban & regional" },
  { id: "K", label: "Law & economics" },
  { id: "P", label: "Political economy" },
  { id: "M", label: "Business & management" },
  { id: "N", label: "Economic history" },
  { id: "A", label: "General & teaching" },
  { id: "B", label: "History of thought" },
  { id: "Z", label: "Other topics" },
]
export const FIELD_LABEL: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f.id, f.label]))

const EJM_CATEGORY_TO_JEL: Record<string, string[]> = {
  "any field": ["any"],
  econometrics: ["C"],
  statistics: ["C"],
  "computational economics": ["C"],
  "experimental economics": ["C", "D"],
  "operations research": ["C"],
  "microeconomic theory": ["D"],
  "applied microeconomics": ["D"],
  "behavioral economics": ["D"],
  "decision sciences": ["D"],
  "macroeconomics; monetary": ["E"],
  "international finance/macro": ["F", "E"],
  "international trade": ["F"],
  finance: ["G"],
  "public economics": ["H"],
  "health; education; welfare": ["I"],
  "labor; demographic economics": ["J"],
  "law and economics": ["K"],
  "industrial organization": ["L"],
  "business economics": ["M"],
  marketing: ["M"],
  accounting: ["M"],
  "organizational behavior": ["M"],
  "management, general": ["M"],
  "management, information technology": ["M"],
  "economic history": ["N"],
  "development; growth": ["O"],
  "political economy": ["P"],
  "environmental; energy; ag. econ": ["Q"],
  "urban; rural; regional economics": ["R"],
  "real estate": ["R"],
  other: ["Z"],
}

const uniq = (xs: string[]) => [...new Set(xs)]

export function fieldsFromEjm(categories: string[]): string[] {
  const out = categories.flatMap((c) => EJM_CATEGORY_TO_JEL[c.trim().toLowerCase()] ?? [])
  return out.length ? uniq(out) : ["any"]
}

export function fieldsFromJel(codes: string[]): string[] {
  const out = codes.map((code) => {
    const c = code.trim().toUpperCase()
    if (!c || c.startsWith("0")) return "any"
    const letter = c[0]
    return letter === "Y" ? "Z" : letter
  })
  return out.length ? uniq(out) : ["any"]
}

/** Map heterogeneous source signals (title, position types, JOE section) onto one category */
export function classifyCategory(input: { title: string; types: string[]; section?: string | null }): Category {
  const title = input.title.toLowerCase()
  const section = (input.section ?? "").toLowerCase()
  const types = input.types.map((t) => t.toLowerCase())

  if (/\bpre-?doc|predoctoral|research assistant|\bph\.?d\.? (student|candidate|position|scholarship)|doctoral (student|candidate|researcher|position)/.test(title))
    return "predoc"
  if (/post-?doc|postdoctoral|research fellow|fellowship/.test(title)) return "postdoc"
  if (section.includes("nonacademic")) return "nonacademic"
  if (/visiting|adjunct|instructor|teaching (professor|fellow|faculty|track|stream)|fixed[- ]term|temporary|clinical|professor of (the )?practice|non-tenure/.test(title))
    return "teaching"
  if (section.includes("other academic")) return "teaching"
  if (section.includes("full-time academic")) return "faculty"

  if (types.some((t) => !t.startsWith("visiting") && /professor|lecturer/.test(t))) return "faculty"
  if (types.some((t) => t.startsWith("visiting"))) return "teaching"
  if (types.some((t) => t.includes("postdoctoral"))) return "postdoc"
  if (types.some((t) => /research assistant|doctoral/.test(t))) return "predoc"
  if (types.some((t) => /nonacademic|consultant/.test(t))) return "nonacademic"
  if (types.some((t) => t.includes("other academic"))) return "teaching"
  if (/economist|analyst|consult|central bank|federal reserve/.test(title)) return "nonacademic"
  return "faculty"
}
