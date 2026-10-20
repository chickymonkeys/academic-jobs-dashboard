<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useDebounceFn, useElementBounding, useEventListener, useWindowSize } from "@vueuse/core"
import { list, parseCamera, toggleIn, useAppSearch } from "@/app/search"
import { useVacancies } from "@/data/use-vacancies"
import { WORLD_REGIONS, type Bounds } from "@/domain/geo"
import type { RegionId, Vacancy } from "@/domain/vacancy"
import {
  applyFilters,
  buildIndex,
  facetCounts,
  filtersFrom,
  haversine,
  inBounds,
  sortResults,
  type Scope,
  type SortKey,
} from "@/features/filters/filtering"
import FilterBar from "@/features/filters/FilterBar.vue"
import JobDetail from "@/features/detail/JobDetail.vue"
import { provideMapContext, useCamera, type Padding } from "@/features/map/camera"
import Legend from "@/features/map/Legend.vue"
import MapControls from "@/features/map/MapControls.vue"
import RegionNav from "@/features/map/RegionNav.vue"
import ResultsHeader from "@/features/results/ResultsHeader.vue"
import ResultsList from "@/features/results/ResultsList.vue"
import SearchBox from "@/features/search/SearchBox.vue"
import { deadlineState, isFresh } from "@/lib/dates"
import { useIsDesktop, useIsWide } from "@/lib/media"
import { useShortlist } from "@/lib/shortlist"
import { useMode } from "@/lib/theme"
import Brand from "./Brand.vue"
import DataStatus from "./DataStatus.vue"
import EmptyResults from "./EmptyResults.vue"
import LoadError from "./LoadError.vue"
import MobileSheet from "./MobileSheet.vue"
import { isPeek, SHEET_W, SNAP_HALF, sheetOffset, usePeekSnap, type Snap } from "./sheet"

// The map engine (deck.gl + MapLibre, the bigger half of the JS) and the desktop-only table load on their own,
// so the search, filters and list are up and usable while they stream in
const JobMap = defineAsyncComponent(() => import("@/features/map/JobMap.vue"))
const ResultsTable = defineAsyncComponent(() => import("@/features/results/ResultsTable.vue"))

const PANEL_W = 404
const TABLE_W = 880
const DETAIL_W = 420
const GAP = 12

const isDesktop = useIsDesktop()
const isWide = useIsWide()
const mode = useMode()
const saved = useShortlist()
const [search, set] = useAppSearch()
const { items, byId, meta, version, isLoading, error, isRefreshing } = useVacancies(() =>
  set({ fresh: true, sort: "newest" }),
)

const bounds = shallowRef<Bounds | null>(null)
const hoveredId = ref<string | null>(null)
const group = shallowRef<{ ids: string[]; label: string } | null>(null)
const peek = usePeekSnap()
const snap = ref<Snap>(search.value.sel ? SNAP_HALF : peek.value)
const topBar = useTemplateRef<HTMLElement>("topBar")
const initialCamera = parseCamera(search.value.at)
const searchBox = useTemplateRef<InstanceType<typeof SearchBox>>("searchBox")
let zoomOnSelect = false

const view = computed(() => (isDesktop.value ? (search.value.view ?? "list") : "list"))
const sortKey = computed<SortKey>(() => search.value.sort ?? (search.value.q ? "relevance" : "deadline"))
const areaOn = computed(() => search.value.area !== false)
const selected = computed(() => (search.value.sel ? byId.value.get(search.value.sel) : undefined))
const region = computed(() => {
  const r = search.value.region
  return r === "world" || WORLD_REGIONS.some((x) => x.id === r) ? (r as RegionId | "world") : null
})

