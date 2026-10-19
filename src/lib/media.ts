import { useMediaQuery, usePreferredReducedMotion } from "@vueuse/core"
import { computed } from "vue"

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)")
/** Below desktop but at least 640px wide (tablets, phones on their side): the sheet floats as a left-hand card */
export const useIsWide = () => useMediaQuery("(min-width: 640px)")
export function usePrefersReducedMotion() {
  const pref = usePreferredReducedMotion()
  return computed(() => pref.value === "reduce")
}
