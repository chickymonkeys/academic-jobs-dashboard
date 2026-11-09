<script setup lang="ts">
import { computed } from "vue"
import { list, toggleIn, type AppSearch, type SetSearch } from "@/app/search"
import type { SourceId } from "@/domain/vacancy"
import Chip from "./Chip.vue"
import DeadlineChip from "./DeadlineChip.vue"
import FacetChip from "./FacetChip.vue"
import { activeFilterCount, NO_FILTERS, useFacetOptions, type FilterSection } from "./facets"
import type { FacetCounts } from "./filtering"

const props = defineProps<{
  search: AppSearch
  set: SetSearch
  facets: FacetCounts
  /** What the list would hold with the Saved or New switch on, every other filter applied, like each facet's counts */
  savedCount: number
  freshCount: number
  /** Sources the snapshot was built from; one the ingest leaves off has nothing to filter, unless it's selected */
  sourceIds?: readonly SourceId[]
  /** Phones: chips summarize, and tapping one opens the filter sheet at its section */
  sheet?: boolean
}>()
const emit = defineEmits<{ open: [section: FilterSection | null] }>()

const cats = computed(() => list(props.search.cat))
const discs = computed(() => list(props.search.disc))
const fields = computed(() => list(props.search.field))
const sources = computed(() => list(props.search.src))
const activeCount = computed(() => activeFilterCount(props.search))
const anyActive = computed(() => activeCount.value > 0)

const options = useFacetOptions(
  () => props.facets,
  () => props.search,
  () => props.sourceIds,
)
const catOptions = options.cats
const discOptions = options.discs
const fieldOptions = options.fields
const sourceOptions = options.sources

const clearAll = () => props.set(NO_FILTERS)
</script>

<template>
  <!-- Phones: one "Filters" entry point with a count, then the facets most people narrow by, in thumb order -->
  <div v-if="sheet" class="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
    <Chip :active="anyActive" aria-haspopup="dialog" :aria-label="anyActive ? `Filters, ${activeCount} on` : 'Filters'" @click="emit('open', null)">
      <UIcon name="i-lucide-sliders-horizontal" class="size-3.5" aria-hidden="true" />
      Filters
      <span
        v-if="anyActive"
        class="-mr-1 inline-flex size-[18px] items-center justify-center rounded-full bg-default text-[10px] font-semibold text-primary tabular-nums"
        aria-hidden="true"
      >
        {{ activeCount }}
      </span>
    </Chip>
    <DeadlineChip :search="search" :set="set" sheet @open="emit('open', 'deadline')" />
    <FacetChip label="Position" :options="catOptions" :selected="cats" sheet @open="emit('open', 'position')" />
    <FacetChip label="Discipline" :options="discOptions" :selected="discs" sheet @open="emit('open', 'discipline')" />
    <Chip
      :active="!!search.fresh"
      :aria-pressed="!!search.fresh"
      :title="search.fresh ? 'Showing only positions posted in the last 7 days: click to show all' : 'Show only positions posted in the last 7 days'"
      @click="set({ fresh: search.fresh ? undefined : true })"
    >
      <UIcon name="i-lucide-sparkles" class="size-3.5" aria-hidden="true" />
      New
      <span v-if="freshCount > 0" class="tabular-nums opacity-70">{{ freshCount }}</span>
      <UIcon v-if="search.fresh" name="i-lucide-x" class="-mr-1 size-3.5" aria-hidden="true" />
    </Chip>
    <Chip
      :active="!!search.saved"
      :aria-pressed="!!search.saved"
      :title="search.saved ? 'Showing only saved positions: click to show all' : 'Show only saved positions'"
      @click="set({ saved: search.saved ? undefined : true })"
    >
      <UIcon name="i-lucide-star" class="size-3.5" :class="search.saved && '*:fill-current'" aria-hidden="true" />
      Saved
      <span v-if="savedCount > 0" class="tabular-nums opacity-70">{{ savedCount }}</span>
      <UIcon v-if="search.saved" name="i-lucide-x" class="-mr-1 size-3.5" aria-hidden="true" />
    </Chip>
    <FacetChip label="Field" :options="fieldOptions" :selected="fields" sheet @open="emit('open', 'field')" />
    <FacetChip label="Source" :options="sourceOptions" :selected="sources" sheet @open="emit('open', 'source')" />
  </div>

  <div v-else class="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
    <FacetChip
      label="Discipline"
      :options="discOptions"
      :selected="discs"
      @toggle="(id) => set((p) => ({ disc: toggleIn(p.disc, id) }))"
      @clear="set({ disc: undefined })"
    />
    <FacetChip
      label="Position"
      :options="catOptions"
      :selected="cats"
      @toggle="(id) => set((p) => ({ cat: toggleIn(p.cat, id) }))"
      @clear="set({ cat: undefined })"
    />
    <FacetChip
      label="Field"
      searchable
      :options="fieldOptions"
      :selected="fields"
      @toggle="(id) => set((p) => ({ field: toggleIn(p.field, id) }))"
      @clear="set({ field: undefined })"
    />
    <DeadlineChip :search="search" :set="set" />
    <Chip
      :active="!!search.fresh"
      :aria-pressed="!!search.fresh"
      :title="search.fresh ? 'Showing only positions posted in the last 7 days: click to show all' : 'Show only positions posted in the last 7 days'"
      @click="set({ fresh: search.fresh ? undefined : true })"
    >
      <UIcon name="i-lucide-sparkles" class="size-3.5" aria-hidden="true" />
      New
      <span v-if="freshCount > 0" class="tabular-nums opacity-70">{{ freshCount }}</span>
      <UIcon v-if="search.fresh" name="i-lucide-x" class="-mr-1 size-3.5" aria-hidden="true" />
    </Chip>
    <Chip
      :active="!!search.saved"
      :aria-pressed="!!search.saved"
      :title="search.saved ? 'Showing only saved positions: click to show all' : 'Show only saved positions'"
      @click="set({ saved: search.saved ? undefined : true })"
    >
      <UIcon name="i-lucide-star" class="size-3.5" :class="search.saved && '*:fill-current'" aria-hidden="true" />
      Saved
      <span v-if="savedCount > 0" class="tabular-nums opacity-70">{{ savedCount }}</span>
      <UIcon v-if="search.saved" name="i-lucide-x" class="-mr-1 size-3.5" aria-hidden="true" />
    </Chip>
    <FacetChip
      label="Source"
      :options="sourceOptions"
      :selected="sources"
      @toggle="(id) => set((p) => ({ src: toggleIn(p.src, id) }))"
      @clear="set({ src: undefined })"
    />
    <UButton
      v-if="anyActive"
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-x"
      class="h-8 shrink-0 rounded-full px-2.5 text-xs text-muted"
      @click="clearAll"
    >
      Clear
    </UButton>
  </div>
</template>
