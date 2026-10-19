import { Globe } from "lucide-react"
import { WORLD_REGIONS } from "@/domain/geo"
import type { RegionId } from "@/domain/vacancy"
import { cn } from "@/lib/utils"

type Props = {
  counts: Partial<Record<RegionId, number>>
  total: number
  active: string | null
  onSelect: (id: RegionId | "world") => void
  className?: string
}

/** One-tap geographic jumps — the fastest way across a world map */
export function RegionNav({ counts, total, active, onSelect, className }: Props) {
  const chip = (id: RegionId | "world", label: React.ReactNode, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active === id}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        "text-foreground/80 hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active === id && "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active === id ? "text-primary-foreground/75" : "text-muted-foreground")}>
        {count}
      </span>
    </button>
  )
  return (
    <nav
      aria-label="Jump to region"
      className={cn(
        "flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]",
        className,
      )}
    >
      {chip(
        "world",
        <>
          <Globe className="size-3.5" aria-hidden /> World
        </>,
        total,
      )}
      {WORLD_REGIONS.map((r) => chip(r.id, r.short, counts[r.id] ?? 0))}
    </nav>
  )
}
