import assert from "node:assert/strict"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, beforeEach, describe, it } from "node:test"
import { politeClient } from "./http"

/** A local server whose answer to each path is scripted per request, in order; the last answer repeats */
type Answer = { status?: number; body?: string; headers?: Record<string, string>; hang?: boolean }
const script = new Map<string, Answer[]>()
const hits = new Map<string, number>()
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const path = req.url ?? "/"
  const n = hits.get(path) ?? 0
  hits.set(path, n + 1)
  const answers = script.get(path) ?? [{ status: 404 }]
  const a = answers[Math.min(n, answers.length - 1)]
  if (a.hang) return // never answers: the client's timeout has to end it
  res.writeHead(a.status ?? 200, { "Content-Type": "text/html", ...a.headers })
  res.end(a.body ?? "")
})
let base = ""
before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => {
  server.closeAllConnections()
  server.close()
})
beforeEach(() => {
  script.clear()
  hits.clear()
})

// Fast back-off and timeouts so the tests run in milliseconds; the logic is the same as with the defaults
const client = (retries = 3) => politeClient(0, { retries, backoffMs: 5, timeoutMs: 300 })
const quiet = async <T>(f: () => Promise<T>) => {
  const warn = console.warn
  console.warn = () => {}
  try {
    return await f()
  } finally {
    console.warn = warn
  }
}

describe("politeClient", () => {
  it("retries a 5xx and returns the page once the server answers", async () => {
    script.set("/list", [{ status: 504 }, { status: 503 }, { body: "<p>results</p>" }])
    assert.equal(await quiet(() => client()(`${base}/list`)), "<p>results</p>")
    assert.equal(hits.get("/list"), 3)
  })

  it("does not retry an answer that retrying won't change", async () => {
    script.set("/gone", [{ status: 404 }])
    await assert.rejects(client()(`${base}/gone`), /HTTP 404 for http/)
    assert.equal(hits.get("/gone"), 1)
  })

  it("retries a 200 that fails its check, and says what came back when it keeps failing", async () => {
    const check = (body: string) => (body.includes("job-count") ? null : "job count not found")
    script.set("/search", [{ body: "<title>Please wait</title>" }, { body: '<div class="job-count">12</div>' }])
    assert.match(await quiet(() => client()(`${base}/search`, { check })), /job-count/)
    assert.equal(hits.get("/search"), 2)

    script.set("/broken", [{ body: "<html><title>Service unavailable</title></html>" }])
    await assert.rejects(
      quiet(() => client(1)(`${base}/broken`, { check })),
      /job count not found \(HTTP 200, page "Service unavailable"\) for http/,
    )
    assert.equal(hits.get("/broken"), 2)
  })

  it("gives up on a request that gets no answer in time", async () => {
    script.set("/slow", [{ hang: true }])
    await assert.rejects(quiet(() => client(1)(`${base}/slow`)), /no answer within 0.3 s for http/)
    assert.equal(hits.get("/slow"), 2)
  })

  it("fails at once when the server asks to come back later than a run should wait", async () => {
    script.set("/maintenance", [{ status: 503, headers: { "Retry-After": "3600" } }])
    const started = Date.now()
    await assert.rejects(client()(`${base}/maintenance`), /HTTP 503 for .*come back in 3600 s/)
    assert.equal(hits.get("/maintenance"), 1)
    assert.ok(Date.now() - started < 1000)
  })

  it("stops calling a host once requests keep failing, and recovers when one gets through", async () => {
    const get = client(2)
    script.set("/a", [{ status: 500 }])
    script.set("/b", [{ status: 500 }])
    script.set("/c", [{ body: "fine" }])
    // The first failure uses its retries; the next request gets a single attempt
    await assert.rejects(quiet(() => get(`${base}/a`)), /HTTP 500/)
    assert.equal(hits.get("/a"), 3)
    await assert.rejects(quiet(() => get(`${base}/b`)), /HTTP 500/)
    assert.equal(hits.get("/b"), 1)
    // Two in a row: the host isn't called again this run
    await assert.rejects(get(`${base}/c`), /not tried: the last 2 requests to 127\.0\.0\.1:\d+ failed/)
    assert.equal(hits.get("/c"), undefined)

    // A success in between resets the count
    const fresh = client(0)
    script.set("/d", [{ status: 500 }])
    await assert.rejects(fresh(`${base}/d`), /HTTP 500/)
    assert.equal(await fresh(`${base}/c`), "fine")
    await assert.rejects(fresh(`${base}/d`), /HTTP 500/)
    assert.equal(await fresh(`${base}/c`), "fine")
  })

  it("does not count a 404 against the host", async () => {
    const get = client(0)
    script.set("/x", [{ status: 404 }])
    script.set("/ok", [{ body: "fine" }])
    for (let i = 0; i < 3; i++) await assert.rejects(get(`${base}/x`), /HTTP 404/)
    assert.equal(await get(`${base}/ok`), "fine")
  })

  it("takes a 404 after a failure as the host answering again, and gives the next request its retries", async () => {
    const get = client(1)
    script.set("/down", [{ status: 503 }])
    script.set("/gone", [{ status: 404 }])
    script.set("/flaky", [{ status: 503 }, { body: "fine" }])
    await assert.rejects(quiet(() => get(`${base}/down`)), /HTTP 503/)
    await assert.rejects(get(`${base}/gone`), /HTTP 404/)
    assert.equal(await quiet(() => get(`${base}/flaky`)), "fine")
    assert.equal(hits.get("/flaky"), 2)
  })

  it("does not take a 403 after a failure as the host being back", async () => {
    const get = client(1)
    script.set("/down", [{ status: 503 }])
    script.set("/blocked", [{ status: 403 }])
    script.set("/flaky", [{ status: 503 }, { body: "fine" }])
    await assert.rejects(quiet(() => get(`${base}/down`)), /HTTP 503/)
    await assert.rejects(get(`${base}/blocked`), /HTTP 403/)
    await assert.rejects(quiet(() => get(`${base}/flaky`)), /HTTP 503/)
    assert.equal(hits.get("/flaky"), 1)
  })
})
