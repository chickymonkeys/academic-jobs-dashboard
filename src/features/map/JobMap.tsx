import { memo, useCallback, useMemo, useRef, useState } from "react"
import MapGL, { useControl, type ViewStateChangeEvent } from "react-map-gl/maplibre"
import type { IControl, Map as MaplibreMap } from "maplibre-gl"
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox"
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers"
import type { PickingInfo } from "@deck.gl/core"
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster"
import { CATEGORIES, CATEGORY_BY_ID } from "@/domain/taxonomy"
import { WORLD_BOUNDS, type Bounds } from "@/domain/geo"
import { CATEGORY_IDS, type Category, type Vacancy } from "@/domain/vacancy"
import { BASEMAP, MAP_TOKENS, categoryRgba, type Mode } from "@/lib/colors"
import { deadlineLabel } from "@/lib/dates"
import { DeadlineText } from "@/components/job-atoms"
import { useCameraPadding, useCamera } from "./camera"

type Counts = Record<Category, number>
/** Every position at one coordinate. Many share one: same institution, or a city-level geocode. */
type Site = { lng: number; lat: number; ids: string[]; counts: Counts; top: Category; approx: boolean }
type SiteProps = { i: number }
type ClusterProps = Counts & { n: number }
type SiteF = PointFeature<SiteProps>
type ClusterF = ClusterFeature<ClusterProps>

// Clusters group *sites*, not listings, and only while sites are genuinely crowded:
// from zoom 10 every place is its own pin, so the map never shows an unexplained bubble up close.
const CLUSTER = { radius: 32, maxZoom: 9, minPoints: 3 } as const

const zeroCounts = () => Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Counts

type Tip = { x: number; y: number } & (
  | { kind: "point"; v: Vacancy }
  | { kind: "group"; count: number; breakdown: Counts; names: string[]; where: string; hint: string; approx?: boolean }
)

// deck.gl shares MapLibre's WebGL context. When the overlay is added twice in quick succession
// (React's dev double-mount), both attach() calls race and luma.gl throws on the loser unless it may
// reuse the device already bound to the context; Firefox's timing hits this every load.
const DEVICE_PROPS = { _reuseDevices: true }

function DeckOverlay(props: MapboxOverlayProps) {
  const all = { ...props, deviceProps: DEVICE_PROPS }
  const overlay = useControl(() => new MapboxOverlay(all) as unknown as IControl) as unknown as MapboxOverlay
  overlay.setProps(all)
  return null
}

export type JobMapProps = {
  points: Vacancy[]
  byId: Map<string, Vacancy>
  selectedId?: string
  hoveredId: string | null
  globe: boolean
  mode: Mode
  initialCamera: { latitude: number; longitude: number; zoom: number } | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onFocusGroup: (ids: string[]) => void
  onViewChange: (bounds: Bounds | null, camera: string, userInitiated: boolean) => void
}

const clusterRadius = (n: number) => Math.min(12 + Math.sqrt(n) * 2.6, 34)
const shortCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))

