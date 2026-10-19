import { computed } from "vue"
import { useScreenSafeArea } from "@vueuse/core"

export const SNAP_HALF = 0.52
export const SNAP_FULL = 1
/** Peek is the one detent given in pixels, so a string snap always means peek */
export type Snap = number | string | null
/** Width of the sheet where it floats as a left-hand card (tablets, phones on their side) */
export const SHEET_W = 400
const PEEK_PX = 132

/** Peek shows the count and the region strip, kept clear of the home indicator on notched phones */
export function usePeekSnap() {
  const { bottom } = useScreenSafeArea()
  return computed(() => `${PEEK_PX + Math.round(parseFloat(bottom.value) || 0)}px`)
}

export const isPeek = (snap: Snap) => snap == null || typeof snap === "string"

/** Pixels of the screen the sheet takes up at a detent */
export function sheetHeight(snap: Snap, viewportH: number) {
  if (typeof snap === "string") return parseInt(snap, 10)
  if (snap == null) return PEEK_PX
  return snap * viewportH
}

/** Pixels of map the sheet covers at a detent; full is treated like half, since the map is hidden anyway */
export function sheetOffset(snap: Snap, viewportH: number) {
  return Math.min(sheetHeight(snap, viewportH), SNAP_HALF * viewportH)
}
