<script setup lang="ts">
import { computed } from "vue"
import type { DropdownMenuItem } from "@nuxt/ui"
import type { AppSearch, SetSearch } from "@/app/search"
import type { SortKey } from "@/features/filters/filtering"

const props = defineProps<{
  count: number
  total: number
  scope: "group" | "area" | "world" | "everywhere"
  groupLabel?: string
  sortKey: SortKey
  hasQuery: boolean
  search: AppSearch
  set: SetSearch
  showViewToggle: boolean
}>()
const emit = defineEmits<{ clearGroup: [] }>()

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "relevance", label: "Best match" },
  { id: "deadline", label: "Deadline (soonest)" },
  { id: "newest", label: "Newest first" },
  { id: "az", label: "Institution A–Z" },
]
const sortLabel = computed(() => SORTS.find((s) => s.id === props.sortKey)?.label ?? "")

const menu = computed<DropdownMenuItem[][]>(() => [
  [
    { type: "label", label: "Sort by" },
    ...SORTS.map(
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
      <p class="truncate text-xs text-muted">
        <template v-if="scope === 'group'">
          at {{ groupLabel }} · <button :class="link" @click="emit('clearGroup')">Show all</button>
        </template>
        <template v-else-if="scope === 'area'">
          in visible map area · {{ total.toLocaleString() }} total ·
          <button :class="link" @click="set({ area: false })">List all</button>
        </template>
        <template v-else-if="scope === 'world'">worldwide, sorted by {{ sortLabel.toLowerCase() }}</template>
        <template v-else>
          everywhere (ignoring map) · <button :class="link" @click="set({ area: undefined })">Follow map</button>
        </template>
      </p>
    </div>
    <UDropdownMenu :items="menu" :content="{ align: 'end' }" :ui="{ content: 'w-52' }">
      <UTooltip :text="`Sort: ${sortLabel}`">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-up-down" aria-label="Sort results" />
      </UTooltip>
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
