<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from "vue"
import { useVirtualizer } from "@tanstack/vue-virtual"
import type { Indexed } from "@/features/filters/filtering"
import JobRow from "./JobRow.vue"

const props = defineProps<{ rows: Indexed[]; selectedId?: string; hoveredId: string | null; loading: boolean }>()
const emit = defineEmits<{ select: [id: string]; hover: [id: string | null] }>()

const parent = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => parent.value,
    estimateSize: () => 96,
    overscan: 8,
    getItemKey: (i: number) => props.rows[i]!.v.id,
  })),
)
const items = computed(() => virtualizer.value.getVirtualItems())
const measure = (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof Element) virtualizer.value.measureElement(el)
}

// Map → list: keep the selected row in view when it was picked on the map.
watch(
  () => props.selectedId,
  (id) => {
    if (!id) return
    const i = props.rows.findIndex((r) => r.v.id === id)
    if (i >= 0) virtualizer.value.scrollToIndex(i, { align: "auto" })
  },
)
</script>

<template>
  <div v-if="loading" class="space-y-1 px-2 pt-1" aria-busy="true">
    <div v-for="i in 7" :key="i" class="flex gap-3 p-2.5">
      <USkeleton class="size-10 rounded-lg" />
      <div class="flex-1 space-y-2">
        <USkeleton class="h-4 w-4/5" />
        <USkeleton class="h-3 w-3/5" />
        <USkeleton class="h-3 w-2/5" />
      </div>
    </div>
  </div>

  <div v-else-if="!rows.length" class="flex flex-1 items-start justify-center px-6 pt-10">
    <slot name="empty" />
  </div>

  <div v-else ref="parent" class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3" data-vaul-no-drag>
    <div role="list" aria-label="Positions" class="relative" :style="{ height: `${virtualizer.getTotalSize()}px` }">
      <div
        v-for="item in items"
        :key="String(item.key)"
        :ref="measure"
        role="listitem"
        :data-index="item.index"
        class="absolute top-0 left-0 w-full py-0.5"
        :style="{ transform: `translateY(${item.start}px)` }"
      >
        <JobRow
          :v="rows[item.index]!.v"
          :selected="rows[item.index]!.v.id === selectedId"
          :hovered="rows[item.index]!.v.id === hoveredId"
          @select="emit('select', $event)"
          @hover="emit('hover', $event)"
        />
      </div>
    </div>
  </div>
</template>
