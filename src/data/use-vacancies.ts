import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Vacancy } from "@/domain/vacancy"
import { metaQuery, snapshotQuery } from "./api"

/**
 * Live vacancies: polls meta, swaps in the new snapshot when its version changes,
 * and announces genuinely new listings instead of silently reshuffling the list.
 */
export function useVacancies(onShowNew?: () => void) {
  const meta = useQuery(metaQuery)
  const snapshot = useQuery(snapshotQuery(meta.data?.version))
  const items = snapshot.data?.items
  const previous = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!items) return
    const ids = new Set(items.map((v) => v.id))
    const prev = previous.current
    previous.current = ids
    if (!prev) return
    const added = items.filter((v) => !prev.has(v.id)).length
    if (added > 0) {
      toast(`${added} new position${added === 1 ? "" : "s"} just posted`, {
        description: "Listings refresh automatically from EJM and JOE.",
        action: onShowNew ? { label: "Show", onClick: onShowNew } : undefined,
      })
    }
  }, [items, onShowNew])

  const byId = useMemo(() => new Map<string, Vacancy>((items ?? []).map((v) => [v.id, v])), [items])

  return {
    items: items ?? EMPTY,
    byId,
    meta: meta.data,
    version: meta.data?.version,
    isLoading: meta.isLoading || (snapshot.isLoading && !snapshot.data),
    error: meta.error ?? snapshot.error,
    isRefreshing: snapshot.isFetching && !!snapshot.data,
  }
}

const EMPTY: Vacancy[] = []
