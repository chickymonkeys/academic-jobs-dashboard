import type { SortKey } from "@/features/filters/filtering"

/** The list's orders: a long label for menus, a short one for the button that shows the current order */
export const SORTS: ReadonlyArray<{ id: SortKey; label: string; short: string; hint: string; icon: string }> = [
  {
    id: "deadline",
    label: "Deadline, soonest first",
    short: "Deadline",
    hint: "Grouped by the next 7 days, 3 weeks, then month",
    icon: "i-lucide-calendar-clock",
  },
  { id: "newest", label: "Newest first", short: "Newest", hint: "Most recently posted at the top", icon: "i-lucide-sparkles" },
  { id: "az", label: "Institution A–Z", short: "A–Z", hint: "Alphabetical by institution", icon: "i-lucide-arrow-down-a-z" },
  { id: "relevance", label: "Best match", short: "Best match", hint: "Closest to your search first", icon: "i-lucide-search" },
]

export const sortById = (id: SortKey) => SORTS.find((s) => s.id === id) ?? SORTS[0]!
