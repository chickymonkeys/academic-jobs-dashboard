import { inject, provide, shallowRef, type InjectionKey, type Ref, type ShallowRef } from "vue"
import type { Map as MaplibreMap } from "maplibre-gl"
import { WORLD_BOUNDS, type Bounds } from "@/domain/geo"
import { usePrefersReducedMotion } from "@/lib/media"

export type Padding = { top: number; bottom: number; left: number; right: number }

type MapContext = {
  map: ShallowRef<MaplibreMap | null>
  /** How much of the canvas each floating panel covers, so the camera frames the *visible* map */
  padding: Readonly<Ref<Padding>>
}
const MAP_CONTEXT: InjectionKey<MapContext> = Symbol("map")

export function provideMapContext(padding: Readonly<Ref<Padding>>): MapContext {
  const ctx: MapContext = { map: shallowRef(null), padding }
  provide(MAP_CONTEXT, ctx)
  return ctx
}

export function useMapContext() {
  const ctx = inject(MAP_CONTEXT)
  if (!ctx) throw new Error("useMapContext() needs provideMapContext() in a parent")
  return ctx
}

/** Camera moves that respect the panels' footprint. Every call reads the live map, padding and motion preference. */
export function useCamera({ map, padding }: MapContext) {
  const reduce = usePrefersReducedMotion()
  const m = () => map.value
  // Never let panels eat more than 60% of either axis, or fitBounds has nowhere to fit.
  const safe = (): Padding => {
    const p = padding.value
    const mm = m()
    if (!mm) return p
    const { clientWidth: w, clientHeight: h } = mm.getContainer()
    const sx = Math.min(1, (w * 0.6) / Math.max(1, p.left + p.right))
    const sy = Math.min(1, (h * 0.6) / Math.max(1, p.top + p.bottom))
    return { left: p.left * sx, right: p.right * sx, top: p.top * sy, bottom: p.bottom * sy }
  }
  const ms = (d: number) => (reduce.value ? 0 : d)

  const fitBounds = (b: Bounds, maxZoom = 10) =>
    m()?.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      { padding: safe(), maxZoom, duration: ms(1500), essential: true },
    )

  const flyTo = (lng: number, lat: number, zoom?: number) => {
    const mm = m()
    mm?.flyTo({
      center: [lng, lat],
      zoom: zoom ?? Math.max(mm.getZoom(), 10),
      padding: safe(),
      duration: ms(1400),
      curve: 1.5,
      essential: true,
    })
  }

  const easeTo = (lng: number, lat: number, zoom?: number) => {
    const mm = m()
    mm?.easeTo({ center: [lng, lat], zoom: zoom ?? mm.getZoom(), padding: safe(), duration: ms(700), essential: true })
  }

  const fitPoints = (pts: Array<{ lat: number; lng: number }>, maxZoom = 11) => {
    if (!pts.length) return
    let [w, s, e, n] = [180, 90, -180, -90]
    for (const p of pts) {
      w = Math.min(w, p.lng)
      e = Math.max(e, p.lng)
      s = Math.min(s, p.lat)
      n = Math.max(n, p.lat)
    }
    if (e - w < 0.02 && n - s < 0.02) return flyTo(pts[0]!.lng, pts[0]!.lat, Math.min(maxZoom, 12))
    fitBounds([w, s, e, n], maxZoom)
  }

  /** Gently pan only if the point is hidden behind a panel or off-screen */
  const reveal = (lng: number, lat: number) => {
    const mm = m()
    if (!mm) return
    const p = safe()
    const { x, y } = mm.project([lng, lat])
    const { clientWidth: w, clientHeight: h } = mm.getContainer()
    const inside = x > p.left + 24 && x < w - p.right - 24 && y > p.top + 24 && y < h - p.bottom - 24
    if (!inside) easeTo(lng, lat, Math.max(mm.getZoom(), 4))
  }

  return {
    fitBounds,
    flyTo,
    easeTo,
    fitPoints,
    reveal,
    zoomBy: (delta: number) => {
      const mm = m()
      mm?.easeTo({ zoom: mm.getZoom() + delta, duration: ms(300) })
    },
    reset: () => fitBounds(WORLD_BOUNDS, 3),
    getZoom: () => m()?.getZoom() ?? 0,
  }
}
export type Camera = ReturnType<typeof useCamera>