// Camera padding = the panels' footprint, so fits and reveals frame the unobstructed map.
const { height: viewportH } = useWindowSize()
const { bottom: topBarBottom } = useElementBounding(topBar)
const padding = computed<Padding>(() => {
  if (isDesktop.value)
    return {
      left: (view.value === "table" ? TABLE_W : PANEL_W) + GAP * 2,
      right: (selected.value ? DETAIL_W + GAP : 0) + 64,
      top: 64,
      bottom: 48,
    }
  // Wide screens float the sheet as a left-hand column, under the search bar; phones stack it below the map
  if (isWide.value && !isPeek(snap.value)) return { left: SHEET_W + GAP * 2, right: 56, top: 12, bottom: 12 }
  const top = Math.round(topBarBottom.value) + 12
  return { left: 12, right: 56, top, bottom: sheetOffset(snap.value, viewportH.value) + 12 }
})
// Map controls sit under the search bar on phones, and in the free top-right corner on wider screens
const controlsTop = computed(() =>
  isWide.value ? "max(env(safe-area-inset-top), 8px)" : `${Math.round(topBarBottom.value || 104) + 8}px`,
)
watch(peek, (next, prev) => {
  if (snap.value === prev) snap.value = next
})
const mapCtx = provideMapContext(padding)
const camera = useCamera(mapCtx)

// ── Data pipeline: index → filters → facets → viewport scope → sort ──────────────────────
// Filters are keyed by the filter fields only, so camera moves (which rewrite `at`) never refilter.
const filterKey = computed(() => {
  const { q, cat, disc, field, src, dl, closed, saved, fresh } = search.value
  return JSON.stringify({ q, cat, disc, field, src, dl, closed, saved, fresh })
})
const index = computed(() => buildIndex(items.value))
const filters = computed(() => filtersFrom(JSON.parse(filterKey.value)))
const matched = computed(() => applyFilters(index.value, filters.value, saved.value))
const facets = computed(() => facetCounts(index.value, filters.value, saved.value))
const snapshotSources = computed(() => meta.value?.sources.map((s) => s.id))
const mapPoints = computed(() => matched.value.map((x) => x.v))
const regionCounts = computed(() => {
  const c: Partial<Record<RegionId, number>> = {}
  for (const x of matched.value) c[x.v.worldRegion] = (c[x.v.worldRegion] ?? 0) + 1
  return c
})
// The list holds a picked group, else a picked region (exactly what its chip counts), else what the map shows
const rows = computed(() => {
  let r = matched.value
  const reg = region.value
  if (group.value) {
    const ids = new Set(group.value.ids)
    r = r.filter((x) => ids.has(x.v.id))
  } else if (reg && reg !== "world") r = r.filter((x) => x.v.worldRegion === reg)
  else if (!reg && areaOn.value && bounds.value) r = r.filter((x) => inBounds(x.v, bounds.value))
  return sortResults(r, sortKey.value, filters.value.terms)
})
const freshCount = computed(() => items.value.filter((v) => isFresh(v)).length)
const crossListed = computed(() => items.value.filter((v) => v.alsoOn.length > 0).length)

const nearby = computed(() => {
  const s = selected.value
  if (!s) return []
  return items.value
    .filter((v) => v.id !== s.id && deadlineState(v) !== "closed")
    .map((v) => ({ v, km: haversine(s, v) }))
    .filter((x) => x.km < 350)
    .sort((a, b) => a.km - b.km)
    .slice(0, 5)
})

// ── Selection (pushes history once, so Back closes the detail) ─────────────────────────
function select(id: string | null, opts?: { zoom?: boolean }) {
  zoomOnSelect = !!opts?.zoom
  set({ sel: id ?? undefined }, { push: !!id && !search.value.sel })
  if (id && !isDesktop.value && isPeek(snap.value)) snap.value = SNAP_HALF
}
const selectFromList = (id: string) => select(id, { zoom: true })
const selectFromMap = (id: string) => select(id)

// Also once the map arrives: it loads on its own, so a shared listing's data can be ready before there's a map to move
watch(
  [() => selected.value?.id, () => !!mapCtx.map.value],
  () => {
    const s = selected.value
    if (!s) return
    if (zoomOnSelect) {
      zoomOnSelect = false
      camera.easeTo(s.lng, s.lat, Math.max(camera.getZoom(), 5.5))
    } else camera.reveal(s.lng, s.lat)
  },
  { flush: "post" },
)

