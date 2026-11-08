<script setup lang="ts">
import { computed } from "vue"
import type { DropdownMenuItem } from "@nuxt/ui"
import type { AppSearch, SetSearch } from "@/app/search"
import type { Scope, SortKey } from "@/features/filters/filtering"
import { sortById, sortsFor } from "./sorts"

const props = defineProps<{
  count: number
  total: number
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
const emit = defineEmits<{ clearGroup: []; world: []; sort: [] }>()

const sort = computed(() => sortById(props.sortKey))

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
  <div class="flex items-center gap-2 px-4 pt-3 pb-2">
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
          <span class="truncate">in {{ regionLabel }} · {{ total.toLocaleString() }} total</span>
          <span class="shrink-0">&nbsp;· <button :class="link" @click="emit('world')">Show all</button></span>
        </template>
        <template v-else-if="scope === 'area'">
          <span class="truncate">in map view · {{ total.toLocaleString() }} total</span>
          <span class="shrink-0">&nbsp;· <button :class="link" @click="set({ area: false })">List all</button></span>
        </template>
        <span v-else-if="scope === 'world'" class="truncate">worldwide</span>
        <template v-else>
          <span class="truncate">everywhere, map ignored</span>
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
</template>
