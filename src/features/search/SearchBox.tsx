import { useEffect, useMemo, useState, type Ref } from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Building2, MapPin, Search, Tag, X } from "lucide-react"
import { FIELDS } from "@/domain/taxonomy"
import type { Vacancy } from "@/domain/vacancy"
import { normalize } from "@/features/filters/filtering"
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

type Agg = { key: string; label: string; sub: string; ids: string[]; norm: string }

type Props = {
  value: string
  items: Vacancy[]
  inputRef?: Ref<HTMLInputElement>
  onQuery: (q: string) => void
  onPickPlace: (ids: string[], label: string) => void
  onPickInstitution: (ids: string[], label: string) => void
  onPickField: (fieldId: string) => void
  className?: string
}

function aggregate(items: Vacancy[], keyOf: (v: Vacancy) => string | null, labelOf: (v: Vacancy) => [string, string]) {
  const map = new Map<string, Agg>()
  for (const v of items) {
    const key = keyOf(v)
    if (!key) continue
    const hit = map.get(key)
    if (hit) hit.ids.push(v.id)
    else {
      const [label, sub] = labelOf(v)
      map.set(key, { key, label, sub, ids: [v.id], norm: normalize(`${label} ${sub}`) })
    }
  }
  return [...map.values()].sort((a, b) => b.ids.length - a.ids.length)
}

/**
 * Typing filters results live; the dropdown offers *navigation* shortcuts —
 * jump to a place, an institution, or a field — so search doubles as geographic navigation.
 */
export function SearchBox({ value, items, inputRef, onQuery, onPickPlace, onPickInstitution, onPickField, className }: Props) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)

  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const t = setTimeout(() => onQuery(draft.trim()), 160)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const sources = useMemo(
    () => ({
      cities: aggregate(
        items,
        (v) => (v.city ? `${v.city}|${v.countryCode}` : null),
        (v) => [v.city!, [v.countryCode === "US" || v.countryCode === "CA" ? v.admin : null, v.country].filter(Boolean).join(", ")],
      ),
      countries: aggregate(items, (v) => v.country, (v) => [v.country, "Country"]),
      institutions: aggregate(items, (v) => v.institution, (v) => [v.institution, [v.city, v.country].filter(Boolean).join(", ")]),
    }),
    [items],
  )

  const term = normalize(draft.trim())
  const suggestions = useMemo(() => {
    if (term.length < 2) return null
    const match = (a: Agg) => a.norm.includes(term)
    return {
      places: [...sources.countries.filter(match).slice(0, 2), ...sources.cities.filter(match).slice(0, 4)],
      institutions: sources.institutions.filter(match).slice(0, 5),
      fields: FIELDS.filter((f) => normalize(f.label).includes(term)).slice(0, 3),
    }
  }, [sources, term])

  const hasSuggestions =
    !!suggestions && suggestions.places.length + suggestions.institutions.length + suggestions.fields.length > 0

  const finish = () => {
    setOpen(false)
    setDraft("")
  }

  return (
    <CommandPrimitive shouldFilter={false} loop className={cn("relative", className)} label="Search positions">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
        <CommandPrimitive.Input
          ref={inputRef}
          value={draft}
          onValueChange={(v) => {
            setDraft(v)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (draft) setDraft("")
              else (e.target as HTMLInputElement).blur()
              setOpen(false)
            }
            if (e.key === "Enter" && !hasSuggestions) {
              onQuery(draft.trim())
              setOpen(false)
            }
          }}
          placeholder="Search roles, institutions, places…"
          className="h-10 w-full rounded-xl border border-transparent bg-foreground/[0.045] pr-16 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/40 focus:bg-background focus:ring-3 focus:ring-ring/15"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {draft ? (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDraft("")
                onQuery("")
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : (
            <Kbd className="hidden sm:inline-flex">/</Kbd>
          )}
        </div>
      </div>

      {open && hasSuggestions && suggestions && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150">
          <CommandList className="max-h-[min(420px,60dvh)]">
            <CommandGroup heading={`Filter results for “${draft.trim()}”`}>
              <CommandItem value="__query" onSelect={() => setOpen(false)}>
                <Search className="text-muted-foreground" />
                <span>
                  Show all matches for <b className="font-medium">“{draft.trim()}”</b>
                </span>
                <Kbd className="ml-auto">↵</Kbd>
              </CommandItem>
            </CommandGroup>
            {suggestions.places.length > 0 && (
              <CommandGroup heading="Go to place">
                {suggestions.places.map((p) => (
                  <CommandItem
                    key={`p-${p.key}`}
                    value={`p-${p.key}`}
                    onSelect={() => {
                      onPickPlace(p.ids, p.label)
                      finish()
                    }}
                  >
                    <MapPin className="text-muted-foreground" />
                    <span className="truncate">{p.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.sub}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{p.ids.length}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {suggestions.institutions.length > 0 && (
              <CommandGroup heading="Institutions">
                {suggestions.institutions.map((p) => (
                  <CommandItem
                    key={`i-${p.key}`}
                    value={`i-${p.key}`}
                    onSelect={() => {
                      onPickInstitution(p.ids, p.label)
                      finish()
                    }}
                  >
                    <Building2 className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {p.label} <span className="text-xs text-muted-foreground">{p.sub}</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{p.ids.length}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {suggestions.fields.length > 0 && (
              <CommandGroup heading="Filter by field">
                {suggestions.fields.map((f) => (
                  <CommandItem
                    key={`f-${f.id}`}
                    value={`f-${f.id}`}
                    onSelect={() => {
                      onPickField(f.id)
                      finish()
                    }}
                  >
                    <Tag className="text-muted-foreground" />
                    {f.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </div>
      )}
    </CommandPrimitive>
  )
}
