# Econ Job Atlas

A map-first dashboard of academic economics vacancies, aggregated live from **EconJobMarket (EJM)** and the **AEA's Job Openings for Economists (JOE)**.

Stack: React 19 · TypeScript · Vite · Tailwind v4 · **shadcn/ui** · **MapLibre GL** (CARTO basemaps) · **deck.gl** (interleaved) · **TanStack Query / Router / Table / Virtual** · Zod.

```bash
pnpm install
pnpm ingest          # fetch EJM + JOE → geocode → dedupe → public/data/
pnpm dev             # http://localhost:5173
pnpm build && pnpm preview
```

`pnpm ingest --offline` re-parses cached payloads in `data/raw/`; `--geocode-budget=N` caps Nominatim calls per run.

## UX design

| Pattern | Where |
|---|---|
| **Map as canvas, UI floats** | Translucent panels over a full-bleed map; the camera is padding-aware, so fits and reveals frame the *unobstructed* area, not the area behind panels. |
| **Linked views** | List ↔ map brushing (hover a row → pin highlights; hover a pin → row highlights). The list follows the map ("111 positions in visible map area · List all"), and you can turn that off. |
| **Progressive disclosure** | Cluster → hover breakdown (category bar + institutions) → click zooms smoothly to the expansion level → pins (one per place, with a count badge when several positions share it) → pin hover card → detail panel → summary first, full description lazy-loaded, "Read full description" → "What to submit" checklist, JEL codes, nearby positions. |
| **Geographic navigation** | Region chips with live counts; search suggests *places* and *institutions* to fly to; "near me"; fit-to-results; globe view; a pin shared by several positions lists them instead of zooming forever, and says when it is only city-level. |
| **Intuitive search** | Live, diacritic-insensitive, ranked (title > institution > place); faceted filters show counts computed with every *other* filter applied; the legend doubles as a position-type filter. |
| **Shareable state** | Every filter, the selection, the layout and the camera live in the URL (Zod-validated, self-healing). Back closes the detail panel. |
| **Urgency without alarm** | Deadlines carry icon + words ("3 days left"), never color alone; "New" for listings posted in the last 7 days; a saved shortlist that works offline. |
| **Responsive** | ≥1024px: side panel, detail panel, optional TanStack Table comparison view. Mobile: Apple-Maps-style non-modal bottom sheet (peek / half / full). |
| **Keyboard** | `/` or `⌘K` search · `j`/`k` or `↑`/`↓` step through results (camera follows) · `Esc` back out · `f` fit · `+`/`−` zoom. |
| **Trust** | A "Updated n min ago" popover shows each feed's health, count and fetch time; geocoded-to-country pins say "Approximate pin". |

Map colors are the validated categorical palette (slots 1–5 in their CVD-safe order), Clusters and count badges are neutral ink, so hue on the map only ever means position type. Listings are grouped by coordinate before clustering, and clustering stops at zoom 10, so every place gets its own pin up close. Light and dark mode each get their own steps.

## Architecture

```
scripts/                       ingest (Node, run on a schedule)
  sources/types.ts             SourceAdapter interface: fetchRaw() (network) + parse() (pure)
  sources/ejm.ts               EJM public JSON feed (has coordinates)
  sources/joe.ts               JOE full_xml export, discovered from the listings page
  lib/geocode.ts               known institution coords → cache → Nominatim (1 req/s) → country
  lib/text.ts                  HTML/plain text → safe structural blocks (no markup reaches the DOM)
  ingest.ts                    collect → geocode → cross-source dedupe → first-seen tracking → write
src/domain/                    Zod schemas + taxonomy + geo, shared by ingest and app
src/data/                      TanStack Query: poll meta → versioned snapshot → lazy details
src/features/                  map · search · filters · results · detail · layout
```

**Data contract** (any static host or CDN works; set `VITE_DATA_URL` to point elsewhere):

- `meta.json`: a few hundred bytes, polled every 2 min. Its `version` (a content hash) keys the snapshot query, so clients only re-download when something actually changed, then announce "N new positions just posted".
- `vacancies.json`: the lean index used by the map and list (around 640 KB raw for 749 positions).
- `details/<id>.json`: full bodies, fetched only when a listing is opened.

**Adding a source** (e.g. AJO, EconJobs, university feeds): implement `SourceAdapter`, map it onto `Vacancy`, then register it in `scripts/ingest.ts`. Order sets dedupe priority. Category and field normalization live in `src/domain/taxonomy.ts` (JEL letters as the shared field vocabulary).

**Continuous updates:** `.github/workflows/ingest.yml` runs the pipeline every 3 hours and commits a new snapshot. `data/geocache.json` and `data/seen.json` are committed state: the geocode cache keeps reruns fast and polite to Nominatim, and first-seen dates give JOE (which publishes no post date) a "new" signal.

**Scaling headroom:** deck.gl and Supercluster handle 10⁵ points. The list and table are virtualized. Search uses a per-snapshot precomputed index. Past roughly 50k listings, move `applyFilters` into a Web Worker and split the index by region, or serve it from an API with the same shapes.

## Notes

- MapLibre is pinned to v5 because `@deck.gl/mapbox` 9.4 relies on MapLibre v5 internals for interleaved rendering.
- Some EJM logo URLs are served with a non-image content type, and browsers block them cross-origin (ORB). Avatars fall back to initials.
- Listings are aggregated for discovery. The detail panel always links to the original posting.
