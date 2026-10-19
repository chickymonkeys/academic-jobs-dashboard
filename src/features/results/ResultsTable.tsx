import { useMemo, useRef, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { CATEGORY_BY_ID, FIELD_LABEL } from "@/domain/taxonomy"
import type { Indexed } from "@/features/filters/filtering"
import { CategoryLabel, DeadlineText, SaveButton, SourceTags, placeLabel } from "@/components/job-atoms"
import { cn } from "@/lib/utils"

const GRID = "grid grid-cols-[28px_minmax(200px,2.4fr)_minmax(110px,1.1fr)_minmax(112px,0.9fr)_minmax(100px,1fr)_112px_60px]"

const columns: ColumnDef<Indexed>[] = [
  { id: "save", header: "", enableSorting: false, cell: ({ row }) => <SaveButton id={row.original.v.id} className="size-7" /> },
  {
    id: "title",
    header: "Position",
    accessorFn: (r) => r.v.title,
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{row.original.v.title}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.v.institution}</div>
      </div>
    ),
  },
  { id: "place", header: "Location", accessorFn: (r) => placeLabel(r.v), cell: (c) => <span className="truncate">{c.getValue<string>()}</span> },
  {
    id: "category",
    header: "Type",
    accessorFn: (r) => CATEGORY_BY_ID[r.v.category].label,
    cell: ({ row }) => <CategoryLabel category={row.original.v.category} className="truncate" />,
  },
  {
    id: "fields",
    header: "Fields",
    enableSorting: false,
    accessorFn: (r) => r.v.fields.map((f) => FIELD_LABEL[f] ?? f).join(", "),
    cell: (c) => <span className="truncate text-muted-foreground">{c.getValue<string>()}</span>,
  },
  {
    id: "deadline",
    header: "Deadline",
    accessorFn: (r) => r.v.deadline ?? "9999-12-31",
    cell: ({ row }) => <DeadlineText deadline={row.original.v.deadline} />,
  },
  { id: "source", header: "Source", accessorFn: (r) => r.v.source, cell: ({ row }) => <SourceTags v={row.original.v} /> },
]

type Props = {
  rows: Indexed[]
  selectedId?: string
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

/** Dense, sortable comparison view for when the list isn't enough (desktop) */
export function ResultsTable({ rows, selectedId, hoveredId, onSelect, onHover }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (r) => r.v.id,
  })
  const tableRows = table.getRowModel().rows
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })
  const headers = useMemo(() => table.getHeaderGroups()[0]!.headers, [table, sorting]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={parentRef} className="scrollbar-thin min-h-0 flex-1 overflow-auto text-sm" role="table" aria-rowcount={tableRows.length}>
      <div
        role="row"
        className={cn(GRID, "sticky top-0 z-10 items-center gap-3 border-b bg-[var(--glass)] px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur")}
      >
        {headers.map((h) => {
          const sorted = h.column.getIsSorted()
          return (
            <div key={h.id} role="columnheader" aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
              {h.column.getCanSort() ? (
                <button
                  type="button"
                  onClick={h.column.getToggleSortingHandler()}
                  className="inline-flex items-center gap-1 rounded hover:text-foreground"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                </button>
              ) : (
                flexRender(h.column.columnDef.header, h.getContext())
              )}
            </div>
          )
        })}
      </div>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = tableRows[item.index]!
          const id = row.original.v.id
          return (
            <div
              key={row.id}
              role="row"
              tabIndex={0}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(id)}
              onMouseEnter={() => onHover(id)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                GRID,
                "absolute left-0 w-full cursor-pointer items-center gap-3 border-b border-border/50 px-3 focus-visible:bg-accent focus-visible:outline-none",
                id === selectedId ? "bg-primary/[0.08]" : id === hoveredId ? "bg-foreground/[0.045]" : "hover:bg-foreground/[0.045]",
              )}
              style={{ height: item.size, transform: `translateY(${item.start}px)` }}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} role="cell" className="flex min-w-0 items-center" onClick={cell.column.id === "save" ? (e) => e.stopPropagation() : undefined}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
