import { Fragment, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowUpRight, Check, Crosshair, Link2, MapPin, X } from "lucide-react"
import { toast } from "sonner"
import { detailQuery } from "@/data/api"
import { FIELD_LABEL } from "@/domain/taxonomy"
import type { Block, Vacancy } from "@/domain/vacancy"
import {
  CategoryLabel,
  DeadlineText,
  InstitutionAvatar,
  NewBadge,
  SaveButton,
  SourceTags,
  placeLabel,
  sourceLabel,
} from "@/components/job-atoms"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fmtDate, isFresh } from "@/lib/dates"
import { cn } from "@/lib/utils"

type Props = {
  v: Vacancy
  version?: string
  nearby: Array<{ v: Vacancy; km: number }>
  onClose: () => void
  onSelect: (id: string) => void
  onShowOnMap: () => void
  variant: "panel" | "sheet"
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-6", className)}>
      <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-card/70 px-3 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

function Blocks({ blocks }: { blocks: Block[] }) {
  const out: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    if (b.t === "li") {
      const items: string[] = []
      while (i < blocks.length && blocks[i]!.t === "li") items.push(blocks[i++]!.text)
      i--
      out.push(
        <ul key={i}>
          {items.map((t, j) => (
            <li key={j}>{t}</li>
          ))}
        </ul>,
      )
    } else if (b.t === "h") out.push(<h4 key={i}>{b.text}</h4>)
    else out.push(<p key={i}>{b.text}</p>)
  }
  return <div className="prose-job">{out}</div>
}

const PREVIEW_BLOCKS = 6

function Description({ id, version, summary }: { id: string; version?: string; summary: string }) {
  const { data, isLoading, isError, refetch } = useQuery(detailQuery(id, version))
  const [expanded, setExpanded] = useState(false)
  // Progressive: the index already carries a summary, so show it instantly while the full body streams in.
  if (isLoading)
    return (
      <div aria-busy>
        {summary && <p className="mb-3 text-sm leading-relaxed text-foreground/90">{summary}</p>}
        <div className="space-y-2">
          {[100, 92, 97, 60].map((w, i) => (
            <Skeleton key={i} className="h-3.5" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  if (isError || !data)
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load the full description.{" "}
        <button className="text-primary underline underline-offset-2" onClick={() => refetch()}>
          Retry
        </button>
      </p>
    )
  const long = data.blocks.length > PREVIEW_BLOCKS + 2
  const blocks = long && !expanded ? data.blocks.slice(0, PREVIEW_BLOCKS) : data.blocks
  return (
    <>
      {data.requirements.length > 0 && (
        <Section title="What to submit" className="mt-0 mb-6">
          <ul className="grid gap-1.5">
            {data.requirements.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {data.salary && (
        <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Salary · </span>
          {data.salary}
        </p>
      )}
      <div className="relative">
        <Blocks blocks={blocks} />
        {long && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--glass)] to-transparent" />
        )}
      </div>
      {long && (
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Read full description"}
        </Button>
      )}
      {data.jel.length > 0 && (
        <Section title="JEL classification">
          <ul className="grid gap-1 text-sm">
            {data.jel.map((j) => (
              <li key={j.code} className="flex gap-2">
                <span className="w-8 shrink-0 font-mono text-xs leading-5 text-muted-foreground">{j.code}</span>
                <span>{j.label}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {data.keywords.length > 0 && (
        <Section title="Keywords">
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.slice(0, 16).map((k) => (
              <span key={k} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground/80">
                {k}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

export function JobDetail({ v, version, nearby, onClose, onSelect, onShowOnMap, variant }: Props) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied", { description: "It opens this position on the map." })
    } catch {
      toast.error("Couldn't copy the link")
    }
  }
  const primaryLabel = sourceLabel(v.source)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        {variant === "sheet" ? (
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1 text-muted-foreground">
            <ArrowLeft className="size-4" /> Results
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Close <span className="opacity-60">Esc</span>
            </TooltipContent>
          </Tooltip>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onShowOnMap} aria-label="Show on map">
                <Crosshair />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show on map</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={copyLink} aria-label="Copy link">
                <Link2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy link</TooltipContent>
          </Tooltip>
          <SaveButton id={v.id} size="icon" />
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8" data-vaul-no-drag>
        <div className="flex items-center gap-3">
          <InstitutionAvatar v={v} className="size-12" />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <CategoryLabel category={v.category} className="text-foreground/80" />
              {isFresh(v) && <NewBadge />}
            </span>
            <span>{v.positionTypes.slice(0, 3).join(" · ")}</span>
          </div>
        </div>
        <h2 className="mt-3 text-lg leading-snug font-semibold text-balance text-foreground">{v.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="text-foreground/85">{v.institution}</span>
          {v.department && <> · {v.department}</>}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
          <Fact label="Deadline">
            <DeadlineText deadline={v.deadline} className="text-[13px]" />
            {v.deadline && <div className="text-xs text-muted-foreground">{fmtDate(v.deadline)}</div>}
          </Fact>
          <Fact label="Location">
            <span className="inline-flex items-start gap-1">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {placeLabel(v)}
            </span>
            {v.geoPrecision === "country" && <div className="text-xs text-muted-foreground">Approximate pin</div>}
          </Fact>
          <Fact label="Posted">{v.postedAt ? fmtDate(v.postedAt) : <span className="text-muted-foreground">Not stated</span>}</Fact>
          <Fact label="Listed on">
            <SourceTags v={v} />
          </Fact>
        </dl>

        <div className="mt-4 flex gap-2">
          <Button asChild className="flex-1">
            <a href={v.url} target="_blank" rel="noopener noreferrer">
              View & apply on {primaryLabel} <ArrowUpRight />
            </a>
          </Button>
          {v.alsoOn.map((a) => (
            <Button key={a.url} asChild variant="outline">
              <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`Also on ${sourceLabel(a.source)}`}>
                {sourceLabel(a.source)} <ArrowUpRight />
              </a>
            </Button>
          ))}
        </div>

        <Section title="Fields">
          <div className="flex flex-wrap gap-1.5">
            {v.fields.map((f) => (
              <span key={f} className="rounded-full border px-2.5 py-0.5 text-xs text-foreground/85">
                {FIELD_LABEL[f] ?? f}
              </span>
            ))}
          </div>
        </Section>

        <Section title="About the position">
          <Description id={v.id} version={version} summary={v.summary} />
        </Section>

        {nearby.length > 0 && (
          <Section title="Nearby positions">
            <ul className="-mx-2">
              {nearby.map(({ v: n, km }) => (
                <Fragment key={n.id}>
                  <li>
                    <button
                      type="button"
                      onClick={() => onSelect(n.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-foreground/5"
                    >
                      <InstitutionAvatar v={n} className="size-8 text-[11px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{n.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{n.institution}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {km < 1 ? "Same place" : `${Math.round(km)} km`}
                      </span>
                    </button>
                  </li>
                </Fragment>
              ))}
            </ul>
          </Section>
        )}

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Aggregated from {v.alsoOn.length ? "EJM and JOE" : primaryLabel}. Always confirm details and deadlines on the
          original posting.
        </p>
      </div>
    </div>
  )
}
