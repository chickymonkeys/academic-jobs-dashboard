import { useSyncExternalStore } from "react"

/** Saved positions, per browser. Storage access is guarded: private mode or blocked storage degrades to in-memory. */
const KEY = "ajd.shortlist.v1"
const listeners = new Set<() => void>()
let ids: ReadonlySet<string> = load()

function load(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function commit(next: Set<string>) {
  ids = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    /* in-memory only */
  }
  listeners.forEach((l) => l())
}

export function toggleSaved(id: string) {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  commit(next)
  return next.has(id)
}

export function useShortlist() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => ids,
  )
}