export const JobMap = memo(function JobMap(props: JobMapProps) {
  const { points, byId, selectedId, hoveredId, globe, mode, onHover, onSelect, onFocusGroup, onViewChange } =
    props
  const padding = useCameraPadding()
  const camera = useCamera()
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(() => Math.floor(props.initialCamera?.zoom ?? 1.5))
  const [tip, setTip] = useState<Tip | null>(null)
  const tokens = MAP_TOKENS[mode]

  const sites = useMemo(() => {
    const byKey = new Map<string, Site>()
    for (const v of points) {
      const key = `${v.lng.toFixed(4)},${v.lat.toFixed(4)}`
      let s = byKey.get(key)
      if (!s) {
        s = { lng: v.lng, lat: v.lat, ids: [], counts: zeroCounts(), top: v.category, approx: false }
        byKey.set(key, s)
      }
      s.ids.push(v.id)
      s.counts[v.category]++
      if (s.counts[v.category] > s.counts[s.top]) s.top = v.category
      if (v.geoPrecision !== "exact") s.approx = true
    }
    return [...byKey.values()]
  }, [points])
  const siteOf = useMemo(() => new Map(sites.flatMap((s) => s.ids.map((id) => [id, s] as const))), [sites])

  const index = useMemo(() => {
    const sc = new Supercluster<SiteProps, ClusterProps>({
      ...CLUSTER,
      map: ({ i }) => ({ ...sites[i].counts, n: sites[i].ids.length }),
      reduce: (acc, p) => {
        for (const c of CATEGORY_IDS) acc[c] += p[c]
        acc.n += p.n
      },
    })
    sc.load(
      sites.map(
        (s, i): SiteF => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { i } }),
      ),
    )
    return sc
  }, [sites])

  const { clusters, pins, stacks, clusterOf } = useMemo(() => {
    const clusters: ClusterF[] = []
    const pins: Site[] = []
    const clusterOf = new Map<Site, ClusterF>()
    for (const f of index.getClusters([-180, -85, 180, 85], zoom)) {
      if ("cluster" in f.properties && f.properties.cluster) {
        const c = f as ClusterF
        clusters.push(c)
        for (const leaf of index.getLeaves(c.properties.cluster_id, Infinity)) clusterOf.set(sites[leaf.properties.i], c)
      } else pins.push(sites[(f as SiteF).properties.i])
    }
    return { clusters, pins, stacks: pins.filter((s) => s.ids.length > 1), clusterOf }
  }, [index, sites, zoom])

  const leafIds = useCallback(
    (clusterId: number, limit: number) => index.getLeaves(clusterId, limit).flatMap((l) => sites[l.properties.i].ids),
    [index, sites],
  )

  // Hover and selection are drawn as crisp ink rings separated from the mark by a surface gap,
  // never as translucent washes. A hovered listing inside a cluster rings the cluster instead of
  // painting a dot over it; the selection always stands on its own pin.
  const { rings, focus } = useMemo(() => {
    const rings: Array<{ position: [number, number]; radius: number; width: number }> = []
    const focus: Array<{ v: Vacancy; radius: number }> = []
    const hov = hoveredId && hoveredId !== selectedId ? byId.get(hoveredId) : undefined
    const sel = selectedId ? byId.get(selectedId) : undefined
    if (hov) {
      const site = siteOf.get(hov.id)
      const cluster = site ? clusterOf.get(site) : undefined
      if (cluster) {
        const position = cluster.geometry.coordinates as [number, number]
        rings.push({ position, radius: clusterRadius(cluster.properties.n) + 5, width: 2 })
      } else {
        rings.push({ position: [hov.lng, hov.lat], radius: (site && site.ids.length > 1 ? 8 : 7) + 5, width: 2 })
      }
    }
    if (sel) {
      focus.push({ v: sel, radius: 8.5 })
      rings.push({ position: [sel.lng, sel.lat], radius: 14, width: 2.5 })
    }
    return { rings, focus }
  }, [byId, selectedId, hoveredId, siteOf, clusterOf])

  const layers = useMemo(() => {
    const surface = tokens.surface
    const highlightLayers = [
      new ScatterplotLayer<(typeof rings)[number]>({
        id: "rings",
        data: rings,
        getPosition: (d) => d.position,
        getRadius: (d) => d.radius,
        radiusUnits: "pixels",
        filled: false,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: (d) => d.width,
        getLineColor: tokens.cluster,
        updateTriggers: { getLineColor: mode },
      }),
      new ScatterplotLayer<(typeof focus)[number]>({
        id: "focus",
        data: focus,
        getPosition: (d) => [d.v.lng, d.v.lat],
        getRadius: (d) => d.radius,
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2.5,
        getLineColor: surface,
        getFillColor: (d) => categoryRgba(d.v.category, mode),
        updateTriggers: { getFillColor: mode, getLineColor: mode },
      }),
    ]

    return [
      new ScatterplotLayer<ClusterF>({
        id: "clusters",
        data: clusters,
        pickable: true,
        getPosition: (f) => f.geometry.coordinates as [number, number],
        getRadius: (f) => clusterRadius(f.properties.n),
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
        getText: (f) => shortCount(f.properties.n),
        getSize: 12,
        getColor: tokens.clusterText,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontWeight: 600,
        characterSet: "0123456789.k",
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        updateTriggers: { getColor: mode },
      }),
      new ScatterplotLayer<Site>({
        id: "sites",
        data: pins,
        pickable: true,
        getPosition: (s) => [s.lng, s.lat],
        getRadius: (s) => (s.ids.length > 1 ? 8 : 7),
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        getLineColor: surface,
        getFillColor: (s) => categoryRgba(s.top, mode),
        updateTriggers: { getFillColor: mode, getLineColor: mode },
      }),
      ...highlightLayers,
      // Count badge on places holding several positions, in the same ink as clusters; drawn last
      // so neither rings nor the selected pin ever cut through a count
      new TextLayer<Site>({
        id: "site-badges",
        data: stacks,
        pickable: true,
        getPosition: (s) => [s.lng, s.lat],
        getText: (s) => shortCount(s.ids.length),
        getPixelOffset: [11, -11],
        getSize: 11,
        getColor: tokens.clusterText,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontWeight: 700,
        characterSet: "0123456789.k",
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        background: true,
        getBackgroundColor: tokens.cluster,
        getBorderColor: surface,
        getBorderWidth: 1.5,
        backgroundPadding: [5, 2, 5, 2],
        backgroundBorderRadius: 8,
        updateTriggers: { getColor: mode, getBackgroundColor: mode, getBorderColor: mode },
      }),
    ]
  }, [clusters, pins, stacks, rings, focus, mode, tokens])

  const groupTip = useCallback(
    (ids: string[], counts: ClusterProps, where: string | null, hint: string, approx?: boolean) => {
      const vs = ids.map((id) => byId.get(id)).filter((v): v is Vacancy => !!v)
      let names = [...new Set(vs.map((v) => v.institution))]
      if (!where) {
        // A place: name it by its one institution, or by its city when several share the pin
        where = `at ${names.length === 1 ? names[0] : (vs[0]?.city ?? vs[0]?.country ?? "this place")}`
        if (names.length === 1) names = []
      }
      return { kind: "group" as const, count: counts.n, breakdown: counts, names, where, hint, approx }
    },
    [byId],
  )

  const handleHover = useCallback(
    (info: PickingInfo) => {
      const canvas = containerRef.current?.querySelector("canvas")
      if (canvas) canvas.style.cursor = info.picked ? "pointer" : ""
      if (!info.picked || !info.layer) {
        setTip(null)
        onHover(null)
        return
      }
      const { x, y } = info
      const id = info.layer.id
      const site = id === "sites" || id === "site-badges" ? (info.object as Site) : null
      const v = site?.ids.length === 1 ? byId.get(site.ids[0]) : undefined
      if (v) {
        setTip({ kind: "point", v, x, y })
        onHover(v.id)
      } else if (site) {
        const counts = { ...site.counts, n: site.ids.length }
        setTip({ ...groupTip(site.ids, counts, null, "Click to list them", site.approx), x, y })
        onHover(null)
      } else if (id === "clusters") {
        const f = info.object as ClusterF
        // Names are sampled from the first leaves; count and breakdown cover the whole cluster
        setTip({ ...groupTip(leafIds(f.properties.cluster_id, 40), f.properties, "in this area", "Click to zoom in"), x, y })
        onHover(null)
      }
    },
    [byId, groupTip, leafIds, onHover],
  )

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (!info.picked || !info.layer) return
      setTip(null)
      const id = info.layer.id
      if (id === "sites" || id === "site-badges") {
        // Zooming can't separate positions that share a coordinate, so list them instead
        const s = info.object as Site
        if (s.ids.length === 1) onSelect(s.ids[0])
        else {
          onFocusGroup(s.ids)
          camera.reveal(s.lng, s.lat)
        }
      } else if (id === "clusters") {
        const f = info.object as ClusterF
        const [lng, lat] = f.geometry.coordinates
        camera.easeTo(lng, lat, Math.min(index.getClusterExpansionZoom(f.properties.cluster_id) + 0.4, 16))
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
        projection={{ type: globe ? "globe" : "mercator" }}
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
        <GroupTip tip={tip} mode={mode} />
      )}
    </div>
  )
}

function GroupTip({ tip, mode }: { tip: Extract<Tip, { kind: "group" }>; mode: Mode }) {
  const parts = CATEGORIES.filter((c) => tip.breakdown[c.id] > 0)
  return (
    <>
      <div className="line-clamp-2 text-[13px] font-semibold text-foreground">
        {tip.count} positions <span className="font-normal text-muted-foreground">{tip.where}</span>
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
      {tip.approx && (
        <div className="mt-2 text-[11px] text-muted-foreground">Pinned to the city, not the exact address</div>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">{tip.hint}</div>
    </>
  )
}
