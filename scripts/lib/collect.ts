import { readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SourceStatus } from "../../src/domain/vacancy"
import type { Draft, SourceAdapter } from "../sources/types"

export type Collected = { drafts: Draft[]; status: SourceStatus }

/**
 * One source's listings: fetched live when due, else, or when the source fails, from its last good payload
 * (`<rawDir>/<id>.<ext>`).
 *
 * A fresh payload replaces the cached one only if it parses, and only if it holds listings when the cached
 * one did: an error page served as 200, or a feed that briefly comes back empty, must not wipe the last good
 * copy. An adapter that read only part of its source (one list of several failed and was carried over from
 * the previous payload) says so through `degraded`. The payload is kept, the source shows as degraded with
 * that reason, and a marker beside the payload makes the next run read it again, whatever its refreshHours.
 */
export async function collect(
  adapter: SourceAdapter,
  { rawDir, offline }: { rawDir: string; offline: boolean },
): Promise<Collected> {
  const rawFile = path.join(rawDir, `${adapter.id}.${adapter.rawExt}`)
  const partialFile = `${rawFile}.partial`
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
  // Why the cached payload is only part of the source, if it is
  const partial = await readFile(partialFile, "utf8").catch(() => null)

  const ageHours = cached ? (Date.now() - cached.mtime.getTime()) / 3_600_000 : Infinity
  if (!offline && partial == null && ageHours < (adapter.refreshHours ?? 0)) {
    console.log(`· ${adapter.id}: cached payload is ${ageHours.toFixed(1)} h old, refreshes every ${adapter.refreshHours} h`)
  } else if (!offline) {
    try {
      const reasons: string[] = []
      const raw = await adapter.fetchRaw(cached?.raw ?? null, (reason) => {
        reasons.push(reason)
        console.warn(`! ${adapter.id}: ${reason}`)
      })
      const drafts = parseFresh(adapter, raw, cached?.raw ?? null)
      await writeFile(rawFile, raw)
      if (reasons.length) await writeFile(partialFile, reasons.join("; "))
      else await rm(partialFile, { force: true })
      const error = reasons.join("; ") || null
      console.log(`✓ ${adapter.id}: ${drafts.length} listings${error ? " (in part from the previous run)" : ""}`)
      return {
        drafts,
        status: { ...status, ok: !error, count: drafts.length, fetchedAt: new Date().toISOString(), error },
      }
    } catch (e) {
      status.error = (e as Error).message
      console.warn(`✗ ${adapter.id}: ${status.error} — trying cached payload`)
    }
  }

  if (!cached) return { drafts: [], status: { ...status, error: status.error ?? "no cached payload" } }
  status.fetchedAt = cached.mtime.toISOString()
  status.error ??= partial
  try {
    const drafts = adapter.parse(cached.raw)
    console.log(`✓ ${adapter.id}: ${drafts.length} listings`)
    return { drafts, status: { ...status, ok: !status.error, count: drafts.length } }
  } catch (e) {
    return { drafts: [], status: { ...status, error: `parse: ${(e as Error).message}` } }
  }
}

/** A fresh payload's listings, or why it should not replace the cached one */
function parseFresh(adapter: SourceAdapter, raw: string, cachedRaw: string | null): Draft[] {
  let drafts: Draft[]
  try {
    drafts = adapter.parse(raw)
  } catch (e) {
    throw new Error(`unreadable answer (${(e as Error).message})`)
  }
  if (!drafts.length && cachedRaw != null && countOf(adapter, cachedRaw) > 0) {
    throw new Error("answered with no listings")
  }
  return drafts
}

function countOf(adapter: SourceAdapter, raw: string) {
  try {
    return adapter.parse(raw).length
  } catch {
    return 0
  }
}
