import { memo, useCallback, useMemo, useRef, useState } from "react"
import MapGL, { useControl, type ViewStateChangeEvent } from "react-map-gl/maplibre"
import type { IControl, Map as MaplibreMap } from "maplibre-gl"
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox"
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers"
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
import type { PickingInfo } from "@deck.gl/core"
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster"
import { CATEGORIES, CATEGORY_BY_ID } from "@/domain/taxonomy"
import { WORLD_BOUNDS, type Bounds } from "@/domain/geo"
import { CATEGORY_IDS, type Category, type Vacancy } from "@/domain/vacancy"
import { BASEMAP, DENSITY_RAMP, MAP_TOKENS, categoryRgba, type Mode } from "@/lib/colors"
import { deadlineLabel } from "@/lib/dates"
import { DeadlineText } from "@/components/job-atoms"
import { useCameraPadding, useCamera } from "./camera"

type PointProps = { id: string; category: Category }
type ClusterProps = Record<Category, number>
type PointF = PointFeature<PointProps>
type ClusterF = ClusterFeature<ClusterProps>

const CLUSTER_MAX_ZOOM = 13

type Tip = { x: number; y: number } & (
  | { kind: "point"; v: Vacancy }
  | { kind: "cluster"; count: number; breakdown: ClusterProps; names: string[] }
)

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props) as unknown as IControl) as unknown as MapboxOverlay
  overlay.setProps(props)
  return null
}

export type JobMapProps = {
  points: Vacancy[]
  byId: Map<string, Vacancy>
  selectedId?: string
  hoveredId: string | null
  layer: "points" | "density"
  globe: boolean
  mode: Mode
  initialCamera: { latitude: number; longitude: number; zoom: number } | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onFocusGroup: (ids: string[]) => void
  onViewChange: (bounds: Bounds | null, camera: string, userInitiated: boolean) => void
}

const clusterRadius = (n: number) => Math.min(13 + Math.sqrt(n) * 3.4, 42)
const shortCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))

