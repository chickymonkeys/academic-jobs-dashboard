import type { HeatmapLayerSpecification } from "maplibre-gl"
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

/**
 * Map-surface tokens for deck.gl marks (rings use the surface so overlapping marks stay separable).
 * Clusters and count badges are neutral ink, so hue on the map only ever means position type.
 */
export const MAP_TOKENS = {
  light: {
    surface: hexToRgba("#fcfcfb"),
    cluster: hexToRgba("#3a4251"),
    clusterText: hexToRgba("#ffffff"),
  },
  dark: {
    surface: hexToRgba("#1a1a19"),
    cluster: hexToRgba("#e4e6ea"),
    clusterText: hexToRgba("#16191f"),
  },
} as const

/** Sequential single-hue blue ramp (light → dark) for density */
const DENSITY_STEPS = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"]

const rgbaCss = (hex: string, a: number) => `rgba(${hexToRgba(hex).slice(0, 3).join(",")},${a})`

/**
 * MapLibre heatmap paint for the density view. Dark mode gets its own direction (dark → light),
 * so the densest areas are the brightest against the dark basemap rather than the darkest.
 */
export function densityPaint(mode: Mode): HeatmapLayerSpecification["paint"] {
  const steps = mode === "light" ? DENSITY_STEPS : [...DENSITY_STEPS].reverse()
  const ramp = [0.18, 0.34, 0.5, 0.66, 0.82, 1].flatMap((t, i) => [t, steps[i]])
  return {
    "heatmap-weight": 1,
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 6, 1.5, 11, 2.4],
    "heatmap-radius": ["interpolate", ["exponential", 1.5], ["zoom"], 0, 18, 4, 28, 8, 40, 12, 60],
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, rgbaCss(steps[0], 0), 0.05, rgbaCss(steps[0], 0.4), ...ramp],
    "heatmap-opacity": 0.85,
  }
}

export const BASEMAP: Record<Mode, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
}
