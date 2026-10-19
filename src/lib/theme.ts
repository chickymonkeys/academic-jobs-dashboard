import { computed } from "vue"
import { createGlobalState, useDark } from "@vueuse/core"
import type { Mode } from "./colors"

/**
 * Light / dark mode through VueUse's `useDark`, the same store Nuxt UI's color-mode plugin uses, so the
 * components and the map always agree. With nothing saved it follows the OS, including changes while the
 * tab is open; index.html applies the class before first paint.
 */
const useThemeState = createGlobalState(() => {
  const isDark = useDark()
  const mode = computed<Mode>(() => (isDark.value ? "dark" : "light"))
  const setTheme = (next: Mode) => (isDark.value = next === "dark")
  return { mode, setTheme }
})

export const useMode = () => useThemeState().mode
export const useTheme = () => useThemeState()
