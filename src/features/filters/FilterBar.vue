<script setup lang="ts">
import { computed } from "vue"
import { CATEGORIES, DISCIPLINES, FIELDS } from "@/domain/taxonomy"
import { list, toggleIn, type AppSearch, type SetSearch } from "@/app/search"
import { SOURCE_IDS, type SourceId } from "@/domain/vacancy"
import { sourceLabel, sourceName } from "@/components/job/labels"
import { useMode } from "@/lib/theme"
import Chip from "./Chip.vue"
import DeadlineChip from "./DeadlineChip.vue"
import FacetChip, { type FacetOption } from "./FacetChip.vue"
import type { facetCounts } from "./filtering"

const props = defineProps<{
  search: AppSearch
  set: SetSearch
  facets: ReturnType<typeof facetCounts>
  savedCount: number
  freshCount: number
  /** Sources the snapshot was built from; one the ingest leaves off has nothing to filter, unless it's selected */
  sourceIds?: readonly SourceId[]
}>()

const mode = useMode()
const cats = computed(() => list(props.search.cat))
const discs = computed(() => list(props.search.disc))
const fields = computed(() => list(props.search.field))
const sources = computed(() => list(props.search.src))
const anyActive = computed(
  () =>
    cats.value.length + discs.value.length + fields.value.length + sources.value.length > 0 ||
    !!props.search.dl ||
    !!props.search.closed ||
    !!props.search.saved ||
    !!props.search.fresh,
)

const catOptions = computed<FacetOption[]>(() =>
  CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: props.facets.cats[c.id] ?? 0, color: c.color[mode.value] })),
)
const discOptions = computed<FacetOption[]>(() =>
  DISCIPLINES.map((d) => ({ id: d.id, label: d.label, count: props.facets.discs[d.id] ?? 0 })),
)
const fieldOptions = computed<FacetOption[]>(() =>
  FIELDS.map((f) => ({ id: f.id, label: f.label, count: props.facets.fields[f.id] ?? 0 })).sort((a, b) => b.count - a.count),
)
const sourceOptions = computed<FacetOption[]>(() =>
  SOURCE_IDS.filter((s) => !props.sourceIds || props.sourceIds.includes(s) || sources.value.includes(s)).map((s) => ({
    id: s,
    label: sourceName(s),
    count: props.facets.sources[s] ?? 0,
    tag: sourceLabel(s),
  })),
)

const clearAll = () =>
  props.set({
    cat: undefined,
    disc: undefined,
    field: undefined,
    src: undefined,
    dl: undefined,
    closed: undefined,
    saved: undefined,
    fresh: undefined,
  })
</script>

<template>
  <div class="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
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
      title="Posted in the last 7 days"
      @click="set({ fresh: search.fresh ? undefined : true })"
    >
      <UIcon name="i-lucide-sparkles" class="size-3.5" />
      New
      <span v-if="freshCount > 0" class="tabular-nums opacity-70">{{ freshCount }}</span>
    </Chip>
    <Chip :active="!!search.saved" :aria-pressed="!!search.saved" @click="set({ saved: search.saved ? undefined : true })">
      <UIcon name="i-lucide-star" class="size-3.5" :class="search.saved && '*:fill-current'" />
      Saved
      <span v-if="savedCount > 0" class="tabular-nums opacity-70">{{ savedCount }}</span>
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
