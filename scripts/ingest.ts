/**
 * Ingest pipeline: fetch → parse → geocode → dedupe → snapshot.
 *
 *   pnpm ingest                       fetch all sources live (falls back to cached raw payloads)
 *   pnpm ingest --offline             re-parse cached raw payloads only
 *   pnpm ingest --geocode-budget=50   cap Nominatim calls this run
 *   pnpm ingest --enable=euraxess     also read a source that is off by default (see SourceAdapter.off)
 *
 * Output (consumed by the app, servable from any static host/CDN):
 *   public/data/meta.json             small, polled by clients to detect new snapshots
 *   public/data/vacancies.json        the map/list index
 *   public/data/details/<id>.json     heavy per-listing bodies, fetched on demand
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { findCountry, regionForPoint } from "../src/domain/geo"
import { disciplinesFor } from "../src/domain/taxonomy"
import { MetaSchema, SnapshotSchema, VacancySchema, type SourceStatus, type Vacancy } from "../src/domain/vacancy"
import { Geocoder } from "./lib/geocode"
import { jaccard, normName, titleTokens } from "./lib/text"
import { academicTransferAdapter } from "./sources/academictransfer"
import { ajoAdapter } from "./sources/ajo"
import { appamAdapter } from "./sources/appam"
import { ejmAdapter } from "./sources/ejm"
import { euraxessAdapter } from "./sources/euraxess"
import { hejAdapter } from "./sources/hej"
import { jobsAcUkAdapter } from "./sources/jobsacuk"
import { joeAdapter } from "./sources/joe"
import { murAdapter } from "./sources/mur"
import { theJobsAdapter } from "./sources/thejobs"
import type { Draft, SourceAdapter } from "./sources/types"

/**
 * Registration order is also dedupe priority: earlier sources win the primary record, so the richest
 * listings come first (structured fields and full bodies) and HigherEdJobs (titles only) comes last.
 */
const ADAPTERS: SourceAdapter[] = [
  ejmAdapter,
  joeAdapter,
  jobsAcUkAdapter,
  theJobsAdapter,
  murAdapter,
  appamAdapter,
  ajoAdapter,
  academicTransferAdapter,
  euraxessAdapter,
  hejAdapter,
]

const argv = process.argv.slice(2)
const OFFLINE = argv.includes("--offline")
const BUDGET = Number(argv.find((a) => a.startsWith("--geocode-budget="))?.split("=")[1] ?? 1500)
const ENABLED = new Set(argv.find((a) => a.startsWith("--enable="))?.split("=")[1]?.split(",") ?? [])

const ROOT = path.resolve(import.meta.dirname, "..")
const DATA = path.join(ROOT, "data")
const RAW = path.join(DATA, "raw")
const OUT = path.join(ROOT, "public", "data")

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch {
    return fallback
  }
}

async function collect(adapter: SourceAdapter): Promise<{ drafts: Draft[]; status: SourceStatus }> {
  const rawFile = path.join(RAW, `${adapter.id}.${adapter.rawExt}`)
  const status: SourceStatus = {
    id: adapter.id,
    name: adapter.name,
    homepage: adapter.homepage,
    ok: false,
    count: 0,
    fetchedAt: null,
    error: null,
  }
  let cached: { raw: string; mtime: Date } | null = null
  try {
    cached = { raw: await readFile(rawFile, "utf8"), mtime: (await stat(rawFile)).mtime }
  } catch {
    /* first run for this source */
  }
  const ageHours = cached ? (Date.now() - cached.mtime.getTime()) / 3_600_000 : Infinity
  let raw: string | null = null
  if (!OFFLINE && ageHours < (adapter.refreshHours ?? 0)) {
    console.log(`· ${adapter.id}: cached payload is ${ageHours.toFixed(1)} h old, refreshes every ${adapter.refreshHours} h`)
  } else if (!OFFLINE) {
    try {
      raw = await adapter.fetchRaw(cached?.raw ?? null)
      status.fetchedAt = new Date().toISOString()
      await writeFile(rawFile, raw)
    } catch (e) {
      status.error = (e as Error).message
      console.warn(`✗ ${adapter.id}: ${status.error} — trying cached payload`)
    }
  }
  if (raw == null) {
    if (!cached) return { drafts: [], status: { ...status, error: status.error ?? "no cached payload" } }
    raw = cached.raw
    status.fetchedAt = cached.mtime.toISOString()
  }
  try {
    const drafts = adapter.parse(raw)
    console.log(`✓ ${adapter.id}: ${drafts.length} listings`)
    return { drafts, status: { ...status, ok: !status.error, count: drafts.length } }
  } catch (e) {
    return { drafts: [], status: { ...status, error: `parse: ${(e as Error).message}` } }
  }
}