export const JobMap = memo(function JobMap(props: JobMapProps) {
  const { points, byId, selectedId, hoveredId, layer, globe, mode, onHover, onSelect, onFocusGroup, onViewChange } =
    props
  const padding = useCameraPadding()
  const camera = useCamera()
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(() => Math.floor(props.initialCamera?.zoom ?? 1.5))
  const [tip, setTip] = useState<Tip | null>(null)
  const tokens = MAP_TOKENS[mode]

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps, ClusterProps>({
      radius: 54,
      maxZoom: CLUSTER_MAX_ZOOM,
      map: (p) => Object.fromEntries(CATEGORY_IDS.map((c) => [c, p.category === c ? 1 : 0])) as ClusterProps,
      reduce: (acc, p) => {
        for (const c of CATEGORY_IDS) acc[c] += p[c]
      },
    })
    sc.load(
      points.map(
        (v): PointF => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [v.lng, v.lat] },
          properties: { id: v.id, category: v.category },
        }),
      ),
    )
    return sc
  }, [points])

  const { clusters, singles } = useMemo(() => {
    const all = index.getClusters([-180, -85, 180, 85], zoom)
    const clusters: ClusterF[] = []
    const singles: PointF[] = []
    for (const f of all) {
      if ("cluster" in f.properties && f.properties.cluster) clusters.push(f as ClusterF)
      else singles.push(f as PointF)
    }
    return { clusters, singles }
  }, [index, zoom])

  const highlighted = useMemo(() => {
    const out: Array<{ v: Vacancy; selected: boolean }> = []
    const sel = selectedId ? byId.get(selectedId) : undefined
    const hov = hoveredId && hoveredId !== selectedId ? byId.get(hoveredId) : undefined
    if (hov) out.push({ v: hov, selected: false })
    if (sel) out.push({ v: sel, selected: true })
    return out
  }, [byId, selectedId, hoveredId])

  const layers = useMemo(() => {
    const surface = tokens.surface
    const highlightLayers = [
      new ScatterplotLayer<{ v: Vacancy; selected: boolean }>({
        id: "halo",
        data: highlighted,
        getPosition: (d) => [d.v.lng, d.v.lat],
        getRadius: (d) => (d.selected ? 20 : 14),
        radiusUnits: "pixels",
        getFillColor: (d) => categoryRgba(d.v.category, mode, 64),
        updateTriggers: { getFillColor: mode },
      }),
      new ScatterplotLayer<{ v: Vacancy; selected: boolean }>({
        id: "focus",
        data: highlighted,
        getPosition: (d) => [d.v.lng, d.v.lat],
        getRadius: (d) => (d.selected ? 9 : 7.5),
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2.5,
        getLineColor: surface,
        getFillColor: (d) => categoryRgba(d.v.category, mode),
        updateTriggers: { getFillColor: mode, getLineColor: mode },
      }),
    ]

    if (layer === "density") {
      return [
        new HeatmapLayer<Vacancy>({
          id: "density",
          data: points,
          getPosition: (v) => [v.lng, v.lat],
          getWeight: 1,
          radiusPixels: 42,
          intensity: 1.1,
          threshold: 0.04,
          colorRange: DENSITY_RAMP,
        }),
        new ScatterplotLayer<Vacancy>({
          id: "points",
          data: zoom >= 5 ? points : [],
          pickable: true,
          getPosition: (v) => [v.lng, v.lat],
          getRadius: 3.5,
          radiusUnits: "pixels",
          stroked: true,
          lineWidthUnits: "pixels",
          getLineWidth: 1.5,
          getLineColor: surface,
          getFillColor: (v) => categoryRgba(v.category, mode),
          updateTriggers: { getFillColor: mode, getLineColor: mode },
        }),
        ...highlightLayers,
      ]
    }

    return [
      new ScatterplotLayer<ClusterF>({
        id: "clusters",
        data: clusters,
        pickable: true,
        getPosition: (f) => f.geometry.coordinates as [number, number],
        getRadius: (f) => clusterRadius(f.properties.point_count),
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        getLineColor: surface,
        getFillColor: tokens.cluster,
        updateTriggers: { getFillColor: mode, getLineColor: mode },
      }),
      new TextLayer<ClusterF>({
        id: "cluster-labels",
        data: clusters,
        getPosition: (f) => f.geometry.coordinates as [number, number],
        getText: (f) => shortCount(f.properties.point_count),
        getSize: 12,
        getColor: tokens.clusterText,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontWeight: 600,
        characterSet: "0123456789.k",
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        updateTriggers: { getColor: mode },
      }),
      new ScatterplotLayer<PointF>({
        id: "points",
        data: singles,
        pickable: true,
        getPosition: (f) => f.geometry.coordinates as [number, number],
        getRadius: 6,
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        getLineColor: surface,
        getFillColor: (f) => categoryRgba(f.properties.category, mode),
        updateTriggers: { getFillColor: mode, getLineColor: mode },
      }),
      ...highlightLayers,
    ]
  }, [layer, points, clusters, singles, highlighted, mode, tokens, zoom])

  const pointId = (info: PickingInfo) => {
    const o = info.object as PointF | Vacancy | undefined
    if (!o) return null
    return "properties" in o ? o.properties.id : o.id
  }

  const handleHover = useCallback(
    (info: PickingInfo) => {
      const canvas = containerRef.current?.querySelector("canvas")
      if (canvas) canvas.style.cursor = info.picked ? "pointer" : ""
      if (!info.picked || !info.layer) {
        setTip(null)
        onHover(null)
        return
      }
      if (info.layer.id === "points") {
        const v = byId.get(pointId(info) ?? "")
        if (v) {
          setTip({ kind: "point", v, x: info.x, y: info.y })
          onHover(v.id)
        }
        return
      }
      if (info.layer.id === "clusters") {
        const f = info.object as ClusterF
        const leaves = index.getLeaves(f.properties.cluster_id, 40)
        const names = [...new Set(leaves.map((l) => byId.get(l.properties.id)?.institution).filter(Boolean))] as string[]
        setTip({ kind: "cluster", count: f.properties.point_count, breakdown: f.properties, names, x: info.x, y: info.y })
        onHover(null)
      }
    },
    [byId, index, onHover],
  )

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (!info.picked || !info.layer) return
      setTip(null)
      if (info.layer.id === "points") {
        const id = pointId(info)
        if (id) onSelect(id)
        return
      }
      if (info.layer.id === "clusters") {
        const f = info.object as ClusterF
        const [lng, lat] = f.geometry.coordinates
        const expansion = index.getClusterExpansionZoom(f.properties.cluster_id)
        if (expansion > CLUSTER_MAX_ZOOM) {
          // Several positions at one address: zooming can't separate them, so list them instead.
          onFocusGroup(index.getLeaves(f.properties.cluster_id, Infinity).map((l) => l.properties.id))
          camera.easeTo(lng, lat, Math.max(camera.getZoom(), 11))
        } else {
          camera.easeTo(lng, lat, Math.min(expansion + 0.4, 16))
        }
      }
    },
    [camera, index, onFocusGroup, onSelect],
  )

  const handleMove = useCallback((e: ViewStateChangeEvent) => setZoom(Math.floor(e.viewState.zoom)), [])

  const emitView = useCallback(
    (m: MaplibreMap, userInitiated: boolean) => {
      const { lat, lng } = m.getCenter()
      const z = m.getZoom()
      const cameraStr = `${lat.toFixed(3)},${lng.toFixed(3)},${z.toFixed(2)}`
      // Bounds of the *unobstructed* viewport: what the user can actually see between the panels.
      let bounds: Bounds | null = null
      if (z >= 2.2) {
        const { clientWidth: w, clientHeight: h } = m.getContainer()
        const nw = m.unproject([Math.min(padding.left, w * 0.5), Math.min(padding.top, h * 0.4)])
        const se = m.unproject([Math.max(w - padding.right, w * 0.5), Math.max(h - padding.bottom, h * 0.6)])
        if ([nw.lng, nw.lat, se.lng, se.lat].every(Number.isFinite)) {
          let east = se.lng
          if (east < nw.lng) east += 360
          bounds = [nw.lng, se.lat, east, nw.lat]
        }
      }
      onViewChange(bounds, cameraStr, userInitiated)
    },
    [onViewChange, padding],
  )

  const initialViewState = useMemo(
    () =>
      props.initialCamera ?? {
        bounds: [
          [WORLD_BOUNDS[0], WORLD_BOUNDS[1]],
          [WORLD_BOUNDS[2], WORLD_BOUNDS[3]],
        ] as [[number, number], [number, number]],
        fitBoundsOptions: { padding },
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div ref={containerRef} className="absolute inset-0" onMouseLeave={() => setTip(null)}>
      <MapGL
        id="main"
        mapStyle={BASEMAP[mode]}
        initialViewState={initialViewState}
        minZoom={0.6}
        maxZoom={16}
        renderWorldCopies={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        projection={globe ? "globe" : "mercator"}
        attributionControl={{ compact: true }}
        onMove={handleMove}
        onMoveEnd={(e) => emitView(e.target, "originalEvent" in e && !!e.originalEvent)}
        onLoad={(e) => emitView(e.target, false)}
        style={{ position: "absolute", inset: 0 }}
      >
        <DeckOverlay interleaved layers={layers} onHover={handleHover} onClick={handleClick} pickingRadius={8} />
      </MapGL>
      {tip && <MapTooltip tip={tip} mode={mode} container={containerRef.current} />}
    </div>
  )
})

