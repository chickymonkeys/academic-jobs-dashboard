import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MapProvider } from "react-map-gl/maplibre"
import { SearchX } from "lucide-react"
import { parseCamera, toggleIn, useAppSearch, list } from "@/app/search"
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
  type SortKey,
} from "@/features/filters/filtering"
import { FilterBar } from "@/features/filters/FilterBar"
import { JobDetail } from "@/features/detail/JobDetail"
import { CameraPaddingContext, useCamera, type Padding } from "@/features/map/camera"
import { JobMap } from "@/features/map/JobMap"
import { Legend } from "@/features/map/Legend"
import { MapControls } from "@/features/map/MapControls"
import { RegionNav } from "@/features/map/RegionNav"
import { ResultsHeader } from "@/features/results/ResultsHeader"
import { ResultsList } from "@/features/results/ResultsList"
import { ResultsTable } from "@/features/results/ResultsTable"
import { SearchBox } from "@/features/search/SearchBox"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useIsDesktop } from "@/hooks/use-media-query"
import { daysUntil, isFresh } from "@/lib/dates"
import { useShortlist } from "@/lib/shortlist"
import { useMode } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { DataStatus } from "./DataStatus"
import { MobileSheet, SNAP_HALF, SNAP_PEEK, sheetOffset, type Snap } from "./MobileSheet"

const PANEL_W = 404
const TABLE_W = 880
const DETAIL_W = 420
const GAP = 12

export function Dashboard() {
  const isDesktop = useIsDesktop()
  return (
    <MapProvider>
      <TooltipProvider delayDuration={350}>
        <Workspace />
        <Toaster position={isDesktop ? "bottom-center" : "top-center"} />
      </TooltipProvider>
    </MapProvider>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-6 items-center justify-center rounded-full bg-primary" aria-hidden>
        <span className="size-2 rounded-full bg-primary-foreground" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">Econ Job Atlas</span>
    </div>
  )
}