// The camera rides in the URL once the map settles: Safari throws past 100 history writes in 10 seconds
const writeCamera = useDebounceFn((at: string) => set({ at }), 400)

/** Moving the map yourself (or asking it to move) leaves a picked region or group for "what's in view" */
function onViewChange(b: Bounds | null, cam: string, user: boolean) {
  bounds.value = b
  if (user) {
    group.value = null
    if (search.value.region) set({ region: undefined })
  }
  void writeCamera(cam)
}

function goRegion(id: RegionId | "world") {
  group.value = null
  // Move first: if a fling is still coasting, stopping it ends that move as the user's, which drops any region
  if (id === "world") camera.reset()
  else camera.fitBounds(WORLD_REGIONS.find((r) => r.id === id)!.bounds, 7)
  set({ region: id })
}

const fitResults = () => camera.fitPoints(mapPoints.value, 10, { byUser: true })
const resolve = (ids: string[]) => ids.map((id) => byId.value.get(id)).filter((v): v is Vacancy => !!v)

function onFocusGroup(ids: string[]) {
  const vs = resolve(ids)
  const one = new Set(vs.map((v) => v.institution)).size === 1
  group.value = { ids, label: (one ? vs[0]?.institution : (vs[0]?.city ?? vs[0]?.country)) ?? "this location" }
  if (!isDesktop.value) snap.value = SNAP_HALF
}

// ── Search box actions ──────────────────────────────────────────────────────────────────
function onQuery(q: string) {
  group.value = null
  set({ q: q || undefined })
}
function onPickPlace(ids: string[]) {
  group.value = null
  set({ q: undefined, region: undefined, area: undefined })
  camera.fitPoints(resolve(ids), 10)
}
function onPickInstitution(ids: string[], label: string) {
  set({ q: undefined, region: undefined })
  if (ids.length === 1) return selectFromList(ids[0]!)
  group.value = { ids, label }
  camera.fitPoints(resolve(ids), 12)
}
const onPickDiscipline = (did: string) => set((p) => ({ disc: toggleIn(p.disc, did), q: undefined }))
const onPickField = (fid: string) => set((p) => ({ field: toggleIn(p.field, fid), q: undefined }))

// ── Keyboard: / or ⌘K search · j/k or ↑/↓ step through results · Esc back out · f fit ──
useEventListener(window, "keydown", (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable
  if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
    e.preventDefault()
    searchBox.value?.focus()
    return
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return
  if (t.closest("[role=menu],[role=dialog],[role=listbox],[data-reka-popper-content-wrapper]")) return
  if (e.key === "Escape") {
    if (search.value.sel) select(null)
    else if (group.value) group.value = null
    return
  }
  const down = e.key === "j" || e.key === "ArrowDown"
  const up = e.key === "k" || e.key === "ArrowUp"
  const r = rows.value
  if ((down || up) && r.length) {
    e.preventDefault()
    const i = r.findIndex((x) => x.v.id === search.value.sel)
    const next = down ? Math.min(r.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1)
    select(r[next]!.v.id, { zoom: true })
  } else if (e.key === "f") fitResults()
  else if (e.key === "+" || e.key === "=") camera.zoomBy(1)
  else if (e.key === "-") camera.zoomBy(-1)
})

const scope = computed<Scope>(() => {
  if (group.value) return "group"
  if (region.value) return region.value === "world" ? "world" : "region"
  return !areaOn.value ? "everywhere" : bounds.value ? "area" : "world"
})
const regionLabel = computed(() => WORLD_REGIONS.find((r) => r.id === region.value)?.label)
// The pressed chip names what the list holds: a region, or World whenever the list is worldwide
const activeRegion = computed(() =>
  group.value ? null : (region.value ?? (scope.value === "world" || scope.value === "everywhere" ? "world" : null)),
)
const hasFilters = computed(() => {
  const s = search.value
  return !!s.q || !!s.cat || !!s.disc || !!s.field || !!s.src || !!s.dl || !!s.saved || !!s.fresh
})
const clearSearchAndFilters = () =>
  set({
    q: undefined,
    cat: undefined,
    disc: undefined,
    field: undefined,
    src: undefined,
    dl: undefined,
    saved: undefined,
    fresh: undefined,
  })
