<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue"
import { list, toggleIn, type AppSearch, type SetSearch } from "@/app/search"
import type { SourceId } from "@/domain/vacancy"
import { usePrefersReducedMotion } from "@/lib/media"
import { activeFilterCount, DEADLINE_CHOICES, NO_FILTERS, useFacetOptions, type FilterSection } from "./facets"
import type { FacetCounts } from "./filtering"
import OptionChip from "./OptionChip.vue"

const props = defineProps<{
  search: AppSearch
  set: SetSearch
  facets: FacetCounts
  savedCount: number
  freshCount: number
  sourceIds?: readonly SourceId[]
  /** What the list will hold with these filters, so the button can say it before you leave */
  resultCount: number
  /** Where to open the sheet: the part a chip stands for, or the top */
  section: FilterSection | null
}>()
const open = defineModel<boolean>("open", { required: true })
const emit = defineEmits<{ done: [] }>()

const options = useFacetOptions(
  () => props.facets,
  () => props.search,
  () => props.sourceIds,
)
const picked = computed(() => ({
  cat: list(props.search.cat),
  disc: list(props.search.disc),
  field: list(props.search.field),
  src: list(props.search.src),
}))
const activeCount = computed(() => activeFilterCount(props.search))

// Twenty JEL fields are too many to scan on a phone: the busiest eight, plus any you've picked, until you ask for all
const FIELDS_SHOWN = 8
const allFields = ref(false)
const fieldOptions = computed(() => {
  const all = options.fields.value
  if (allFields.value) return all
  const top = all.slice(0, FIELDS_SHOWN)
  return [...top, ...all.slice(FIELDS_SHOWN).filter((o) => picked.value.field.includes(o.id))]
})

const dlCount = (v: (typeof DEADLINE_CHOICES)[number]["value"]) => props.facets.dls[v]
const setDeadline = (v: (typeof DEADLINE_CHOICES)[number]["value"]) =>
  props.set({ dl: v === "any" ? undefined : (v as AppSearch["dl"]) })

const closed = computed({
  get: () => !!props.search.closed,
  set: (c: boolean) => props.set({ closed: c || undefined }),
})
const fresh = computed({
  get: () => !!props.search.fresh,
  set: (c: boolean) => props.set({ fresh: c || undefined }),
})
const saved = computed({
  get: () => !!props.search.saved,
  set: (c: boolean) => props.set({ saved: c || undefined }),
})

// Opened from a chip: bring that part of the sheet to the top
const body = useTemplateRef<HTMLElement>("body")
const reduce = usePrefersReducedMotion()
watch(open, async (isOpen) => {
  if (!isOpen) return
  allFields.value = allFields.value || picked.value.field.length > 0
  await nextTick()
  requestAnimationFrame(() => {
    const el = props.section ? body.value?.querySelector<HTMLElement>(`[data-section="${props.section}"]`) : null
    body.value?.scrollTo({ top: el ? el.offsetTop - 8 : 0, behavior: el && !reduce.value ? "smooth" : "auto" })
  })
})

function done() {
  open.value = false
  emit("done")
}

const heading = "mb-2.5 flex items-baseline justify-between text-sm font-semibold text-highlighted"
const row = "flex min-h-12 cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-highlighted"
</script>

<!--
  Phones: every filter in one sheet, as finger-sized choices with live counts. Choices apply as you tap
  (the map behind updates), and the button says how many positions you'll see before you close it.
