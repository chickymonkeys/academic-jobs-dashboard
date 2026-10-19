<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from "vue"
import { DISCIPLINES, FIELDS } from "@/domain/taxonomy"
import type { Discipline, Vacancy } from "@/domain/vacancy"
import { normalize } from "@/features/filters/filtering"

type Agg = { key: string; label: string; sub: string; ids: string[]; norm: string }
type Option =
  | { kind: "query"; id: string }
  | { kind: "place"; id: string; agg: Agg }
  | { kind: "institution"; id: string; agg: Agg }
  | { kind: "discipline"; id: string; discId: Discipline; label: string }
  | { kind: "field"; id: string; fieldId: string; label: string }

const props = defineProps<{ value: string; items: Vacancy[] }>()
const emit = defineEmits<{
  query: [q: string]
  pickPlace: [ids: string[], label: string]
  pickInstitution: [ids: string[], label: string]
  pickDiscipline: [discId: Discipline]
  pickField: [fieldId: string]
}>()

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

const draft = ref(props.value)
const open = ref(false)
const active = ref(0)
const input = useTemplateRef<{ inputRef: HTMLInputElement | null }>("input")
const listId = useId()

watch(
  () => props.value,
  (v) => (draft.value = v),
)
let debounce: ReturnType<typeof setTimeout> | undefined
watch(draft, (d) => {
  clearTimeout(debounce)
  if (d === props.value) return
  debounce = setTimeout(() => emit("query", d.trim()), 160)
})
onBeforeUnmount(() => clearTimeout(debounce))

const sources = computed(() => ({
  cities: aggregate(
    props.items,
    (v) => (v.city ? `${v.city}|${v.countryCode}` : null),
    (v) => [v.city!, [v.countryCode === "US" || v.countryCode === "CA" ? v.admin : null, v.country].filter(Boolean).join(", ")],
  ),
  countries: aggregate(props.items, (v) => v.country, (v) => [v.country, "Country"]),
  institutions: aggregate(
    props.items,
    (v) => v.institution,
    (v) => [v.institution, [v.city, v.country].filter(Boolean).join(", ")],
  ),
}))

const term = computed(() => normalize(draft.value.trim()))
const groups = computed(() => {
  if (term.value.length < 2) return []
  const match = (a: Agg) => a.norm.includes(term.value)
  const places = [...sources.value.countries.filter(match).slice(0, 2), ...sources.value.cities.filter(match).slice(0, 4)]
  const institutions = sources.value.institutions.filter(match).slice(0, 5)
  const discs = DISCIPLINES.filter((d) => normalize(d.label).includes(term.value))
  const fields = FIELDS.filter((f) => normalize(f.label).includes(term.value)).slice(0, 3)
  if (!places.length && !institutions.length && !discs.length && !fields.length) return []
  return [
    { heading: `Filter results for “${draft.value.trim()}”`, options: [{ kind: "query", id: "q" } as Option] },
    { heading: "Go to place", options: places.map((agg): Option => ({ kind: "place", id: `p-${agg.key}`, agg })) },
    {
      heading: "Institutions",
      options: institutions.map((agg): Option => ({ kind: "institution", id: `i-${agg.key}`, agg })),
    },
    {
      heading: "Filter by discipline",
      options: discs.map((d): Option => ({ kind: "discipline", id: `d-${d.id}`, discId: d.id, label: d.label })),
    },
    {
      heading: "Filter by field",
      options: fields.map((f): Option => ({ kind: "field", id: `f-${f.id}`, fieldId: f.id, label: f.label })),
    },
  ].filter((g) => g.options.length)
})
const flat = computed(() => groups.value.flatMap((g) => g.options))
const showList = computed(() => open.value && flat.value.length > 0)
watch(term, () => (active.value = 0))

const optionId = (o: Option) => `${listId}-${o.id.replace(/[^\w-]/g, "_")}`

function finish() {
  open.value = false
  draft.value = ""
}

function choose(o: Option) {
  if (o.kind === "query") {
    emit("query", draft.value.trim())
    open.value = false
  } else if (o.kind === "place") {
    emit("pickPlace", o.agg.ids, o.agg.label)
    finish()
  } else if (o.kind === "institution") {
    emit("pickInstitution", o.agg.ids, o.agg.label)
    finish()
  } else if (o.kind === "discipline") {
    emit("pickDiscipline", o.discId)
    finish()
  } else {
    emit("pickField", o.fieldId)
    finish()
  }
}

