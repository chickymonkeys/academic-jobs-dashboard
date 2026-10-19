import { readonly, shallowRef } from "vue"

/** Saved positions, per browser. Storage access is guarded: private mode or blocked storage degrades to in-memory. */
const KEY = "ajd.shortlist.v1"

function load(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

const ids = shallowRef<ReadonlySet<string>>(load())

export function toggleSaved(id: string) {
  const next = new Set(ids.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  ids.value = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    /* in-memory only */
  }
  return next.has(id)
}

export const useShortlist = () => readonly(ids)
