<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import maplibregl from "maplibre-gl"
import { MapboxOverlay } from "@deck.gl/mapbox"
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers"
import type { PickingInfo } from "@deck.gl/core"
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster"
import { WORLD_BOUNDS, type Bounds } from "@/domain/geo"
import { CATEGORY_IDS, type Category, type Vacancy } from "@/domain/vacancy"
import { BASEMAP, MAP_TOKENS, categoryRgba, type Mode } from "@/lib/colors"
import { useCamera, useMapContext } from "./camera"
import MapTooltip from "./MapTooltip.vue"
import type { Counts, Tip } from "./types"

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
const clusterRadius = (n: number) => Math.min(12 + Math.sqrt(n) * 2.6, 34)
const shortCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))

const props = defineProps<{
  points: Vacancy[]
  byId: Map<string, Vacancy>
  selectedId?: string
  hoveredId: string | null
  globe: boolean
  mode: Mode
  initialCamera: { latitude: number; longitude: number; zoom: number } | null
}>()

const emit = defineEmits<{
  hover: [id: string | null]
  select: [id: string]
  focusGroup: [ids: string[]]
  viewChange: [bounds: Bounds | null, camera: string, userInitiated: boolean]
}>()

const ctx = useMapContext()
const camera = useCamera(ctx)
const root = ref<HTMLDivElement | null>(null)
const container = ref<HTMLDivElement | null>(null)
const zoom = ref(Math.floor(props.initialCamera?.zoom ?? 1.5))
const tip = shallowRef<Tip | null>(null)
const tokens = computed(() => MAP_TOKENS[props.mode])

const sites = computed(() => {
  const byKey = new Map<string, Site>()
  for (const v of props.points) {
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
})
const siteOf = computed(() => new Map(sites.value.flatMap((s) => s.ids.map((id) => [id, s] as const))))

const index = computed(() => {
  const list = sites.value
  const sc = new Supercluster<SiteProps, ClusterProps>({
    ...CLUSTER,
    map: ({ i }) => ({ ...list[i]!.counts, n: list[i]!.ids.length }),
    reduce: (acc, p) => {
      for (const c of CATEGORY_IDS) acc[c] += p[c]
      acc.n += p.n
    },
  })
  sc.load(
    list.map((s, i): SiteF => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { i } })),
  )
  return sc
})

const view = computed(() => {
  const list = sites.value
  const clusters: ClusterF[] = []
  const pins: Site[] = []
  const clusterOf = new Map<Site, ClusterF>()
  for (const f of index.value.getClusters([-180, -85, 180, 85], zoom.value)) {
    if ("cluster" in f.properties && f.properties.cluster) {
      const c = f as ClusterF
      clusters.push(c)
      for (const leaf of index.value.getLeaves(c.properties.cluster_id, Infinity)) clusterOf.set(list[leaf.properties.i]!, c)
    } else pins.push(list[(f as SiteF).properties.i]!)
  }
  return { clusters, pins, stacks: pins.filter((s) => s.ids.length > 1), clusterOf }
})

const leafIds = (clusterId: number, limit: number) =>
  index.value.getLeaves(clusterId, limit).flatMap((l) => sites.value[l.properties.i]!.ids)

// Hover and selection are drawn as crisp ink rings separated from the mark by a surface gap,
// never as translucent washes. A hovered listing inside a cluster rings the cluster instead of
// painting a dot over it; the selection always stands on its own pin.
const highlight = computed(() => {
  const rings: Array<{ position: [number, number]; radius: number; width: number }> = []
  const focus: Array<{ v: Vacancy; radius: number }> = []
  const hov = props.hoveredId && props.hoveredId !== props.selectedId ? props.byId.get(props.hoveredId) : undefined
  const sel = props.selectedId ? props.byId.get(props.selectedId) : undefined
  if (hov) {
    const site = siteOf.value.get(hov.id)
    const cluster = site ? view.value.clusterOf.get(site) : undefined
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
})

const layers = computed(() => {
  const { clusters, pins, stacks } = view.value
  const { rings, focus } = highlight.value
  const t = tokens.value
  const mode = props.mode
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
      getLineColor: t.surface,
      getFillColor: t.cluster,
      updateTriggers: { getFillColor: mode, getLineColor: mode },
    }),
    new TextLayer<ClusterF>({
      id: "cluster-labels",
      data: clusters,
      getPosition: (f) => f.geometry.coordinates as [number, number],
      getText: (f) => shortCount(f.properties.n),
      getSize: 12,
      getColor: t.clusterText,
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
      getLineColor: t.surface,
      getFillColor: (s) => categoryRgba(s.top, mode),
      updateTriggers: { getFillColor: mode, getLineColor: mode },
    }),
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
      getLineColor: t.cluster,
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
      getLineColor: t.surface,
      getFillColor: (d) => categoryRgba(d.v.category, mode),
      updateTriggers: { getFillColor: mode, getLineColor: mode },
    }),
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
      getColor: t.clusterText,
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      fontWeight: 700,
      characterSet: "0123456789.k",
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      background: true,
      getBackgroundColor: t.cluster,
      getBorderColor: t.surface,
      getBorderWidth: 1.5,
      backgroundPadding: [5, 2, 5, 2],
      backgroundBorderRadius: 8,
      updateTriggers: { getColor: mode, getBackgroundColor: mode, getBorderColor: mode },
    }),
  ]
})

