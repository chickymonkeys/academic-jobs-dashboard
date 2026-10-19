import { useMediaQuery, usePreferredReducedMotion } from "@vueuse/core"
import { computed } from "vue"

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)")
export function usePrefersReducedMotion() {
  const pref = usePreferredReducedMotion()
  return computed(() => pref.value === "reduce")
}
