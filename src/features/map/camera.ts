import { createContext, useContext, useMemo } from "react"
import { useMap } from "react-map-gl/maplibre"
import { WORLD_BOUNDS, type Bounds } from "@/domain/geo"
import { usePrefersReducedMotion } from "@/hooks/use-media-query"

export type Padding = { top: number; bottom: number; left: number; right: number }

/** How much of the canvas each floating panel covers, so the camera frames the *visible* map */
export const CameraPaddingContext = createContext<Padding>({ top: 24, bottom: 24, left: 24, right: 24 })
export const useCameraPadding = () => useContext(CameraPaddingContext)

export function useCamera(override?: Padding) {
  const { main } = useMap()
  const context = useCameraPadding()
  const padding = override ?? context
  const reduce = usePrefersReducedMotion()

  return useMemo(() => {
    const map = () => main?.getMap()
    // Never let panels eat more than 60% of either axis, or fitBounds has nowhere to fit.
    const safe = (): Padding => {
      const m = map()
      if (!m) return padding
      const { clientWidth: w, clientHeight: h } = m.getContainer()
      const sx = Math.min(1, (w * 0.6) / Math.max(1, padding.left + padding.right))
      const sy = Math.min(1, (h * 0.6) / Math.max(1, padding.top + padding.bottom))
      return { left: padding.left * sx, right: padding.right * sx, top: padding.top * sy, bottom: padding.bottom * sy }
    }
    const ms = (d: number) => (reduce ? 0 : d)

    const fitBounds = (b: Bounds, maxZoom = 10) =>
      map()?.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: safe(), maxZoom, duration: ms(1500), essential: true },
      )

    const flyTo = (lng: number, lat: number, zoom?: number) => {
      const m = map()
      m?.flyTo({ center: [lng, lat], zoom: zoom ?? Math.max(m.getZoom(), 10), padding: safe(), duration: ms(1400), curve: 1.5, essential: true })
    }

    const easeTo = (lng: number, lat: number, zoom?: number) => {
      const m = map()
      m?.easeTo({ center: [lng, lat], zoom: zoom ?? m.getZoom(), padding: safe(), duration: ms(700), essential: true })
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
      if (e - w < 0.02 && n - s < 0.02) return flyTo(pts[0].lng, pts[0].lat, Math.min(maxZoom, 12))
      fitBounds([w, s, e, n], maxZoom)
    }

    /** Gently pan only if the point is hidden behind a panel or off-screen */
    const reveal = (lng: number, lat: number) => {
      const m = map()
      if (!m) return
      const p = safe()
      const { x, y } = m.project([lng, lat])
      const { clientWidth: w, clientHeight: h } = m.getContainer()
      const inside = x > p.left + 24 && x < w - p.right - 24 && y > p.top + 24 && y < h - p.bottom - 24
      if (!inside) easeTo(lng, lat, Math.max(m.getZoom(), 4))
    }

    return {
      fitBounds,
      flyTo,
      easeTo,
      fitPoints,
      reveal,
      zoomBy: (delta: number) => {
        const m = map()
        m?.easeTo({ zoom: m.getZoom() + delta, duration: ms(300) })
      },
      reset: () => fitBounds(WORLD_BOUNDS, 3),
      getZoom: () => map()?.getZoom() ?? 0,
    }
  }, [main, padding, reduce])
}
export type Camera = ReturnType<typeof useCamera>
