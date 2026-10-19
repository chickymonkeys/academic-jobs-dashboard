import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react"
import type { Meta } from "@/domain/vacancy"
import { META_POLL_MS } from "@/data/api"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { ago } from "@/lib/dates"
import { cn } from "@/lib/utils"

/** Trust signal: how fresh the data is and which feeds are healthy, one click away */
export function DataStatus({ meta, refreshing, crossListed }: { meta?: Meta; refreshing: boolean; crossListed: number }) {
  if (!meta) return <Skeleton className="h-5 w-28 rounded-full" />
  const healthy = meta.sources.every((s) => s.ok)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          {refreshing ? (
            <RefreshCw className="size-3 animate-spin" aria-hidden />
          ) : (
            <span className={cn("size-1.5 rounded-full", healthy ? "bg-success" : "bg-soon")} aria-hidden />
          )}
          {refreshing ? "Updating…" : `Updated ${ago(meta.generatedAt)}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium">Live sources</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {meta.total.toLocaleString()} open positions · {crossListed} cross-listed and merged
          </p>
        </div>
        <ul className="divide-y">
          {meta.sources.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-4 py-3">
              {s.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Healthy" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-soon" aria-label="Degraded" />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <a
                  href={s.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  {s.name} <ExternalLink className="size-3 opacity-50" />
                </a>
                <div className="text-xs text-muted-foreground">
                  {s.count.toLocaleString()} listings{s.fetchedAt ? ` · fetched ${ago(s.fetchedAt)}` : ""}
                </div>
                {s.error && <div className="mt-1 text-xs text-soon">Using cached data: {s.error}</div>}
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          Checks for new listings every {Math.round(META_POLL_MS / 60_000)} minutes while this tab is open.
        </p>
      </PopoverContent>
    </Popover>
  )
}