function MapTooltip({ tip, mode, container }: { tip: Tip; mode: Mode; container: HTMLDivElement | null }) {
  const w = container?.clientWidth ?? 1000
  const h = container?.clientHeight ?? 800
  const left = tip.x > w - 300 ? tip.x - 284 : tip.x + 16
  const top = tip.y > h - 200 ? tip.y - 150 : tip.y + 16
  return (
    <div
      role="tooltip"
      className="surface-float pointer-events-none absolute z-20 w-[268px] rounded-xl p-3 text-xs animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left, top }}
    >
      {tip.kind === "point" ? (
        <>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ background: CATEGORY_BY_ID[tip.v.category].color[mode] }}
              aria-hidden
            />
            {CATEGORY_BY_ID[tip.v.category].label}
          </div>
          <div className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">{tip.v.title}</div>
          <div className="mt-0.5 truncate text-muted-foreground">{tip.v.institution}</div>
          <div className="mt-2 flex items-center justify-between">
            <DeadlineText deadline={tip.v.deadline} />
            <span className="text-muted-foreground">Click for details</span>
          </div>
          <span className="sr-only">{deadlineLabel(tip.v.deadline)}</span>
        </>
      ) : (
        <ClusterTip tip={tip} mode={mode} />
      )}
    </div>
  )
}

function ClusterTip({ tip, mode }: { tip: Extract<Tip, { kind: "cluster" }>; mode: Mode }) {
  const parts = CATEGORIES.filter((c) => tip.breakdown[c.id] > 0)
  return (
    <>
      <div className="text-[13px] font-semibold text-foreground">
        {tip.count} positions <span className="font-normal text-muted-foreground">in this area</span>
      </div>
      <div className="mt-2 flex h-2 w-full gap-[2px]" aria-hidden>
        {parts.map((c) => (
          <div
            key={c.id}
            className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
            style={{ flexGrow: tip.breakdown[c.id], background: c.color[mode] }}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-0.5">
        {parts.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5 text-foreground/80">
            <span className="size-2 rounded-full" style={{ background: c.color[mode] }} aria-hidden />
            {c.label}
            <span className="ml-auto tabular-nums text-muted-foreground">{tip.breakdown[c.id]}</span>
          </li>
        ))}
      </ul>
      {tip.names.length > 0 && (
        <div className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">
          <span className="line-clamp-2">
            {tip.names.slice(0, 3).join(" · ")}
            {tip.names.length > 3 ? ` +${tip.names.length - 3} more` : ""}
          </span>
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">Click to zoom in</div>
    </>
  )
}
