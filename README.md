# Econ Job Atlas

[![deploy](https://github.com/chickymonkeys/academic-jobs-dashboard/actions/workflows/deploy.yml/badge.svg)](https://github.com/chickymonkeys/academic-jobs-dashboard/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A map-first dashboard of academic vacancies in economics, with political science and public policy alongside, aggregated live from **EconJobMarket (EJM)**, the **AEA's Job Openings for Economists (JOE)**, **jobs.ac.uk**, **Times Higher Education (THE)**, the **Italian ministry's calls portal (MUR)**, **APPAM Career Connections**, **Academic Jobs Online (AJO)**, **AcademicTransfer** and **HigherEdJobs (HEJ)**.

Stack: Vue 3 · TypeScript · Vite · **Nuxt UI** (Tailwind v4, Reka UI) · **MapLibre GL** (CARTO basemaps) · **deck.gl** (interleaved) · **TanStack Query / Virtual** · Vue Router · Zod · **Void** → Cloudflare Workers.

Needs Node 24 and pnpm (`corepack enable` picks up the version pinned in `package.json`).

```bash
git clone https://github.com/chickymonkeys/academic-jobs-dashboard.git
cd academic-jobs-dashboard
pnpm install
pnpm ingest                  # fetch every source → geocode → dedupe → public/data/ (gitignored)
pnpm dev                     # http://localhost:5173, on Cloudflare's local Workers runtime
pnpm build && pnpm preview   # production build (vite build, then vue-tsc)
pnpm run deploy:cloudflare   # build and deploy to your Cloudflare account
```

`pnpm ingest --offline` re-parses cached payloads in `data/raw/`; `--geocode-budget=N` caps Nominatim calls per run.

## Sources

| Source | Read from | What's kept | What a listing carries |
|---|---|---|---|
| **EconJobMarket** | public JSON feed | the whole feed (economics) | full text, fields, coordinates |
| **AEA JOE** | full XML export | the whole feed (economics) | full text, JEL codes, salary, requirements |
| **jobs.ac.uk** | search pages for two disciplines + each job page's schema.org `JobPosting` | Economics → economics; Politics & Government → political science | full text, dates, salary, logo |
| **Times Higher Education** | subject browse pages + each job page's `JobPosting` and tags | Economics & Econometrics; Politics & International Studies. Institution-wide schemes filed under more than eight subjects are kept only when the title names one of ours | full text, dates, job type (postdoc…), logo |
| **MUR calls portal** | open-call lists for each call type + each kept call's detail page | calls whose disciplinary code is economics (ECON-01…05, ECON-09, STAT-02/04, STEC-01, AGRI-01 and their pre-2024 codes) or political science (GSPS-02) | English (or Italian) title and summary, department, city, dates; the call type sets the category (RTT → faculty, RTD-A → postdoc, research appointments → pre-doc…) |
| **APPAM Career Connections** | the board's first page, as the server renders it | everything (public policy) | full text, address, salary, deadline, sector (academic, government, non-profit) |
| **Academic Jobs Online** | site-wide RSS | disciplines naming economics, finance, politics, government, international relations or policy | full text, dates, place |
| **AcademicTransfer** | vacancy sitemap + the job pages whose slug looks like ours | research field Economics, Political sciences or public administration | full text, dates, salary, logo |
| **HigherEdJobs** | Economics, Agricultural Economics, Political Science and Public Administration & Policy RSS | the four category feeds | title, institution, place and date only |

Everything is fetched politely: one request at a time per portal, spaced out (2–3 s, and the 10 s AcademicTransfer asks for), with back-off on 429/5xx. Job pages already fetched are carried over from the previous payload, so each run only fetches new ones, up to a per-run budget. MUR and AcademicTransfer are re-read at most every 12 hours (`refreshHours`).

**Disciplines.** Each listing gets the discipline of the feed or category it came from, widened by its title and hiring unit: a JOE ad from a Department of Government is political science too, one from a policy school is public policy, and a political science ad whose title names economics is economics too. A department name only adds political science when the title doesn't name economics, so "Professor of Economics" in a Department of Politics and Economics stays economics. Duplicates merged across sources keep every discipline they were found under. The JEL field vocabulary is shared: a political science listing about political economy carries field P, and one with no field signal is "Any field".

**Left out, and why.**

- **EURAXESS**: its `robots.txt` disallows `/jobs/`, both search and job pages. Most of its economics listings are reposts from THE, the MUR portal, JREC-IN and Academic Positions, so the first two are read at the source instead. Postings made directly on EURAXESS (about a third of its economics listings, mostly European universities) are covered only when they also appear on another source.
- **JREC-IN Portal** (Japan): its terms forbid redistributing its postings without JST's prior approval.
- **Academic Positions** and **PublicServiceCareers** (NASPAA): every page, sitemap included, sits behind a Cloudflare bot challenge.
- **APSA eJobs** and the **ISA job board**: members only; non-members see titles at most.
- **H-Net Job Guide** and the **PSA** jobs page: H-Net's political science category is mostly humanities fellowships, and the PSA page is a single free-text post.
- **Inomics**: its API ignores filters, so reading it means downloading about 17 MB of mixed content per run.

**Partial reads.** APPAM's server render holds the first 25 listings (featured and newest); the rest load from an API its `robots.txt` closes. AcademicTransfer is read through its sitemap because its search pages render only ten results; a job page is opened only when its slug looks relevant (economics, politics, policy, governance, public administration), so a relevant post with an unrelated slug is missed.

## UX design

| Pattern | Where |
|---|---|
| **Map as canvas, UI floats** | Translucent panels over a full-bleed map; the camera is padding-aware, so fits and reveals frame the *unobstructed* area, not the area behind panels. |
| **Linked views** | List ↔ map brushing (hover a row → pin highlights; hover a pin → row highlights). The list follows the map ("111 positions in visible map area · List all"), and you can turn that off. |
| **Progressive disclosure** | Cluster → hover breakdown (category bar + institutions) → click zooms smoothly to the expansion level → pins (one per place, with a count badge when several positions share it) → pin hover card → detail panel → summary first, full description lazy-loaded, "Read full description" → "What to submit" checklist, JEL codes, nearby positions. |
| **Geographic navigation** | Region chips with live counts; search suggests *places* and *institutions* to fly to; "near me"; fit-to-results; globe view; a pin shared by several positions lists them instead of zooming forever, and says when it is only city-level. |
| **Intuitive search** | Live, diacritic-insensitive, ranked (title > institution > place); faceted filters (discipline, position, field, deadline, source) show counts computed with every *other* filter applied; the legend doubles as a position-type filter. |
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
  sources/jobsacuk.ts          jobs.ac.uk economics and politics search pages + JobPosting JSON-LD per job (carried over between runs)
  sources/thejobs.ts           Times Higher Education subject pages + JobPosting JSON-LD and tags per job
  sources/mur.ts               Italian MUR/Cineca calls portal: open-call lists + detail pages, picked by disciplinary code
  sources/appam.ts             APPAM Career Connections, from the board page's embedded results
  sources/ajo.ts               Academic Jobs Online RSS, filtered to our disciplines
  sources/academictransfer.ts  AcademicTransfer vacancy sitemap + JobPosting JSON-LD per job
  sources/hej.ts               HigherEdJobs Economics, Agricultural Economics, Political Science and Public Policy RSS
  lib/http.ts                  polite paged GETs: spacing, retries with back-off on 429/5xx
  lib/geocode.ts               known institution coords → cache → Nominatim (1 req/s) → country
  lib/text.ts                  HTML/plain text → safe structural blocks (no markup reaches the DOM)
  ingest.ts                    collect → geocode → cross-source dedupe → first-seen tracking → write
src/domain/                    Zod schemas + taxonomy + geo, shared by ingest and app
src/app/                       router (one view) + URL search state (Zod-validated, self-healing)
src/data/                      TanStack Query: poll meta → versioned snapshot → lazy details
src/features/                  map · search · filters · results · detail · layout (Vue SFCs)
src/components/job/            listing atoms: deadline, avatar, save star, source tags
vite.config.ts                 voidPlugin() + Vue + Nuxt UI (theme colors, bundled Lucide icons)
void.config.ts                 how Void deploys the app (static SPA today)
```

UI is Nuxt UI in plain Vue mode (`@nuxt/ui/vite`): components (`UButton`, `UPopover`, `UCommandPalette`, `UTable`, `UDrawer`…) and `useToast` are auto-imported, and the palette lives in `src/assets/main.css` as Nuxt UI tokens (`--ui-primary`, `--ui-bg`, `--ui-text-*`…) tuned to the atlas colors. The map is MapLibre driven directly from `JobMap.vue`, with deck.gl as an interleaved overlay.

**Data contract** (any static host or CDN works; set `VITE_DATA_URL` to point elsewhere):

- `meta.json`: a few hundred bytes, polled every 2 min. Its `version` (a content hash) keys the snapshot query, so clients only re-download when something actually changed, then announce "N new positions just posted".
- `vacancies.json`: the lean index used by the map and list (around 1.1 MB raw for about 1,300 positions).
- `details/<id>.json`: full bodies, fetched only when a listing is opened.

**Adding a source** (e.g. university feeds): implement `SourceAdapter`, map it onto `Vacancy` (including the `disciplines` its feed or category implies), add its id to `SOURCE_IDS` and its labels to `src/components/job/labels.ts`, then register it in `scripts/ingest.ts`. Order sets dedupe priority, so sources with full descriptions come first. `fetchRaw(previous)` receives the last cached payload, so per-job pages fetched before can be reused; `refreshHours` spaces out live fetches for portals that ask for it. Category, discipline and field normalization live in `src/domain/taxonomy.ts` (JEL letters as the shared field vocabulary; `fieldsFromText` infers them from titles where a source has no field codes; `disciplinesFor` adds the disciplines a title or department names).

**Continuous updates:** `.github/workflows/deploy.yml` runs the pipeline on every push to `main` and every 3 hours, then deploys. The snapshot is never committed: it holds third-party listings, many with named contacts, so it lives only in the deployed site. Raw feed payloads stay in the Actions cache, so a feed that is down falls back to its last good copy. `data/geocache.json` and `data/seen.json` are committed state: the geocode cache keeps reruns fast and polite to Nominatim, and first-seen dates give JOE (which publishes no post date) a "new" signal.

**Scaling headroom:** deck.gl and Supercluster handle 10⁵ points. The list and table are virtualized. Search uses a per-snapshot precomputed index. Past roughly 50k listings, move `applyFilters` into a Web Worker and split the index by region, or serve it from an API with the same shapes.

## Hosting (Cloudflare, provisioned by Void)

[Void](https://void.cloud) builds the app and deploys it to Cloudflare Workers, creating the Worker on the first run. A free Cloudflare account is enough; the only dashboard step is choosing a workers.dev subdomain.

1. **Create a free account** at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and verify the email.
2. **Choose a workers.dev subdomain:** open **Workers & Pages** in the dashboard once and pick a name, say `econ-atlas`. Void can't deploy to an account without one.
3. **First deploy, from your machine:** `pnpm ingest`, then `pnpm run deploy:cloudflare`. The browser opens to sign in to Cloudflare. Void builds the app, creates a Worker named after `package.json`'s `name`, uploads `dist/client` (app + `data/`) to Workers Static Assets, and prints the URL: `https://academic-jobs-dashboard.<subdomain>.workers.dev`. Later runs update the same Worker. A deploy from your machine ships your local snapshot, until CI replaces it at its next run.
4. **Commit `void.lock.json`** if the deploy changed it. It records your account ID and the resources Void provisioned, so other machines and CI deploy to the same place.
5. **Deploy from GitHub Actions (optional):** in the dashboard, go to **My Profile → API Tokens → Create Token** and use the **Edit Cloudflare Workers** template, limited to your account. Then store it, with your subdomain, in the repository:

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN                          # paste the token when prompted
   gh variable set CLOUDFLARE_WORKERS_SUBDOMAIN --body econ-atlas
   gh workflow run deploy                                      # first CI deploy
   ```

   From then on, `.github/workflows/deploy.yml` fetches fresh listings and deploys on every push to `main` and every 3 hours. Without the token, it still runs the pipeline, but only builds and type-checks.

**What the free plan covers:** the app is a static SPA on Workers Static Assets. The edge serves it, along with the snapshot under `/data/`, without running Worker code, and asset requests are free and unmetered. The Worker only answers Void's own `/__void` endpoints, well inside the 100,000 requests a day of Workers Free. One limit to watch is 20,000 files per deploy on Free; each listing adds one `data/details/*.json`, and there are about 1,300 today.

**Growing a backend:** put API routes in `routes/`, scheduled jobs in `crons/`, a Drizzle schema in `db/`, then drop `inference` from `void.config.ts`. Void infers the D1, KV and R2 bindings from the code and provisions them on the next deploy. One caveat if the ingest moves into a cron: parsing the feeds takes well over 10 ms of CPU, more than Workers Free allows per invocation (10 ms), so that needs Workers Paid.

## Notes

- MapLibre is pinned to v5 because `@deck.gl/mapbox` 9.4 relies on MapLibre v5 internals for interleaved rendering.
- TypeScript stays on 6.x: `vue-tsc` needs the TypeScript JS API, which the native TypeScript 7 doesn't ship. `pnpm typecheck` reads the `components.d.ts` and `auto-imports.d.ts` that `pnpm dev` or `pnpm build` generate.
- Some EJM logo URLs are served with a non-image content type, and browsers block them cross-origin (ORB). Avatars fall back to initials.
- Listings are aggregated for discovery. The detail panel always links to the original posting.

## License

The code is [MIT](LICENSE). The license doesn't cover the data:

- The listings the site serves (generated into `public/data/`, which is never committed) belong to their publishers (EconJobMarket, AEA JOE, jobs.ac.uk, Times Higher Education, the MUR/Cineca calls portal, APPAM, Academic Jobs Online, AcademicTransfer, HigherEdJobs) and are shown only to point back to the original postings.
- `data/geocache.json` holds Nominatim geocodes, © OpenStreetMap contributors, under the [ODbL](https://opendatacommons.org/licenses/odbl/).
- Basemaps are © [CARTO](https://carto.com/attributions) and © OpenStreetMap contributors.
