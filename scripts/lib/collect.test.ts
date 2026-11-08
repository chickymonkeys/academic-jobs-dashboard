import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import type { Draft, SourceAdapter } from "../sources/types"
import { collect } from "./collect"

/** A source whose payload is a JSON list of titles, answering with whatever the test hands it */
function source(fetchRaw: SourceAdapter["fetchRaw"], refreshHours?: number): SourceAdapter {
  return {
    id: "ejm",
    name: "Test source",
    homepage: "https://example.org",
    rawExt: "json",
    refreshHours,
    fetchRaw,
    parse: (raw) => (JSON.parse(raw) as string[]).map((title) => ({ title }) as Draft),
  }
}
const titles = (drafts: Draft[]) => drafts.map((d) => d.title)

let rawDir = ""
const rawFile = () => path.join(rawDir, "ejm.json")
const cache = async (titles: string[], hoursOld = 0) => {
  await writeFile(rawFile(), JSON.stringify(titles))
  const at = new Date(Date.now() - hoursOld * 3_600_000)
  await utimes(rawFile(), at, at)
}
const live = () => ({ rawDir, offline: false })
const quiet = async <T>(f: () => Promise<T>) => {
  const [log, warn] = [console.log, console.warn]
  console.log = console.warn = () => {}
  try {
    return await f()
  } finally {
    Object.assign(console, { log, warn })
  }
}

beforeEach(async () => {
  rawDir = await mkdtemp(path.join(tmpdir(), "collect-test-"))
})
afterEach(async () => {
  await rm(rawDir, { recursive: true, force: true })
})

describe("collect", () => {
  it("reads the source and keeps its payload for next time", async () => {
    const { drafts, status } = await quiet(() => collect(source(async () => '["A","B"]'), live()))
    assert.deepEqual(titles(drafts), ["A", "B"])
    assert.equal(status.ok, true)
    assert.equal(status.error, null)
    assert.equal(await readFile(rawFile(), "utf8"), '["A","B"]')
  })

  it("falls back to the last good payload when the source is down", async () => {
    await cache(["Cached"], 30)
    const { drafts, status } = await quiet(() =>
      collect(
        source(async () => {
          throw new Error("HTTP 504 for https://example.org/list")
        }),
        live(),
      ),
    )
    assert.deepEqual(titles(drafts), ["Cached"])
    assert.equal(status.ok, false)
    assert.equal(status.error, "HTTP 504 for https://example.org/list")
    assert.equal(status.count, 1)
  })

  it("does not let an unreadable or empty answer replace the last good payload", async () => {
    await cache(["Cached"])
    const garbled = await quiet(() => collect(source(async () => "<html>Maintenance</html>"), live()))
    assert.deepEqual(titles(garbled.drafts), ["Cached"])
    assert.match(garbled.status.error ?? "", /^unreadable answer/)

    const empty = await quiet(() => collect(source(async () => "[]"), live()))
    assert.deepEqual(titles(empty.drafts), ["Cached"])
    assert.equal(empty.status.error, "answered with no listings")
    assert.equal(await readFile(rawFile(), "utf8"), '["Cached"]')
  })

  it("doesn't hand the adapter a cached payload that no longer parses, and replaces it", async () => {
    await writeFile(rawFile(), '["Cut off mid-wri')
    let handed: string | null | undefined
    const { drafts, status } = await quiet(() =>
      collect(
        source(async (previous) => {
          handed = previous
          return '["A"]'
        }),
        live(),
      ),
    )
    assert.equal(handed, null)
    assert.deepEqual(titles(drafts), ["A"])
    assert.equal(status.ok, true)
    assert.equal(await readFile(rawFile(), "utf8"), '["A"]')
  })

  it("takes an empty answer from a source that had nothing before either", async () => {
    await cache([])
    const { drafts, status } = await quiet(() => collect(source(async () => "[]"), live()))
    assert.deepEqual(drafts, [])
    assert.equal(status.ok, true)
  })

  it("keeps a partial read, shows the source as degraded, and reads it again on the next run", async () => {
    await cache(["Old A", "Old B"], 1)
    let calls = 0
    const mur = source(async (previous, degraded) => {
      calls++
      if (calls === 1) {
        // The failed list is carried over from the previous payload
        assert.equal(previous, '["Old A","Old B"]')
        degraded("1 of 2 call lists (RTT): HTTP 504 for https://example.org/rtt")
        return '["New A","Old B"]'
      }
      assert.equal(previous, '["New A","Old B"]')
      return '["New A","New B"]'
    }, 12)
    // Without a partial read, a payload an hour old waits for its 12-hour refresh
    const first = await quiet(() => collect(mur, live()))
    assert.equal(calls, 0, "the payload was too young to refresh")
    assert.equal(first.status.ok, true)

    await cache(["Old A", "Old B"], 13)
    const partial = await quiet(() => collect(mur, live()))
    assert.deepEqual(titles(partial.drafts), ["New A", "Old B"])
    assert.equal(partial.status.ok, false)
    assert.equal(partial.status.error, "1 of 2 call lists (RTT): HTTP 504 for https://example.org/rtt")
    assert.ok(partial.status.fetchedAt)

    // The new payload is minutes old, but it was partial: the next run reads the source again
    await cache(["New A", "Old B"])
    const next = await quiet(() => collect(mur, live()))
    assert.equal(calls, 2)
    assert.deepEqual(titles(next.drafts), ["New A", "New B"])
    assert.equal(next.status.ok, true)
    await assert.rejects(stat(`${rawFile()}.partial`))
  })

  it("still shows a partial payload as degraded when it has to stand in", async () => {
    await cache(["New A", "Old B"])
    await writeFile(`${rawFile()}.partial`, "1 of 2 call lists (RTT): HTTP 504")
    const { status } = await quiet(() => collect(source(async () => "[]"), { rawDir, offline: true }))
    assert.equal(status.ok, false)
    assert.equal(status.error, "1 of 2 call lists (RTT): HTTP 504")
  })
})
