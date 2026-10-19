import type { SourceId, Vacancy } from "@/domain/vacancy"

const SOURCE_LABEL: Record<SourceId, string> = { ejm: "EJM", joe: "JOE" }
export const sourceLabel = (s: SourceId) => SOURCE_LABEL[s]

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
