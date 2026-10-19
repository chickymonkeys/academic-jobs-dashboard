import { CATEGORIES } from "@/domain/taxonomy"
import { useMode } from "@/lib/theme"
import { cn } from "@/lib/utils"

type Props = {
  counts: Record<string, number>
  active: string[]
  onToggle: (id: string) => void
  className?: string
}

/** The legend doubles as the position-type filter: click a key to isolate it */
export function Legend({ counts, active, onToggle, className }: Props) {
  const mode = useMode()
  return (
    <div className={cn("surface-float w-56 rounded-xl p-1.5 text-xs", className)} role="group" aria-label="Position types">
      <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium text-muted-foreground">Position type</div>
      {CATEGORIES.map((c) => {
        const on = active.length === 0 || active.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active.includes(c.id)}
            title={c.description}
            onClick={() => onToggle(c.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              !on && "opacity-45",
            )}
          >
            <span
              className="size-2.5 rounded-full ring-2 ring-[var(--glass)]"
              style={{ background: c.color[mode] }}
              aria-hidden
            />
            <span className="text-foreground">{c.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">{counts[c.id] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