function daysBetween(a: string, b: string) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000
}

/** Cross-source dedupe: same institution and discipline + (near-identical title, or similar title and same deadline) */
function dedupe(drafts: Draft[]): Draft[] {
  const byInstitution = new Map<string, Draft[]>()
  const out: Draft[] = []
  for (const d of drafts) {
    const key = normName(d.institution)
    const peers = byInstitution.get(key) ?? []
    const tokens = titleTokens(d.title)
    const match = peers.find((p) => {
      if (p.source === d.source) return false
      // Generic titles ("Assistant Professor") at one institution are only the same post within one discipline
      if (!p.disciplines.some((x) => d.disciplines.includes(x))) return false
      const sim = jaccard(titleTokens(p.title), tokens)
      const sameDeadline = !!p.deadline && !!d.deadline && daysBetween(p.deadline, d.deadline) <= 3
      return sim >= 0.8 || (sim >= 0.4 && sameDeadline)
    })
    if (match) {
      match.alsoOn.push({ source: d.source, url: d.url })
      match.fields = [...new Set([...match.fields.filter((f) => f !== "any"), ...d.fields.filter((f) => f !== "any")])]
      if (!match.fields.length) match.fields = ["any"]
      match.disciplines = disciplinesFor([...match.disciplines, ...d.disciplines], match)
      continue
    }
    peers.push(d)
    byInstitution.set(key, peers)
    out.push(d)
  }
  return out
}

async function main() {
  await mkdir(RAW, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)

  const results = []
  for (const adapter of ADAPTERS) {
    // An off source is left out entirely, cached payload included, so the snapshot never carries its listings
    if (adapter.off && !ENABLED.has(adapter.id)) {
      console.log(`· ${adapter.id}: off (${adapter.off}); --enable=${adapter.id} reads it`)
      continue
    }
    results.push(await collect(adapter))
  }
  const drafts = results.flatMap((r) => r.drafts)
  for (const d of drafts) d.disciplines = disciplinesFor(d.disciplines, d)

  const geocoder = await Geocoder.load(path.join(DATA, "geocache.json"), OFFLINE ? 0 : BUDGET)
  geocoder.indexKnown(drafts)
  const located: Draft[] = []
  let i = 0
  for (const d of drafts) {
    if (++i % 50 === 0) process.stdout.write(`  geocoding ${i}/${drafts.length}\r`)
    if (d.lat != null && d.lng != null) located.push(d)
    else if (await geocoder.resolve(d)) located.push(d)
    else console.warn(`  skip (no location): ${d.id} ${d.institution}`)
  }
  await geocoder.save()
  console.log("geocoder", geocoder.stats)

  const unique = dedupe(located)
  console.log(`dedupe: ${located.length} → ${unique.length}`)

  // First-seen bookkeeping gives every source a "posted" signal, even those (JOE) that don't publish one.
  const seenFile = path.join(DATA, "seen.json")
  const seen = await readJson<{ baseline: string | null; ids: Record<string, string> }>(seenFile, {
    baseline: null,
    ids: {},
  })
  const baseline = (seen.baseline ??= today)

  const items: Vacancy[] = unique.map((d) => {
    const firstSeenAt = (seen.ids[d.id] ??= today)
    const { detail: _detail, ...rest } = d
    return VacancySchema.parse({
      ...rest,
      lat: Math.round(d.lat! * 1e5) / 1e5,
      lng: Math.round(d.lng! * 1e5) / 1e5,
      geoPrecision: d.geoPrecision ?? "country",
      worldRegion: findCountry(d.countryCode ?? d.country)?.region ?? regionForPoint(d.lat!, d.lng!),
      postedAt: d.postedAt ?? (firstSeenAt > baseline ? firstSeenAt : null),
      firstSeenAt,
    })
  })
  await writeFile(seenFile, JSON.stringify(seen))

  await rm(path.join(OUT, "details"), { recursive: true, force: true })
  await mkdir(path.join(OUT, "details"), { recursive: true })
  await Promise.all(
    unique.map((d) =>
      writeFile(path.join(OUT, "details", `${d.id}.json`), JSON.stringify({ id: d.id, ...d.detail })),
    ),
  )

  const version = createHash("sha256").update(JSON.stringify(items)).digest("hex").slice(0, 12)
  const generatedAt = new Date().toISOString()
  const snapshot = SnapshotSchema.parse({ version, generatedAt, items })
  const meta = MetaSchema.parse({
    version,
    generatedAt,
    total: items.length,
    sources: results.map((r) => r.status),
  })
  await writeFile(path.join(OUT, "vacancies.json"), JSON.stringify(snapshot))
  await writeFile(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2))
  console.log(`wrote ${items.length} vacancies (version ${version})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
