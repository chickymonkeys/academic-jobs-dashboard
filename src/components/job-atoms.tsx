import { useState } from "react"
import { AlarmClock, CalendarClock, CalendarDays, CalendarX2, Infinity as InfinityIcon, Star } from "lucide-react"
import { CATEGORY_BY_ID } from "@/domain/taxonomy"
import type { Category, SourceId, Vacancy } from "@/domain/vacancy"
import { deadlineLabel, deadlineState, type DeadlineState } from "@/lib/dates"
import { toggleSaved, useShortlist } from "@/lib/shortlist"
import { useMode } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  const mode = useMode()
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: CATEGORY_BY_ID[category].color[mode] }}
    />
  )
}

export function CategoryLabel({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <CategoryDot category={category} className="size-2" />
      {CATEGORY_BY_ID[category].label}
    </span>
  )
}

const DEADLINE_STYLE: Record<DeadlineState, { className: string; Icon: typeof AlarmClock }> = {
  closed: { className: "text-muted-foreground", Icon: CalendarX2 },
  urgent: { className: "text-urgent font-medium", Icon: AlarmClock },
  soon: { className: "text-soon font-medium", Icon: CalendarClock },
  open: { className: "text-muted-foreground", Icon: CalendarDays },
  rolling: { className: "text-muted-foreground", Icon: InfinityIcon },
}

/** Deadline urgency always ships as icon + words, never color alone */
export function DeadlineText({ deadline, className }: { deadline: string | null; className?: string }) {
  const { className: tone, Icon } = DEADLINE_STYLE[deadlineState(deadline)]
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", tone, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {deadlineLabel(deadline)}
    </span>
  )
}

const SOURCE_LABEL: Record<SourceId, string> = { ejm: "EJM", joe: "JOE" }
export const sourceLabel = (s: SourceId) => SOURCE_LABEL[s]

export function SourceTags({ v, className }: { v: Pick<Vacancy, "source" | "alsoOn">; className?: string }) {
  const all = [v.source, ...v.alsoOn.map((a) => a.source)]
  return (
    <span className={cn("inline-flex gap-1", className)}>
      {[...new Set(all)].map((s) => (
        <span
          key={s}
          className="rounded-[5px] border border-border px-1 py-px font-mono text-[10px] leading-none tracking-wide text-muted-foreground"
        >
          {SOURCE_LABEL[s]}
        </span>
      ))}
    </span>
  )
}

export function InstitutionAvatar({ v, className }: { v: Pick<Vacancy, "institution" | "logoUrl">; className?: string }) {
  const [failed, setFailed] = useState(false)
  const initials = v.institution
    .replace(/\b(of|the|and|for|de|di|du|la|le|des|der|und)\b/gi, " ")
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ž]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted text-[13px] font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {v.logoUrl && !failed ? (
        <img
          src={v.logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full bg-white object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        initials || "·"
      )}
    </span>
  )
}

export function SaveButton({ id, className, size = "icon-sm" }: { id: string; className?: string; size?: "icon-sm" | "icon" }) {
  const saved = useShortlist().has(id)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save position"}
          className={cn("text-muted-foreground hover:text-foreground", saved && "text-soon hover:text-soon", className)}
          onClick={(e) => {
            e.stopPropagation()
            toggleSaved(id)
          }}
        >
          <Star className={cn("size-4", saved && "fill-current")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{saved ? "Saved — click to remove" : "Save to shortlist"}</TooltipContent>
    </Tooltip>
  )
}

export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      New
    </span>
  )
}

export function placeLabel(v: Pick<Vacancy, "city" | "admin" | "country" | "countryCode">) {
  const region = v.countryCode === "US" || v.countryCode === "CA" ? v.admin : v.country
  return [v.city, region].filter(Boolean).join(", ") || v.country
}