function Workspace() {
  const [search, set] = useAppSearch()
  const isDesktop = useIsDesktop()
  const mode = useMode()
  const saved = useShortlist()
  const showNew = useCallback(() => set({ fresh: true, sort: "newest" }), [set])
  const { items, byId, meta, version, isLoading, error, isRefreshing } = useVacancies(showNew)

  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [group, setGroup] = useState<{ ids: string[]; label: string } | null>(null)
  const [snap, setSnap] = useState<Snap>(() => (search.sel ? SNAP_HALF : SNAP_PEEK))
  const [initialCamera] = useState(() => parseCamera(search.at))
  const searchRef = useRef<HTMLInputElement>(null)
  const zoomOnSelect = useRef(false)

  const view = isDesktop ? (search.view ?? "list") : "list"
  const layer = search.layer ?? "points"
  const sortKey: SortKey = search.sort ?? (search.q ? "relevance" : "deadline")
  const areaOn = search.area !== false
  const selected = search.sel ? byId.get(search.sel) : undefined

  // Camera padding = the panels' footprint, so fits and reveals frame the unobstructed map.
  const padding = useMemo<Padding>(
    () =>
      isDesktop
        ? {
            left: (view === "table" ? TABLE_W : PANEL_W) + GAP * 2,
            right: (selected ? DETAIL_W + GAP : 0) + 64,
            top: 64,
            bottom: 48,
          }
        : { left: 12, right: 56, top: 128, bottom: sheetOffset(snap, window.innerHeight) + 12 },
    [isDesktop, view, selected, snap],
  )
  const camera = useCamera(padding)

  // ── Data pipeline: index → filters → facets → viewport scope → sort ──────────────────────
  const index = useMemo(() => buildIndex(items), [items])
  const filters = useMemo(
    () => filtersFrom(search),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search.q, search.cat, search.field, search.src, search.dl, search.closed, search.saved, search.fresh],
  )
  const matched = useMemo(() => applyFilters(index, filters, saved), [index, filters, saved])
  const facets = useMemo(() => facetCounts(index, filters, saved), [index, filters, saved])
  const mapPoints = useMemo(() => matched.map((x) => x.v), [matched])
  const regionCounts = useMemo(() => {
    const c: Partial<Record<RegionId, number>> = {}
    for (const x of matched) c[x.v.worldRegion] = (c[x.v.worldRegion] ?? 0) + 1
    return c
  }, [matched])
  const rows = useMemo(() => {
    let r = matched
    if (group) {
      const ids = new Set(group.ids)
      r = r.filter((x) => ids.has(x.v.id))
    } else if (areaOn && bounds) r = r.filter((x) => inBounds(x.v, bounds))
    return sortResults(r, sortKey, filters.terms)
  }, [matched, group, areaOn, bounds, sortKey, filters.terms])
  const freshCount = useMemo(() => items.filter((v) => isFresh(v)).length, [items])
  const crossListed = useMemo(() => items.filter((v) => v.alsoOn.length > 0).length, [items])

  const nearby = useMemo(() => {
    if (!selected) return []
    return items
      .filter((v) => v.id !== selected.id && (daysUntil(v.deadline) ?? 0) >= 0)
      .map((v) => ({ v, km: haversine(selected, v) }))
      .filter((x) => x.km < 350)
      .sort((a, b) => a.km - b.km)
      .slice(0, 5)
  }, [items, selected])

  // ── Selection (pushes history once, so Back closes the detail) ─────────────────────────
  const select = useCallback(
    (id: string | null, opts?: { zoom?: boolean }) => {
      zoomOnSelect.current = !!opts?.zoom
      set({ sel: id ?? undefined }, { push: !!id && !search.sel })
      if (id && !isDesktop) setSnap((s) => (s === SNAP_PEEK ? SNAP_HALF : s))
    },
    [set, search.sel, isDesktop],
  )
  const selectFromList = useCallback((id: string) => select(id, { zoom: true }), [select])
  const selectFromMap = useCallback((id: string) => select(id), [select])

  useEffect(() => {
    if (!selected) return
    if (zoomOnSelect.current) {
      zoomOnSelect.current = false
      camera.easeTo(selected.lng, selected.lat, Math.max(camera.getZoom(), 5.5))
    } else camera.reveal(selected.lng, selected.lat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, camera])

  const onViewChange = useCallback(
    (b: Bounds | null, cam: string, user: boolean) => {
      setBounds(b)
      if (user) setGroup(null)
      set((prev) => ({ at: cam, region: user ? undefined : prev.region }))
    },
    [set],
  )

  const goRegion = useCallback(
    (id: RegionId | "world") => {
      setGroup(null)
      if (id === "world") {
        set({ region: undefined })
        camera.reset()
      } else {
        set({ region: id })
        camera.fitBounds(WORLD_REGIONS.find((r) => r.id === id)!.bounds, 7)
      }
    },
    [camera, set],
  )

  const fitResults = useCallback(() => camera.fitPoints(mapPoints, 10), [camera, mapPoints])
  const resolve = useCallback((ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Vacancy[], [byId])

  // ── Keyboard: / or ⌘K search · j/k or ↑/↓ step through results · Esc back out · f fit ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (t.closest("[role=menu],[role=dialog],[data-radix-popper-content-wrapper]")) return
      if (e.key === "Escape") {
        if (search.sel) select(null)
        else if (group) setGroup(null)
        return
      }
      const down = e.key === "j" || e.key === "ArrowDown"
      const up = e.key === "k" || e.key === "ArrowUp"
      if ((down || up) && rows.length) {
        e.preventDefault()
        const i = rows.findIndex((r) => r.v.id === search.sel)
        const next = down ? Math.min(rows.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1)
        select(rows[next]!.v.id, { zoom: true })
      } else if (e.key === "f") fitResults()
      else if (e.key === "+" || e.key === "=") camera.zoomBy(1)
      else if (e.key === "-") camera.zoomBy(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [camera, fitResults, group, rows, search.sel, select])

  const scope = group ? "group" : !areaOn ? "everywhere" : bounds ? "area" : "world"
  const hasFilters =
    !!search.q || !!search.cat || !!search.field || !!search.src || !!search.dl || !!search.saved || !!search.fresh

  const empty = (
    <div className="max-w-64 text-center">
      <SearchX className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
      <p className="mt-3 text-sm font-medium">No positions {scope === "area" ? "in this part of the map" : "match"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {scope === "area" ? "Zoom out or jump to a region with openings." : "Try broadening your filters."}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {scope === "area" && (
          <Button size="sm" variant="outline" onClick={() => goRegion("world")}>
            Show the whole world
          </Button>
        )}
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              set({ q: undefined, cat: undefined, field: undefined, src: undefined, dl: undefined, saved: undefined, fresh: undefined })
            }
          >
            Clear search & filters
          </Button>
        )}
      </div>
    </div>
  )

  const searchBox = (
    <SearchBox
      value={search.q ?? ""}
      items={items}
      inputRef={searchRef}
      onQuery={(q) => {
        setGroup(null)
        set({ q: q || undefined })
      }}
      onPickPlace={(ids) => {
        setGroup(null)
        set({ q: undefined, region: undefined, area: undefined })
        camera.fitPoints(resolve(ids), 10)
      }}
      onPickInstitution={(ids, label) => {
        set({ q: undefined })
        if (ids.length === 1) return selectFromList(ids[0]!)
        setGroup({ ids, label })
        camera.fitPoints(resolve(ids), 12)
      }}
      onPickField={(fid) => set((p) => ({ field: toggleIn(p.field, fid), q: undefined }))}
    />
  )

  const filterBar = (
    <FilterBar
      search={search}
      set={set}
      facets={facets}
      savedCount={saved.size}
      freshCount={freshCount}
      className={isDesktop ? "flex-wrap" : "px-0.5 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"}
    />
  )

  const header = (
    <ResultsHeader
      count={rows.length}
      total={matched.length}
      scope={scope}
      groupLabel={group?.label}
      sortKey={sortKey}
      hasQuery={!!search.q}
      search={search}
      set={set}
      showViewToggle={isDesktop}
      onClearGroup={() => setGroup(null)}
    />
  )

  const results =
    view === "table" ? (
      <ResultsTable rows={rows} selectedId={search.sel} hoveredId={hoveredId} onSelect={selectFromList} onHover={setHoveredId} />
    ) : (
      <ResultsList
        rows={rows}
        selectedId={search.sel}
        hoveredId={hoveredId}
        loading={isLoading}
        empty={empty}
        onSelect={selectFromList}
        onHover={setHoveredId}
      />
    )

  const detail = selected && (
    <JobDetail
      key={selected.id}
      v={selected}
      version={version}
      nearby={nearby}
      variant={isDesktop ? "panel" : "sheet"}
      onClose={() => select(null)}
      onSelect={selectFromList}
      onShowOnMap={() => camera.flyTo(selected.lng, selected.lat, Math.max(camera.getZoom(), 11))}
    />
  )

  const errorCard = error && !items.length && (
    <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">Couldn't load listings</p>
      <p className="mt-1 text-xs text-muted-foreground">{String((error as Error).message ?? error)}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  )

  const map = (
    <JobMap
      points={mapPoints}
      byId={byId}
      selectedId={search.sel}
      hoveredId={hoveredId}
      layer={layer}
      globe={!!search.globe}
      mode={mode}
      initialCamera={initialCamera}
      onHover={setHoveredId}
      onSelect={selectFromMap}
      onFocusGroup={(ids) => {
        const vs = resolve(ids)
        const one = new Set(vs.map((v) => v.institution)).size === 1
        setGroup({ ids, label: (one ? vs[0]?.institution : (vs[0]?.city ?? vs[0]?.country)) ?? "this location" })
        if (!isDesktop) setSnap(SNAP_HALF)
      }}
      onViewChange={onViewChange}
    />
  )

  const controls = (compact: boolean) => (
    <MapControls
      camera={camera}
      layer={layer}
      globe={!!search.globe}
      compact={compact}
      onLayer={(l) => set({ layer: l === "points" ? undefined : l })}
      onGlobe={(g) => set({ globe: g || undefined })}
      onFitResults={fitResults}
    />
  )

  if (isDesktop) {
    const panelW = view === "table" ? TABLE_W : PANEL_W
    const rightInset = selected ? DETAIL_W + GAP * 2 : GAP
    return (
      <CameraPaddingContext.Provider value={padding}>
        <main className="relative h-dvh w-full overflow-hidden bg-background">
          {map}

          <aside
            aria-label="Search and results"
            className="surface-float absolute top-3 bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-2xl transition-[width] duration-300 ease-out"
            style={{ width: panelW }}
          >
            <div className="space-y-2.5 px-3 pt-3 pb-3">
              <div className="flex items-center justify-between px-1">
                <Brand />
                <DataStatus meta={meta} refreshing={isRefreshing} crossListed={crossListed} />
              </div>
              {searchBox}
              {filterBar}
            </div>
            <div className="border-t border-border/70" />
            {header}
            {errorCard}
            {results}
          </aside>

          <div
            className="pointer-events-none absolute top-3 z-10 flex justify-center transition-[right] duration-300"
            style={{ left: panelW + GAP * 2, right: rightInset + 56 }}
          >
            <RegionNav
              counts={regionCounts}
              total={matched.length}
              active={search.region ?? null}
              onSelect={goRegion}
              className="surface-float pointer-events-auto max-w-full rounded-full p-1"
            />
          </div>

          <div className="absolute top-3 z-10 transition-[right] duration-300" style={{ right: rightInset }}>
            {controls(false)}
          </div>

          <div className="absolute bottom-8 z-10 transition-[right] duration-300" style={{ right: rightInset }}>
            <Legend counts={facets.cats} active={list(search.cat)} onToggle={(id) => set((p) => ({ cat: toggleIn(p.cat, id) }))} />
          </div>

          {selected && (
            <aside
              aria-label="Position details"
              className="surface-float absolute top-3 right-3 bottom-3 z-10 overflow-hidden rounded-2xl animate-in fade-in-0 slide-in-from-right-6 duration-300"
              style={{ width: DETAIL_W }}
            >
              {detail}
            </aside>
          )}
        </main>
      </CameraPaddingContext.Provider>
    )
  }

  return (
    <CameraPaddingContext.Provider value={padding}>
      <main className="relative h-dvh w-full overflow-hidden bg-background">
        {map}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 px-2 pt-[max(env(safe-area-inset-top),8px)]">
          <div className="surface-float pointer-events-auto rounded-2xl p-1.5">{searchBox}</div>
          <div className="pointer-events-auto">{filterBar}</div>
        </div>
        <div className="absolute right-2 z-10" style={{ top: 112 }}>
          {controls(true)}
        </div>
        <MobileSheet snap={snap} onSnap={setSnap}>
          {detail ?? (
            <>
              {header}
              <RegionNav
                counts={regionCounts}
                total={matched.length}
                active={search.region ?? null}
                onSelect={goRegion}
                className={cn("px-3 pb-2 [scrollbar-width:none]")}
              />
              <div className="border-t border-border/70" />
              {errorCard}
              {results}
            </>
          )}
        </MobileSheet>
      </main>
    </CameraPaddingContext.Provider>
  )
}
