<script setup lang="ts">
import { computed } from "vue"
import type { DropdownMenuItem } from "@nuxt/ui"
import type { AppSearch, SetSearch } from "@/app/search"
import type { Scope, SortKey } from "@/features/filters/filtering"
import { activeFilterCount } from "@/features/filters/facets"
import { sortById, sortsFor } from "./sorts"

const props = defineProps<{
  count: number
  /** What the search and filters leave, before the map, a region or a group narrows it */
  total: number
  /** Everything the search and filters choose from: every open listing (closed ones too, when included) */
  all: number
  scope: Scope
  groupLabel?: string
  regionLabel?: string
  sortKey: SortKey
  hasQuery: boolean
  search: AppSearch
  set: SetSearch
  showViewToggle: boolean
  /** Phones: the sort button opens the sort sheet instead of a menu */
  sheet?: boolean
}>()
const emit = defineEmits<{ clearGroup: []; world: []; sort: []; clearFilters: [] }>()

const sort = computed(() => sortById(props.sortKey))
// Filters and the search can hide most of the board without the list looking any different, so the header says
// how much they hide; and the count they leave is not the "total"
const hidden = computed(() => Math.max(0, props.all - props.total))
const filtered = computed(() => hidden.value > 0)
const totalNote = computed(() => `${props.total.toLocaleString()} ${filtered.value ? "match" : "total"}`)
const hiddenBy = computed(() => {
  // "Include closed" only ever adds listings, so it isn't one of the filters doing the hiding
  const filters = activeFilterCount(props.search) - Number(!!props.search.closed) > 0
  if (!props.search.q) return "Filters hide"
  return filters ? "Search and filters hide" : "Search hides"
})

const menu = computed<DropdownMenuItem[][]>(() => [
  [
    { type: "label", label: "Sort by" },
    ...sortsFor(props.hasQuery).map(
      (s): DropdownMenuItem => ({
        label: s.label,
        type: "checkbox",
        checked: props.sortKey === s.id,
        disabled: s.id === "relevance" && !props.hasQuery,
        onSelect: () => props.set({ sort: s.id }),
      }),
    ),
  ],
  [
    {
      label: "Follow map area",
      type: "checkbox",
      checked: props.search.area !== false,
      onSelect: () => props.set({ area: props.search.area === false ? undefined : false }),
    },
  ],
])

const link = "font-medium text-primary underline-offset-2 hover:underline"
</script>

<!-- Always answers "how many, and where?" — the scope line makes the map-linked list legible -->
<template>
  <div class="px-4 pt-3 pb-2">
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-highlighted tabular-nums" aria-live="polite">
          {{ count.toLocaleString() }} {{ count === 1 ? "position" : "positions" }}
        </h2>
        <!-- The description gives way to the action when space runs short: "List all" is never cut off -->
        <p class="flex min-w-0 text-xs whitespace-nowrap text-muted">
          <template v-if="scope === 'group'">
            <span class="truncate">at {{ groupLabel }}</span>
            <span class="shrink-0">&nbsp;· <button :class="link" @click="emit('clearGroup')">Show all</button></span>
          </template>
          <template v-else-if="scope === 'region'">
            <span class="truncate">in {{ regionLabel }} · {{ totalNote }}</span>
            <span class="shrink-0">&nbsp;· <button :class="link" @click="emit('world')">Show all</button></span>
          </template>
          <template v-else-if="scope === 'area'">
            <span class="truncate">in map view · {{ totalNote }}</span>
            <span class="shrink-0">&nbsp;· <button :class="link" @click="set({ area: false })">List all</button></span>
          </template>
          <span v-else-if="scope === 'world'" class="truncate">worldwide{{ filtered ? ` · ${totalNote}` : "" }}</span>
          <template v-else>
            <span class="truncate">everywhere, map ignored{{ filtered ? ` · ${totalNote}` : "" }}</span>
            <span class="shrink-0">&nbsp;· <button :class="link" @click="set({ area: undefined })">Follow map</button></span>
          </template>
        </p>
      </div>
      <!-- The order is named on the button, so "sorted by deadline" is visible without opening anything -->
      <UButton
        v-if="sheet"
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-arrow-up-down"
        :aria-label="`Sort: ${sort.label}`"
        aria-haspopup="dialog"
        class="h-9 shrink-0 rounded-full px-3 text-xs"
        @click="emit('sort')"
      >
        {{ sort.short }}
      </UButton>
      <UDropdownMenu v-else :items="menu" :content="{ align: 'end' }" :ui="{ content: 'w-56' }">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-up-down"
          :aria-label="`Sort: ${sort.label}`"
          class="shrink-0 text-xs text-toned"
        >
          {{ sort.short }}
        </UButton>
      </UDropdownMenu>
      <UFieldGroup v-if="showViewToggle" size="sm" aria-label="Result layout">
        <UButton
          color="neutral"
          :variant="(search.view ?? 'list') === 'list' ? 'subtle' : 'outline'"
          icon="i-lucide-list"
          aria-label="List view"
          :aria-pressed="(search.view ?? 'list') === 'list'"
          @click="set({ view: undefined })"
        />
        <UButton
          color="neutral"
          :variant="search.view === 'table' ? 'subtle' : 'outline'"
          icon="i-lucide-table-2"
          aria-label="Table view"
          :aria-pressed="search.view === 'table'"
          @click="set({ view: 'table' })"
        />
      </UFieldGroup>
    </div>
    <!-- Its own row, the panel's full width: what the filters hide must never be the part that's cut off. Screen
         readers hear it with the count: the live region stays in the page so the line appearing is announced, and
         reads whole so a changed number comes with what it counts. -->
    <div aria-live="polite" aria-atomic="true">
      <p v-if="filtered" class="mt-2 flex min-w-0 items-center rounded-md bg-elevated px-2 py-1.5 text-xs whitespace-nowrap text-toned">
        <UIcon name="i-lucide-filter" class="mr-1.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span class="truncate">
          {{ hiddenBy }} {{ hidden.toLocaleString() }} of {{ all.toLocaleString() }} {{ search.closed ? "positions" : "open positions" }}
        </span>
        <span class="shrink-0">&nbsp;· <button :class="link" @click="emit('clearFilters')">Clear</button></span>
      </p>
    </div>
  </div>
</template>
