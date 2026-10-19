<script setup lang="ts">
import { ref } from "vue"
import type { TableColumn, TableRow } from "@nuxt/ui"
import { CATEGORY_BY_ID, FIELD_LABEL } from "@/domain/taxonomy"
import type { Indexed } from "@/features/filters/filtering"
import CategoryLabel from "@/components/job/CategoryLabel.vue"
import DeadlineText from "@/components/job/DeadlineText.vue"
import SaveButton from "@/components/job/SaveButton.vue"
import SourceTags from "@/components/job/SourceTags.vue"
import { placeLabel } from "@/components/job/labels"

const props = defineProps<{ rows: Indexed[]; selectedId?: string; hoveredId: string | null }>()
const emit = defineEmits<{ select: [id: string]; hover: [id: string | null] }>()

const fieldLabels = (r: Indexed) => r.v.fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")
const width = (w: string) => ({ class: { th: w, td: w } })
const columns: TableColumn<Indexed>[] = [
  { id: "save", header: "", enableSorting: false, meta: width("w-10") },
  { id: "title", header: "Position", accessorFn: (r) => r.v.title },
  { id: "place", header: "Location", accessorFn: (r) => placeLabel(r.v), meta: width("w-32") },
  { id: "category", header: "Type", accessorFn: (r) => CATEGORY_BY_ID[r.v.category].label, meta: width("w-36") },
  {
    id: "fields",
    header: "Fields",
    enableSorting: false,
    accessorFn: fieldLabels,
    meta: width("w-28"),
  },
  { id: "deadline", header: "Deadline", accessorFn: (r) => r.v.deadline ?? "9999-12-31", meta: width("w-32") },
  { id: "source", header: "Source", accessorFn: (r) => r.v.source, meta: width("w-24") },
]

const sorting = ref<Array<{ id: string; desc: boolean }>>([])
const rowClass = (row: TableRow<Indexed>) =>
  row.original.v.id === props.selectedId ? "bg-primary/8" : row.original.v.id === props.hoveredId ? "bg-elevated" : ""
</script>

<!-- Dense, sortable comparison view for when the list isn't enough (desktop) -->
<template>
  <UTable
    v-model:sorting="sorting"
    :data="rows"
    :columns="columns"
    :get-row-id="(r: Indexed) => r.v.id"
    :meta="{ class: { tr: rowClass } }"
    :virtualize="{ estimateSize: 52, overscan: 10 }"
    sticky
    class="scrollbar-thin min-h-0 flex-1 text-sm"
    :ui="{
      base: 'w-full table-fixed',
      th: 'px-3 py-2 text-xs font-medium text-muted',
      td: 'px-3 py-2 text-toned',
      tr: 'cursor-pointer hover:bg-elevated',
    }"
    @select="(_e: Event, row: TableRow<Indexed>) => emit('select', row.original.v.id)"
    @hover="(_e: Event, row: TableRow<Indexed> | null) => emit('hover', row?.original.v.id ?? null)"
  >
    <template v-for="id in ['title', 'place', 'category', 'deadline', 'source']" :key="id" #[`${id}-header`]="{ column }">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded hover:text-highlighted"
        @click="column.toggleSorting(column.getIsSorted() === 'asc')"
      >
        {{ column.columnDef.header }}
        <UIcon
          :name="
            column.getIsSorted() === 'asc'
              ? 'i-lucide-arrow-up'
              : column.getIsSorted() === 'desc'
                ? 'i-lucide-arrow-down'
                : 'i-lucide-arrow-up-down'
          "
          class="size-3"
          :class="!column.getIsSorted() && 'opacity-40'"
        />
      </button>
    </template>
    <template #save-cell="{ row }">
      <SaveButton :id="row.original.v.id" class="size-7" />
    </template>
    <template #title-cell="{ row }">
      <div class="min-w-0">
        <div class="truncate font-medium text-highlighted">{{ row.original.v.title }}</div>
        <div class="truncate text-xs text-muted">{{ row.original.v.institution }}</div>
      </div>
    </template>
    <template #place-cell="{ row }">
      <span class="block truncate">{{ placeLabel(row.original.v) }}</span>
    </template>
    <template #category-cell="{ row }">
      <CategoryLabel :category="row.original.v.category" class="truncate" />
    </template>
    <template #fields-cell="{ row }">
      <span class="block truncate text-muted">{{ fieldLabels(row.original) }}</span>
    </template>
    <template #deadline-cell="{ row }">
      <DeadlineText :deadline="row.original.v.deadline" />
    </template>
    <template #source-cell="{ row }">
      <SourceTags :v="row.original.v" />
    </template>
  </UTable>
</template>
