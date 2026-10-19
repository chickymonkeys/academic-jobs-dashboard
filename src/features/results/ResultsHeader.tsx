import { ArrowUpDown, Check, List, Table2 } from "lucide-react"
import type { AppSearch, useAppSearch } from "@/app/search"
import type { SortKey } from "@/features/filters/filtering"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "relevance", label: "Best match" },
  { id: "deadline", label: "Deadline (soonest)" },
  { id: "newest", label: "Newest first" },
  { id: "az", label: "Institution A–Z" },
]

type Props = {
  count: number
  total: number
  scope: "group" | "area" | "world" | "everywhere"
  groupLabel?: string
  sortKey: SortKey
  hasQuery: boolean
  search: AppSearch
  set: ReturnType<typeof useAppSearch>[1]
  showViewToggle: boolean
  onClearGroup: () => void
}

/** Always answers "how many, and where?" — the scope line makes the map-linked list legible */
export function ResultsHeader({ count, total, scope, groupLabel, sortKey, hasQuery, search, set, showViewToggle, onClearGroup }: Props) {
  const link = "font-medium text-primary hover:underline underline-offset-2"
  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground tabular-nums" aria-live="polite">
          {count.toLocaleString()} {count === 1 ? "position" : "positions"}
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          {scope === "group" && (
            <>
              at {groupLabel} ·{" "}
              <button className={link} onClick={onClearGroup}>
                Show all
              </button>
            </>
          )}
          {scope === "area" && (
            <>
              in visible map area · {total.toLocaleString()} total ·{" "}
              <button className={link} onClick={() => set({ area: false })}>
                List all
              </button>
            </>
          )}
          {scope === "world" && <>worldwide, sorted by {SORTS.find((s) => s.id === sortKey)?.label.toLowerCase()}</>}
          {scope === "everywhere" && (
            <>
              everywhere (ignoring map) ·{" "}
              <button className={link} onClick={() => set({ area: undefined })}>
                Follow map
              </button>
            </>
          )}
        </p>
      </div>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Sort results">
                <ArrowUpDown />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Sort: {SORTS.find((s) => s.id === sortKey)?.label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
          {SORTS.map((s) => (
            <DropdownMenuItem
              key={s.id}
              disabled={s.id === "relevance" && !hasQuery}
              onSelect={() => set({ sort: s.id })}
            >
              {s.label}
              {sortKey === s.id && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => set({ area: search.area === false ? undefined : false })}>
            Follow map area
            {search.area !== false && <Check className="ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {showViewToggle && (
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={search.view ?? "list"}
          onValueChange={(v) => v && set({ view: v === "table" ? "table" : undefined })}
          aria-label="Result layout"
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <Table2 />
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  )
}
