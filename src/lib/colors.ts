import { CATEGORY_BY_ID } from "@/domain/taxonomy"
import type { Category } from "@/domain/vacancy"

export type RGBA = [number, number, number, number]
export type Mode = "light" | "dark"

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const n = parseInt(hex.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha]
}

export const categoryHex = (c: Category, mode: Mode) => CATEGORY_BY_ID[c].color[mode]
export const categoryRgba = (c: Category, mode: Mode, alpha = 255) => hexToRgba(categoryHex(c, mode), alpha)

/** Map-surface tokens for deck.gl marks (rings use the surface so overlapping marks stay separable) */
export const MAP_TOKENS = {
  light: {
    surface: hexToRgba("#fcfcfb"),
    cluster: hexToRgba("#1c5cab"),
    clusterText: hexToRgba("#ffffff"),
    halo: hexToRgba("#2a78d6", 60),
  },
  dark: {
    surface: hexToRgba("#1a1a19"),
    cluster: hexToRgba("#3987e5"),
    clusterText: hexToRgba("#0b1424"),
    halo: hexToRgba("#3987e5", 70),
  },
} as const

/** Sequential single-hue blue ramp (light → dark) for density */
export const DENSITY_RAMP: RGBA[] = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"].map((h) =>
  hexToRgba(h),
)

export const BASEMAP: Record<Mode, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
}
