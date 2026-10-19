export const SNAP_PEEK = "132px"
export const SNAP_HALF = 0.52
export const SNAP_FULL = 1
export type Snap = number | string | null

/** Pixels of map the sheet covers at a detent; full is treated like half, since the map is hidden anyway */
export function sheetOffset(snap: Snap, viewportH: number) {
  if (typeof snap === "string") return parseInt(snap, 10)
  if (snap == null) return 132
  return Math.min(snap, SNAP_HALF) * viewportH
}
