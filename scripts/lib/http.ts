import { USER_AGENT } from "../sources/types"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type GetOptions = {
  /** The Accept header; text/html unless given */
  accept?: string
  /**
   * What a good answer holds. A 2xx page that fails it (a maintenance notice, an interstitial or a
   * half-rendered page served as 200) is retried like a 5xx. Returns why the page is wrong, or null.
   */
  check?: (body: string) => string | null
}

export type ClientOptions = {
  /** Retries after the first attempt, for 5xx, 429, timeouts, network errors and failed checks */
  retries?: number
  /** The first back-off; it doubles on each retry (30 s, 60 s, 120 s) */
  backoffMs?: number
  /** How long one attempt, body included, may take */
  timeoutMs?: number
  /**
   * A server asking to be retried later than this (Retry-After) is taken at its word: the request fails at
   * once and the cached payload stands in, rather than the run sleeping through the outage
   */
  maxRetryAfterMs?: number
}

/** Requests in a row that used up their retries before the client stops calling the host */
const GIVE_UP_AFTER = 2

/** An HTTP answer that retrying won't change (404, 403…) */
class Refused extends Error {}

/**
 * GETs for portals that are read page by page, and for single feeds: one request at a time, at least `gapMs`
 * apart. A network error, timeout, 5xx, 429 or page that fails its check is retried after backing off, since
 * one dropped page would otherwise throw the whole source back on its cached payload.
 *
 * A host that keeps failing is not hammered: once a request has used up its retries, the next one gets a
 * single attempt, and after two such failures in a row every later call fails at once. A portal that is
 * down then costs one request's retries, not one round per page.
 */
export function politeClient(gapMs: number, options: ClientOptions = {}) {
  const { retries = 3, backoffMs = 30_000, timeoutMs = 90_000, maxRetryAfterMs = 120_000 } = options
  let last = 0
  let failedInRow = 0

  return async function get(url: string, { accept = "text/html", check }: GetOptions = {}): Promise<string> {
    if (failedInRow >= GIVE_UP_AFTER) {
      throw new Error(`not tried: the last ${failedInRow} requests to ${new URL(url).host} failed`)
    }
    const tries = failedInRow ? 0 : retries
    for (let attempt = 0; ; attempt++) {
      const wait = last + gapMs - Date.now()
      if (wait > 0) await sleep(wait)
      last = Date.now()

      let problem: string
      let asked: number | null = null
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: accept },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (res.ok) {
          const body = await res.text()
          const wrong = check?.(body) ?? null
          if (wrong == null) {
            failedInRow = 0
            return body
          }
          const title = pageTitle(body)
          problem = `${wrong} (HTTP ${res.status}${title ? `, page "${title}"` : ""})`
        } else {
          await res.body?.cancel().catch(() => {})
          // Not found is the host answering about this page, so it is up again; a 403 may be a blanket block
          if (res.status === 404 || res.status === 410) failedInRow = 0
          if (res.status !== 429 && res.status < 500) throw new Refused(`HTTP ${res.status} for ${url}`)
          problem = `HTTP ${res.status}`
          asked = retryAfterMs(res.headers.get("retry-after"))
        }
      } catch (e) {
        if (e instanceof Refused) throw e
        const err = e as Error & { cause?: { code?: string } }
        problem =
          err.name === "TimeoutError" ? `no answer within ${timeoutMs / 1000} s` : `network error (${err.cause?.code ?? err.message})`
      }

      if (asked != null && asked > maxRetryAfterMs) {
        failedInRow++
        throw new Error(`${problem} for ${url}; the server asks to come back in ${Math.round(asked / 1000)} s`)
      }
      if (attempt >= tries) {
        failedInRow++
        throw new Error(`${problem} for ${url}`)
      }
      const pause = asked != null ? Math.max(asked, 1000) : backoffMs * 2 ** attempt
      console.warn(`  ${problem} for ${url}; retrying in ${pause / 1000} s`)
      await sleep(pause)
      last = Date.now()
    }
  }
}

/** Retry-After in seconds, or as an HTTP date */
function retryAfterMs(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const at = Date.parse(header)
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now())
}

/** What a wrong page calls itself, so a log says what came back instead of the page we wanted */
function pageTitle(body: string): string | null {
  const title = body.match(/<title[^>]*>([^<]*)/i)?.[1].replace(/\s+/g, " ").trim()
  return title ? title.slice(0, 80) : null
}
