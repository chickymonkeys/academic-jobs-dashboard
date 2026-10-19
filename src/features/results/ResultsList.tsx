import { memo, useEffect, useRef, type ReactNode } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Vacancy } from "@/domain/vacancy"
import type { Indexed } from "@/features/filters/filtering"
import {
  CategoryLabel,
  DeadlineText,
  InstitutionAvatar,
  NewBadge,
  SaveButton,
  SourceTags,
  placeLabel,
} from "@/components/job-atoms"
import { Skeleton } from "@/components/ui/skeleton"
import { isFresh } from "@/lib/dates"
import { cn } from "@/lib/utils"

type RowProps = {
  v: Vacancy
  selected: boolean
  hovered: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

/** Card with a stretched primary button, so the save star stays a separate, valid control */
export const JobRow = memo(function JobRow({ v, selected, hovered, onSelect, onHover }: RowProps) {
  return (
    <article
      className={cn(
        "group relative mx-2 flex gap-3 rounded-xl p-2.5 transition-colors",
        selected ? "bg-primary/[0.08] ring-1 ring-primary/25" : hovered ? "bg-foreground/[0.045]" : "hover:bg-foreground/[0.045]",
      )}
      onMouseEnter={() => onHover(v.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        aria-label={`${v.title}, ${v.institution}`}
        aria-current={selected || undefined}
        onClick={() => onSelect(v.id)}
      />
      <InstitutionAvatar v={v} className="pointer-events-none" />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <h3 className="line-clamp-2 flex-1 text-sm leading-snug font-medium text-foreground">{v.title}</h3>
          <SaveButton
            id={v.id}
            className={cn(
              "pointer-events-auto relative z-10 -mt-1 -mr-1 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100 [@media(hover:none)]:opacity-100",
            )}
          />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {v.institution} <span aria-hidden>·</span> {placeLabel(v)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/75">
          <CategoryLabel category={v.category} />
          <DeadlineText deadline={v.deadline} />
          {isFresh(v) && <NewBadge />}
          <SourceTags v={v} className="ml-auto" />
        </div>
      </div>
    </article>
  )
})

type Props = {
  rows: Indexed[]
  selectedId?: string
  hoveredId: string | null
  loading: boolean
  empty: ReactNode
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export function ResultsList({ rows, selectedId, hoveredId, loading, empty, onSelect, onHover }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 8,
    getItemKey: (i) => rows[i]!.v.id,
  })

  // Map → list: keep the selected row in view when it was picked on the map.
  useEffect(() => {
    if (!selectedId) return
    const i = rows.findIndex((r) => r.v.id === selectedId)
    if (i >= 0) virtualizer.scrollToIndex(i, { align: "auto" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  if (loading)
    return (
      <div className="space-y-1 px-2 pt-1" aria-busy>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex gap-3 p-2.5">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    )

  if (!rows.length) return <div className="flex flex-1 items-start justify-center px-6 pt-10">{empty}</div>

  return (
    <div ref={parentRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3" data-vaul-no-drag>
      <div role="list" aria-label="Positions" style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const v = rows[item.index]!.v
          return (
            <div
              key={item.key}
              role="listitem"
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full py-0.5"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <JobRow
                v={v}
                selected={v.id === selectedId}
                hovered={v.id === hoveredId}
                onSelect={onSelect}
                onHover={onHover}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
