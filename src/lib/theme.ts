import { useSyncExternalStore } from "react"
import type { Mode } from "./colors"

/**
 * Light / dark / system theme as a tiny external store. index.html applies the class before first paint;
 * this keeps it in sync afterwards (including OS-level changes while the tab is open).
 */
type Theme = "light" | "dark" | "system"
const KEY = "ajd.theme"
const media = window.matchMedia("(prefers-color-scheme: dark)")
const listeners = new Set<() => void>()

let theme: Theme = (() => {
  try {
    const t = localStorage.getItem(KEY)
    return t === "light" || t === "dark" ? t : "system"
  } catch {
    return "system"
  }
})()

const resolved = (): Mode => (theme === "system" ? (media.matches ? "dark" : "light") : theme)

function apply() {
  const mode = resolved()
  document.documentElement.classList.toggle("dark", mode === "dark")
  document.documentElement.style.colorScheme = mode
  listeners.forEach((l) => l())
}

media.addEventListener("change", apply)
apply()

export function setTheme(next: Theme) {
  theme = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* session-only */
  }
  apply()
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useMode(): Mode {
  return useSyncExternalStore(subscribe, resolved)
}

export function useTheme() {
  return { resolvedTheme: useMode(), setTheme }
}
