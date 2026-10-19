import type { SourceId, Vacancy } from "@/domain/vacancy"

/** Short tag for listing chips, and the full name for the Source filter */
const SOURCE_LABEL: Record<SourceId, { tag: string; name: string }> = {
  ejm: { tag: "EJM", name: "EconJobMarket (EJM)" },
  joe: { tag: "JOE", name: "AEA JOE" },
  jobsacuk: { tag: "jobs.ac.uk", name: "jobs.ac.uk" },
  thejobs: { tag: "THE", name: "Times Higher Education (THE)" },
  mur: { tag: "MUR", name: "Italian ministry calls (MUR)" },
  appam: { tag: "APPAM", name: "APPAM Career Connections" },
  ajo: { tag: "AJO", name: "Academic Jobs Online (AJO)" },
  academictransfer: { tag: "AcademicTransfer", name: "AcademicTransfer" },
  hej: { tag: "HEJ", name: "HigherEdJobs (HEJ)" },
}
export const sourceLabel = (s: SourceId) => SOURCE_LABEL[s].tag
export const sourceName = (s: SourceId) => SOURCE_LABEL[s].name

/** "EJM", "EJM and JOE", "EJM, JOE and AJO" */
export function sourceList(sources: SourceId[]) {
  const tags = [...new Set(sources)].map(sourceLabel)
  return tags.length > 1 ? `${tags.slice(0, -1).join(", ")} and ${tags.at(-1)}` : (tags[0] ?? "")
}

export function placeLabel(v: Pick<Vacancy, "city" | "admin" | "country" | "countryCode">) {
  const region = v.countryCode === "US" || v.countryCode === "CA" ? v.admin : v.country
  return [v.city, region].filter(Boolean).join(", ") || v.country
}

export function initials(institution: string) {
  return institution
    .replace(/\b(of|the|and|for|de|di|du|la|le|des|der|und)\b/gi, " ")
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ž]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}