-->
<template>
  <UDrawer
    v-model:open="open"
    title="Filters"
    description="Narrow the positions on the map and in the list"
    :ui="{
      overlay: 'z-40 bg-black/35 dark:bg-black/55',
      content:
        'z-50 max-h-[90dvh] rounded-t-2xl ring-0 sm:right-auto sm:left-[max(env(safe-area-inset-left),12px)] sm:w-[400px]',
      handle: 'mt-2 mb-0 !h-1 !w-10',
    }"
  >
    <template #content>
      <div class="flex min-h-0 flex-1 flex-col">
        <header class="flex items-center gap-2 px-4 pt-2 pb-2">
          <h2 class="flex-1 text-base font-semibold text-highlighted">Filters</h2>
          <UButton
            v-if="activeCount > 0"
            color="neutral"
            variant="ghost"
            size="sm"
            class="text-muted"
            @click="set(NO_FILTERS)"
          >
            Clear all
          </UButton>
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-x" aria-label="Close filters" class="size-9 justify-center" @click="open = false" />
        </header>

        <div ref="body" class="scrollbar-thin relative min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain border-t border-default px-4 pt-4 pb-6" data-vaul-no-drag>
          <section data-section="deadline" aria-labelledby="fs-deadline">
            <h3 id="fs-deadline" :class="heading">Deadline</h3>
            <div role="radiogroup" aria-labelledby="fs-deadline" class="flex flex-wrap gap-2">
              <OptionChip
                v-for="d in DEADLINE_CHOICES"
                :key="d.value"
                kind="radio"
                :active="(search.dl ?? 'any') === d.value"
                :count="dlCount(d.value)"
                @click="setDeadline(d.value)"
              >
                {{ d.short }}
              </OptionChip>
            </div>
            <label :class="row" class="mt-2">
              <span>
                Include closed positions
                <span class="block text-xs font-normal text-muted">Past their last date to apply</span>
              </span>
              <USwitch v-model="closed" />
            </label>
          </section>

          <section data-section="position" aria-labelledby="fs-position">
            <h3 id="fs-position" :class="heading">Position type</h3>
            <div class="flex flex-wrap gap-2">
              <OptionChip
                v-for="o in options.cats.value"
                :key="o.id"
                :active="picked.cat.includes(o.id)"
                :count="o.count"
                :color="o.color"
                @click="set((p) => ({ cat: toggleIn(p.cat, o.id) }))"
              >
                {{ o.label }}
              </OptionChip>
            </div>
          </section>

          <section data-section="discipline" aria-labelledby="fs-discipline">
            <h3 id="fs-discipline" :class="heading">Discipline</h3>
            <div class="flex flex-wrap gap-2">
              <OptionChip
                v-for="o in options.discs.value"
                :key="o.id"
                :active="picked.disc.includes(o.id)"
                :count="o.count"
                @click="set((p) => ({ disc: toggleIn(p.disc, o.id) }))"
              >
                {{ o.label }}
              </OptionChip>
            </div>
          </section>

          <section aria-labelledby="fs-show">
            <h3 id="fs-show" :class="heading">Show only</h3>
            <div class="divide-y divide-default">
              <label :class="row">
                <span class="inline-flex items-center gap-2">
                  <UIcon name="i-lucide-sparkles" class="size-4 text-muted" aria-hidden="true" />
                  Posted in the last 7 days
                  <span class="text-xs text-muted tabular-nums">{{ freshCount }}</span>
                </span>
                <USwitch v-model="fresh" />
              </label>
              <label :class="row">
                <span class="inline-flex items-center gap-2">
                  <UIcon name="i-lucide-star" class="size-4 text-muted" aria-hidden="true" />
                  Saved positions
                  <span class="text-xs text-muted tabular-nums">{{ savedCount }}</span>
                </span>
                <USwitch v-model="saved" />
              </label>
            </div>
          </section>

          <section data-section="field" aria-labelledby="fs-field">
            <h3 id="fs-field" :class="heading">
              Field
              <span class="text-xs font-normal text-muted">JEL classification</span>
            </h3>
            <div class="flex flex-wrap gap-2">
              <OptionChip
                v-for="o in fieldOptions"
                :key="o.id"
                :active="picked.field.includes(o.id)"
                :count="o.count"
                @click="set((p) => ({ field: toggleIn(p.field, o.id) }))"
              >
                {{ o.label }}
              </OptionChip>
            </div>
            <UButton
              v-if="options.fields.value.length > FIELDS_SHOWN"
              color="neutral"
              variant="link"
              size="sm"
              class="mt-1.5 px-0"
              :trailing-icon="allFields ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              @click="allFields = !allFields"
            >
              {{ allFields ? "Show fewer fields" : `Show all ${options.fields.value.length} fields` }}
            </UButton>
          </section>

          <section data-section="source" aria-labelledby="fs-source">
            <h3 id="fs-source" :class="heading">Listed on</h3>
            <div class="flex flex-wrap gap-2">
              <OptionChip
                v-for="o in options.sources.value"
                :key="o.id"
                :active="picked.src.includes(o.id)"
                :count="o.count"
                @click="set((p) => ({ src: toggleIn(p.src, o.id) }))"
              >
                {{ o.label }}
              </OptionChip>
            </div>
          </section>
        </div>

        <footer class="border-t border-default px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <UButton
            block
            size="lg"
            :color="resultCount === 0 ? 'neutral' : 'primary'"
            :variant="resultCount === 0 ? 'subtle' : 'solid'"
            class="h-12 rounded-xl text-[15px]"
            @click="done"
          >
            <template v-if="resultCount === 0">No positions match: loosen a filter</template>
            <template v-else>Show {{ resultCount.toLocaleString() }} {{ resultCount === 1 ? "position" : "positions" }}</template>
          </UButton>
        </footer>
      </div>
    </template>
  </UDrawer>
</template>
