import { USER_AGENT } from "../sources/types"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GETs for portals that are read page by page: one request at a time, at least `gapMs` apart. A network
 * error, 5xx or 429 is retried after backing off (30 s, 60 s, 120 s, or the server's Retry-After), since
 * one dropped page would otherwise throw the whole source back on its cached payload.
 * Single-request feeds can use plain fetch.
 */
export function politeClient(gapMs: number, retries = 3) {
  let last = 0
  return async function get(url: string, accept = "text/html"): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const wait = last + gapMs - Date.now()
      if (wait > 0) await sleep(wait)
      last = Date.now()
      let res: Response | null = null
      try {
        res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept } })
      } catch (e) {
        if (attempt >= retries) throw e
      }
      if (res?.ok) return res.text()
      if (res && ((res.status !== 429 && res.status < 500) || attempt >= retries)) {
        throw new Error(`HTTP ${res.status} for ${url}`)
      }
      const retryAfter = Number(res?.headers.get("retry-after"))
      const pause = retryAfter > 0 ? Math.min(retryAfter, 300) * 1000 : 30_000 * 2 ** attempt
      console.warn(`  ${res ? `HTTP ${res.status}` : "network error"} for ${url}; retrying in ${pause / 1000} s`)
      await sleep(pause)
      last = Date.now()
    }
  }
}
