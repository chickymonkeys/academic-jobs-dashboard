import type { Category, Vacancy } from "@/domain/vacancy"

export type Counts = Record<Category, number>

/** What the map tooltip shows: one listing, or a breakdown of a place / cluster */
export type Tip = { x: number; y: number } & (
  | { kind: "point"; v: Vacancy }
  | { kind: "group"; count: number; breakdown: Counts; names: string[]; where: string; hint: string; approx?: "city" | "country" }
)
