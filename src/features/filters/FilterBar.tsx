import type { ComponentProps, ReactNode } from "react"
import { ChevronDown, Sparkles, Star, X } from "lucide-react"
import { CATEGORIES, FIELDS } from "@/domain/taxonomy"
import { list, toggleIn, type AppSearch, type useAppSearch } from "@/app/search"
import { sourceLabel } from "@/components/job-atoms"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { useMode } from "@/lib/theme"
import { cn } from "@/lib/utils"
import type { facetCounts } from "./filtering"

type SetSearch = ReturnType<typeof useAppSearch>[1]
type Facets = ReturnType<typeof facetCounts>

export function Chip({ active, className, children, ...props }: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-background/70 text-foreground/80 hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

type Option = { id: string; label: string; count: number; adornment?: ReactNode }

function FacetChip(props: {
  label: string
  options: Option[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
  searchable?: boolean
}) {
  const { label, options, selected, onToggle, onClear, searchable } = props
  const active = selected.length > 0
  const first = options.find((o) => o.id === selected[0])?.label
  const summary = !active ? label : selected.length === 1 ? first : `${label} · ${selected.length}`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Chip active={active} aria-label={`${label} filter`}>
          <span className="max-w-[140px] truncate">{summary}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Chip>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          {searchable && <CommandInput placeholder={`Find ${label.toLowerCase()}…`} />}
          <CommandList className="max-h-80">
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = selected.includes(o.id)
                return (
                  <CommandItem
                    key={o.id}
                    value={o.label}
                    onSelect={() => onToggle(o.id)}
                    className={cn(!on && o.count === 0 && "opacity-50")}
                  >
                    <Checkbox checked={on} className="pointer-events-none" tabIndex={-1} aria-hidden />
                    {o.adornment}
                    <span className="truncate">{o.label}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{o.count}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          {active && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onClear}>
                Clear {label.toLowerCase()}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const DEADLINES: Array<{ id: AppSearch["dl"]; label: string }> = [
  { id: undefined, label: "Any deadline" },
  { id: "week", label: "Closing within 7 days" },
  { id: "month", label: "Closing within 30 days" },
  { id: "none", label: "Open until filled" },
]

function DeadlineChip({ search, set }: { search: AppSearch; set: SetSearch }) {
  const active = !!search.dl || !!search.closed
  const current = DEADLINES.find((d) => d.id === search.dl)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Chip active={active} aria-label="Deadline filter">
          {search.dl ? current?.label.replace("Closing within", "≤") : "Deadline"}
          <ChevronDown className="size-3.5 opacity-60" />
        </Chip>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <div role="radiogroup" aria-label="Deadline">
          {DEADLINES.map((d) => (
            <button
              key={d.label}
              type="button"
              role="radio"
              aria-checked={search.dl === d.id}
              onClick={() => set({ dl: d.id })}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border",
                  search.dl === d.id && "border-primary",
                )}
              >
                {search.dl === d.id && <span className="size-2 rounded-full bg-primary" />}
              </span>
              {d.label}
            </button>
          ))}
        </div>
        <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 border-t px-2 pt-2.5 pb-1.5 text-sm">
          Include closed
          <Switch checked={!!search.closed} onCheckedChange={(c) => set({ closed: c || undefined })} />
        </label>
      </PopoverContent>
    </Popover>
  )
}

type Props = {
  search: AppSearch
  set: SetSearch
  facets: Facets
  savedCount: number
  freshCount: number
  className?: string
}

export function FilterBar({ search, set, facets, savedCount, freshCount, className }: Props) {
  const mode = useMode()
  const cats = list(search.cat)
  const fields = list(search.field)
  const sources = list(search.src)
  const anyActive =
    cats.length + fields.length + sources.length > 0 || !!search.dl || !!search.closed || !!search.saved || !!search.fresh

  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]", className)}>
      <FacetChip
        label="Position"
        selected={cats}
        onToggle={(id) => set((p) => ({ cat: toggleIn(p.cat, id) }))}
        onClear={() => set({ cat: undefined })}
        options={CATEGORIES.map((c) => ({
          id: c.id,
          label: c.label,
          count: facets.cats[c.id] ?? 0,
          adornment: <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color[mode] }} aria-hidden />,
        }))}
      />
      <FacetChip
        label="Field"
        searchable
        selected={fields}
        onToggle={(id) => set((p) => ({ field: toggleIn(p.field, id) }))}
        onClear={() => set({ field: undefined })}
        options={FIELDS.map((f) => ({ id: f.id, label: f.label, count: facets.fields[f.id] ?? 0 })).sort(
          (a, b) => b.count - a.count,
        )}
      />
      <DeadlineChip search={search} set={set} />
      <Chip
        active={!!search.fresh}
        aria-pressed={!!search.fresh}
        onClick={() => set({ fresh: search.fresh ? undefined : true })}
        title="Posted in the last 7 days"
      >
        <Sparkles className="size-3.5" />
        New
        {freshCount > 0 && <span className="tabular-nums opacity-70">{freshCount}</span>}
      </Chip>
      <Chip
        active={!!search.saved}
        aria-pressed={!!search.saved}
        onClick={() => set({ saved: search.saved ? undefined : true })}
      >
        <Star className={cn("size-3.5", search.saved && "fill-current")} />
        Saved
        {savedCount > 0 && <span className="tabular-nums opacity-70">{savedCount}</span>}
      </Chip>
      <FacetChip
        label="Source"
        selected={sources}
        onToggle={(id) => set((p) => ({ src: toggleIn(p.src, id) }))}
        onClear={() => set({ src: undefined })}
        options={(["ejm", "joe"] as const).map((s) => ({
          id: s,
          label: s === "ejm" ? "EconJobMarket (EJM)" : "AEA JOE",
          count: facets.sources[s] ?? 0,
          adornment: <span className="font-mono text-[10px] text-muted-foreground">{sourceLabel(s)}</span>,
        }))}
      />
      {anyActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 rounded-full px-2.5 text-xs text-muted-foreground"
          onClick={() =>
            set({ cat: undefined, field: undefined, src: undefined, dl: undefined, closed: undefined, saved: undefined, fresh: undefined })
          }
        >
          <X className="size-3.5" /> Clear
        </Button>
      )}
    </div>
  )
}