function onKeydown(e: KeyboardEvent) {
  const n = flat.value.length
  if (e.key === "Escape") {
    if (draft.value) draft.value = ""
    else (e.target as HTMLInputElement).blur()
    open.value = false
  } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && showList.value) {
    e.preventDefault()
    active.value = (active.value + (e.key === "ArrowDown" ? 1 : -1) + n) % n
  } else if (e.key === "Enter") {
    if (showList.value) choose(flat.value[active.value]!)
    else {
      emit("query", draft.value.trim())
      open.value = false
    }
  }
}

function clear() {
  draft.value = ""
  emit("query", "")
}

defineExpose({ focus: () => input.value?.inputRef?.focus() })
</script>

<!--
  Typing filters results live; the dropdown offers *navigation* shortcuts —
  jump to a place or an institution, or filter by discipline or field — so search doubles as geographic navigation.
-->
<template>
  <div class="relative">
    <UInput
      ref="input"
      v-model="draft"
      icon="i-lucide-search"
      variant="soft"
      size="lg"
      placeholder="Search roles, institutions, places…"
      aria-label="Search positions"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="showList"
      :aria-controls="listId"
      :aria-activedescendant="showList ? optionId(flat[active]!) : undefined"
      class="w-full"
      :ui="{
        base: 'h-10 rounded-xl text-sm focus:bg-default focus:ring-3 focus:ring-primary/15',
        leadingIcon: 'size-4',
        trailing: 'pe-2',
      }"
      @focus="open = true"
      @blur="open = false"
      @update:model-value="open = true"
      @keydown="onKeydown"
    >
      <template #trailing>
        <UButton
          v-if="draft"
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-x"
          aria-label="Clear search"
          class="text-muted"
          @mousedown.prevent
          @click="clear"
        />
        <UKbd v-else value="/" class="hidden sm:inline-flex" />
      </template>
    </UInput>

    <div
      v-if="showList"
      :id="listId"
      role="listbox"
      class="scrollbar-thin absolute inset-x-0 top-full z-40 mt-1.5 max-h-[min(420px,60dvh)] overflow-y-auto rounded-xl border border-default bg-default p-1 shadow-lg"
      @mousedown.prevent
    >
      <div v-for="g in groups" :key="g.heading" role="group" :aria-label="g.heading">
        <div class="truncate px-2 pt-2 pb-1 text-xs font-medium text-muted">{{ g.heading }}</div>
        <div
          v-for="o in g.options"
          :id="optionId(o)"
          :key="o.id"
          role="option"
          :aria-selected="flat[active] === o"
          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-highlighted"
          :class="flat[active] === o && 'bg-elevated'"
          @mouseenter="active = flat.indexOf(o)"
          @click="choose(o)"
        >
          <template v-if="o.kind === 'query'">
            <UIcon name="i-lucide-search" class="size-4 shrink-0 text-muted" />
            <span class="truncate">
              Show all matches for <b class="font-medium">“{{ draft.trim() }}”</b>
            </span>
            <UKbd value="enter" class="ml-auto" />
          </template>
          <template v-else-if="o.kind === 'place'">
            <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
            <span class="truncate">{{ o.agg.label }}</span>
            <span class="truncate text-xs text-muted">{{ o.agg.sub }}</span>
            <span class="ml-auto text-xs text-muted tabular-nums">{{ o.agg.ids.length }}</span>
          </template>
          <template v-else-if="o.kind === 'institution'">
            <UIcon name="i-lucide-building-2" class="size-4 shrink-0 text-muted" />
            <span class="min-w-0 flex-1 truncate">
              {{ o.agg.label }} <span class="text-xs text-muted">{{ o.agg.sub }}</span>
            </span>
            <span class="text-xs text-muted tabular-nums">{{ o.agg.ids.length }}</span>
          </template>
          <template v-else-if="o.kind === 'discipline'">
            <UIcon name="i-lucide-graduation-cap" class="size-4 shrink-0 text-muted" />
            {{ o.label }}
          </template>
          <template v-else>
            <UIcon name="i-lucide-tag" class="size-4 shrink-0 text-muted" />
            {{ o.label }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