const errorMessage = computed(() => (error.value ? String((error.value as Error).message ?? error.value) : ""))

const panelW = computed(() => (view.value === "table" ? TABLE_W : PANEL_W))
const rightInset = computed(() => (selected.value ? DETAIL_W + GAP * 2 : GAP))
</script>

<template>
  <main class="relative h-dvh w-full overflow-hidden">
    <JobMap
      :points="mapPoints"
      :by-id="byId"
      :selected-id="search.sel"
      :hovered-id="hoveredId"
      :globe="!!search.globe"
      :mode="mode"
      :initial-camera="initialCamera"
      @hover="hoveredId = $event"
      @select="selectFromMap"
      @focus-group="onFocusGroup"
      @view-change="onViewChange"
    />

    <!-- Shared pieces, placed differently per layout -->
    <template v-if="isDesktop">
      <aside
        aria-label="Search and results"
        class="surface-float absolute top-3 bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-2xl transition-[width] duration-300 ease-out"
        :style="{ width: `${panelW}px` }"
      >
        <div class="space-y-2.5 p-3">
          <div class="flex items-center justify-between px-1">
            <Brand />
            <DataStatus :meta="meta" :refreshing="isRefreshing" :cross-listed="crossListed" />
          </div>
          <SearchBox
            ref="searchBox"
            :value="search.q ?? ''"
            :items="items"
            @query="onQuery"
            @pick-place="onPickPlace"
            @pick-institution="onPickInstitution"
            @pick-discipline="onPickDiscipline"
            @pick-field="onPickField"
          />
          <FilterBar
            :search="search"
            :set="set"
            :facets="facets"
            :source-ids="snapshotSources"
            :saved-count="saved.size"
            :fresh-count="freshCount"
            class="flex-wrap"
          />
        </div>
        <div class="border-t border-default" />
        <ResultsHeader
          :count="rows.length"
          :total="matched.length"
          :scope="scope"
          :group-label="group?.label"
          :region-label="regionLabel"
          :sort-key="sortKey"
          :has-query="!!search.q"
          :search="search"
          :set="set"
          :show-view-toggle="true"
          @clear-group="group = null"
          @world="goRegion('world')"
        />
        <LoadError v-if="error && !items.length" :message="errorMessage" />
        <ResultsTable
          v-if="view === 'table'"
          :rows="rows"
          :selected-id="search.sel"
          :hovered-id="hoveredId"
          @select="selectFromList"
          @hover="hoveredId = $event"
        />
        <ResultsList
          v-else
          :rows="rows"
          :selected-id="search.sel"
          :hovered-id="hoveredId"
          :loading="isLoading"
          @select="selectFromList"
          @hover="hoveredId = $event"
        >
          <template #empty>
            <EmptyResults :scope="scope" :has-filters="hasFilters" @world="goRegion('world')" @clear="clearSearchAndFilters" />
          </template>
        </ResultsList>
      </aside>

      <div
        class="pointer-events-none absolute top-3 z-10 flex justify-center transition-[right] duration-300"
        :style="{ left: `${panelW + GAP * 2}px`, right: `${rightInset + 56}px` }"
      >
        <RegionNav
          :counts="regionCounts"
          :total="matched.length"
          :active="activeRegion"
          class="surface-float pointer-events-auto max-w-full rounded-full p-1"
          @select="goRegion"
        />
      </div>

      <div class="absolute top-3 z-10 transition-[right] duration-300" :style="{ right: `${rightInset}px` }">
        <MapControls :camera="camera" :globe="!!search.globe" @globe="set({ globe: $event || undefined })" @fit-results="fitResults" />
      </div>

      <div class="absolute bottom-8 z-10 transition-[right] duration-300" :style="{ right: `${rightInset}px` }">
        <Legend :counts="facets.cats" :active="list(search.cat)" @toggle="(id) => set((p) => ({ cat: toggleIn(p.cat, id) }))" />
      </div>

      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-6 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-x-3 opacity-0"
      >
        <aside
          v-if="selected"
          aria-label="Position details"
          class="surface-float absolute top-3 right-3 bottom-3 z-10 overflow-hidden rounded-2xl"
          :style="{ width: `${DETAIL_W}px` }"
        >
          <JobDetail
            :key="selected.id"
            :v="selected"
            :version="version"
            :nearby="nearby"
            variant="panel"
            @close="select(null)"
            @select="selectFromList"
            @show-on-map="camera.flyTo(selected.lng, selected.lat, Math.max(camera.getZoom(), 11))"
          />
        </aside>
      </Transition>
    </template>

    <template v-else>
      <div
        ref="topBar"
        class="pointer-events-none absolute inset-x-0 top-0 z-10 pt-[max(env(safe-area-inset-top),8px)] pr-[max(env(safe-area-inset-right),8px)] pl-[max(env(safe-area-inset-left),8px)] sm:pl-[max(env(safe-area-inset-left),12px)]"
      >
        <div class="space-y-2 sm:max-w-[400px]">
          <div class="surface-float pointer-events-auto rounded-2xl p-1.5">
            <SearchBox
              ref="searchBox"
              :value="search.q ?? ''"
              :items="items"
              @query="onQuery"
              @pick-place="onPickPlace"
              @pick-institution="onPickInstitution"
              @pick-discipline="onPickDiscipline"
              @pick-field="onPickField"
            />
          </div>
          <div class="pointer-events-auto">
            <FilterBar
              :search="search"
              :set="set"
              :facets="facets"
              :source-ids="snapshotSources"
              :saved-count="saved.size"
              :fresh-count="freshCount"
              class="px-0.5 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
            />
          </div>
        </div>
      </div>
      <div class="absolute z-10" :style="{ top: controlsTop, right: 'max(env(safe-area-inset-right), 8px)' }">
        <MapControls
          :camera="camera"
          :globe="!!search.globe"
          compact
          @globe="set({ globe: $event || undefined })"
          @fit-results="fitResults"
        />
      </div>
      <MobileSheet v-model:snap="snap" :peek="peek">
        <JobDetail
          v-if="selected"
          :key="selected.id"
          :v="selected"
          :version="version"
          :nearby="nearby"
          variant="sheet"
          @close="select(null)"
          @select="selectFromList"
          @show-on-map="camera.flyTo(selected.lng, selected.lat, Math.max(camera.getZoom(), 11))"
        />
        <template v-else>
          <ResultsHeader
            :count="rows.length"
            :total="matched.length"
            :scope="scope"
            :group-label="group?.label"
            :region-label="regionLabel"
            :sort-key="sortKey"
            :has-query="!!search.q"
            :search="search"
            :set="set"
            :show-view-toggle="false"
            @clear-group="group = null"
            @world="goRegion('world')"
          />
          <RegionNav
            :counts="regionCounts"
            :total="matched.length"
            :active="activeRegion"
            class="px-3 pb-2"
            @select="goRegion"
          />
          <div class="border-t border-default" />
          <LoadError v-if="error && !items.length" :message="errorMessage" />
          <ResultsList
            :rows="rows"
            :selected-id="search.sel"
            :hovered-id="hoveredId"
            :loading="isLoading"
            @select="selectFromList"
            @hover="hoveredId = $event"
          >
            <template #empty>
              <EmptyResults :scope="scope" :has-filters="hasFilters" @world="goRegion('world')" @clear="clearSearchAndFilters" />
            </template>
          </ResultsList>
        </template>
      </MobileSheet>
    </template>
  </main>
</template>