function groupTip(ids: string[], counts: ClusterProps, where: string | null, hint: string, approx?: boolean) {
  const vs = ids.map((id) => props.byId.get(id)).filter((v): v is Vacancy => !!v)
  let names = [...new Set(vs.map((v) => v.institution))]
  if (!where) {
    // A place: name it by its one institution, or by its city when several share the pin
    where = `at ${names.length === 1 ? names[0] : (vs[0]?.city ?? vs[0]?.country ?? "this place")}`
    if (names.length === 1) names = []
  }
  return { kind: "group" as const, count: counts.n, breakdown: counts, names, where, hint, approx }
}

function onHover(info: PickingInfo) {
  const canvas = ctx.map.value?.getCanvas()
  if (canvas) canvas.style.cursor = info.picked ? "pointer" : ""
  if (!info.picked || !info.layer) {
    tip.value = null
    emit("hover", null)
    return
  }
  const { x, y } = info
  const id = info.layer.id
  const site = id === "sites" || id === "site-badges" ? (info.object as Site) : null
  const v = site?.ids.length === 1 ? props.byId.get(site.ids[0]!) : undefined
  if (v) {
    tip.value = { kind: "point", v, x, y }
    emit("hover", v.id)
  } else if (site) {
    const counts = { ...site.counts, n: site.ids.length }
    tip.value = { ...groupTip(site.ids, counts, null, "Click to list them", site.approx), x, y }
    emit("hover", null)
  } else if (id === "clusters") {
    const f = info.object as ClusterF
    // Names are sampled from the first leaves; count and breakdown cover the whole cluster
    tip.value = { ...groupTip(leafIds(f.properties.cluster_id, 40), f.properties, "in this area", "Click to zoom in"), x, y }
    emit("hover", null)
  }
}

function onClick(info: PickingInfo) {
  if (!info.picked || !info.layer) return
  tip.value = null
  const id = info.layer.id
  if (id === "sites" || id === "site-badges") {
    // Zooming can't separate positions that share a coordinate, so list them instead
    const s = info.object as Site
    if (s.ids.length === 1) emit("select", s.ids[0]!)
    else {
      emit("focusGroup", s.ids)
      camera.reveal(s.lng, s.lat)
    }
  } else if (id === "clusters") {
    const f = info.object as ClusterF
    const [lng, lat] = f.geometry.coordinates as [number, number]
    camera.easeTo(lng, lat, Math.min(index.value.getClusterExpansionZoom(f.properties.cluster_id) + 0.4, 16))
  }
}

function emitView(m: maplibregl.Map, userInitiated: boolean) {
  const { lat, lng } = m.getCenter()
  const z = m.getZoom()
  const cameraStr = `${lat.toFixed(3)},${lng.toFixed(3)},${z.toFixed(2)}`
  // Bounds of the *unobstructed* viewport: what the user can actually see between the panels.
  let bounds: Bounds | null = null
  if (z >= 2.2) {
    const padding = ctx.padding.value
    const { clientWidth: w, clientHeight: h } = m.getContainer()
    const nw = m.unproject([Math.min(padding.left, w * 0.5), Math.min(padding.top, h * 0.4)])
    const se = m.unproject([Math.max(w - padding.right, w * 0.5), Math.max(h - padding.bottom, h * 0.6)])
    if ([nw.lng, nw.lat, se.lng, se.lat].every(Number.isFinite)) {
      let east = se.lng
      if (east < nw.lng) east += 360
      bounds = [nw.lng, se.lat, east, nw.lat]
    }
  }
  emit("viewChange", bounds, cameraStr, userInitiated)
}

let overlay: MapboxOverlay | null = null

// A style swap (theme change) resets the projection to the style's own, so re-assert it whenever the style
// changes. MapLibre throws while a style is still loading; the next `styledata` event retries.
function applyProjection() {
  const m = ctx.map.value
  const type = props.globe ? "globe" : "mercator"
  if (!m || (m.getProjection()?.type ?? "mercator") === type) return
  try {
    m.setProjection({ type })
  } catch {
    /* style not loaded yet */
  }
}

onMounted(() => {
  const cam = props.initialCamera
  const m = new maplibregl.Map({
    container: container.value!,
    style: BASEMAP[props.mode],
    ...(cam
      ? { center: [cam.longitude, cam.latitude] as [number, number], zoom: cam.zoom }
      : {
          bounds: [
            [WORLD_BOUNDS[0], WORLD_BOUNDS[1]],
            [WORLD_BOUNDS[2], WORLD_BOUNDS[3]],
          ] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: ctx.padding.value },
        }),
    minZoom: 0.6,
    maxZoom: 16,
    renderWorldCopies: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
  })
  m.touchZoomRotate.disableRotation()
  overlay = new MapboxOverlay({ interleaved: true, layers: layers.value, onHover, onClick, pickingRadius: 8 })
  m.addControl(overlay)
  m.on("styledata", applyProjection)
  m.on("move", () => (zoom.value = Math.floor(m.getZoom())))
  m.on("moveend", (e) => emitView(m, !!(e as { originalEvent?: unknown }).originalEvent))
  m.on("load", () => emitView(m, false))
  ctx.map.value = m
})

onBeforeUnmount(() => {
  const m = ctx.map.value
  ctx.map.value = null
  if (m && overlay) m.removeControl(overlay)
  overlay = null
  m?.remove()
})

watch(layers, (l) => overlay?.setProps({ layers: l }))
watch(
  () => props.mode,
  (mode) => ctx.map.value?.setStyle(BASEMAP[mode]),
)
watch(() => props.globe, applyProjection)
</script>

<template>
  <div ref="root" class="absolute inset-0" @mouseleave="tip = null">
    <!-- Sized, not positioned: MapLibre's own (unlayered) CSS makes its container position: relative -->
    <div ref="container" class="h-full w-full" />
    <MapTooltip v-if="tip" :tip="tip" :mode="mode" :container="root" />
  </div>
</template>
