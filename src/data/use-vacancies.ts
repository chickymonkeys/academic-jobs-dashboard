import { computed, watch } from "vue"
import { useToast } from "@nuxt/ui/composables"
import type { Vacancy } from "@/domain/vacancy"
import { useMeta, useSnapshot } from "./api"

const EMPTY: Vacancy[] = []

/**
 * Live vacancies: polls meta, swaps in the new snapshot when its version changes,
 * and announces genuinely new listings instead of silently reshuffling the list.
 */
export function useVacancies(onShowNew?: () => void) {
  const toast = useToast()
  const meta = useMeta()
  const version = computed(() => meta.data.value?.version)
  const snapshot = useSnapshot(version)
  const items = computed(() => snapshot.data.value?.items ?? EMPTY)

  let previous: Set<string> | null = null
  watch(
    () => snapshot.data.value?.items,
    (next) => {
      if (!next) return
      const prev = previous
      previous = new Set(next.map((v) => v.id))
      if (!prev) return
      const added = next.filter((v) => !prev.has(v.id)).length
      if (added > 0) {
        toast.add({
          title: `${added} new position${added === 1 ? "" : "s"} just posted`,
          description: "Listings refresh automatically from every source.",
          icon: "i-lucide-sparkles",
          actions: onShowNew ? [{ label: "Show", color: "neutral", variant: "outline", onClick: onShowNew }] : undefined,
        })
      }
    },
  )

  const byId = computed(() => new Map<string, Vacancy>(items.value.map((v) => [v.id, v])))

  return {
    items,
    byId,
    meta: computed(() => meta.data.value),
    version,
    isLoading: computed(() => meta.isLoading.value || (snapshot.isLoading.value && !snapshot.data.value)),
    error: computed(() => meta.error.value ?? snapshot.error.value),
    isRefreshing: computed(() => snapshot.isFetching.value && !!snapshot.data.value),
  }
}
