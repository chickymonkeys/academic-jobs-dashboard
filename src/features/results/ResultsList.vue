<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from "vue"
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/vue-virtual"
import type { Indexed, SortKey } from "@/features/filters/filtering"
import JobRow from "./JobRow.vue"
import { buildEntries } from "./sections"

const props = defineProps<{
  rows: Indexed[]
  sortKey: SortKey
  selectedId?: string
  hoveredId: string | null
  loading: boolean
  /** The listing last opened, ringed for a moment when the list comes back so you can find your place */
  recentId?: string | null
}>()
const emit = defineEmits<{ select: [id: string]; hover: [id: string | null] }>()
/** Scroll position, kept by the parent while the list is swapped out for a listing's details (mobile sheet) */
const offset = defineModel<number>("offset", { default: 0 })

const HEADER_H = 34
const entries = computed(() => buildEntries(props.rows, props.sortKey))
const headerIdx = computed(() => entries.value.flatMap((e, i) => (e.kind === "header" ? [i] : [])))
const entryOfRow = computed(() => {
  const m = new Map<string, number>()
  entries.value.forEach((e, i) => e.kind === "row" && m.set(e.row.v.id, i))
  return m
})

const headerAt = (i: number) => {
  const e = entries.value[i]
  return e?.kind === "header" ? e.section : undefined
}
const rowAt = (i: number) => {
  const e = entries.value[i]
  return e?.kind === "row" ? e.row.v : undefined
}

// The section header above the first visible row stays pinned, so you always know which stretch of the calendar
// you're in: the last header at or above the top of the view. It is always rendered, however far above it sits.
function pinnedHeader(startIndex: number) {
  let pinned = -1
  for (const i of headerIdx.value) {
    if (i > startIndex) break
    pinned = i
  }
  return pinned
}
const rangeExtractor = (range: Range) => {
  const pinned = pinnedHeader(range.startIndex)
  const next = new Set([...(pinned >= 0 ? [pinned] : []), ...defaultRangeExtractor(range)])
  return [...next].sort((a, b) => a - b)
}

const parent = ref<HTMLElement | null>(null)
// In the mobile sheet the scroller runs on below the screen edge; its bottom padding says by how much, and a row
// brought into view has to clear that, not just the scroller's own bottom
const bottomInset = ref(0)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: entries.value.length,
    getScrollElement: () => parent.value,
    estimateSize: (i: number) => (entries.value[i]?.kind === "header" ? HEADER_H : 96),
    overscan: 8,
    getItemKey: (i: number) => {
      const e = entries.value[i]!
      return e.kind === "header" ? `h:${e.section.key}` : e.row.v.id
    },
    rangeExtractor,
    // Jumping to a row clears the pinned header, so the row isn't tucked under it
    scrollPaddingStart: headerIdx.value.length ? HEADER_H : 0,
    scrollPaddingEnd: bottomInset.value,
  })),
)
const items = computed(() => virtualizer.value.getVirtualItems())
// Read after the items, so it sees the range those items were cut from
const activeHeader = computed(() => {
  void items.value
  return pinnedHeader(virtualizer.value.range?.startIndex ?? 0)
})
const measure = (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof Element) virtualizer.value.measureElement(el)
}

async function reveal(id: string | null | undefined) {
  const i = id ? entryOfRow.value.get(id) : undefined
  if (i == null || !parent.value) return
  bottomInset.value = parseFloat(getComputedStyle(parent.value).paddingBottom) || 0
  await nextTick()
  virtualizer.value.scrollToIndex(i, { align: "auto" })
}

// Map → list: keep the selected row in view when it was picked on the map.
watch(
  () => props.selectedId,
  (id) => void reveal(id),
)

// Coming back from a listing's details: the list picks up where you left it, with the listing you opened in view
onMounted(async () => {
  await nextTick()
  if (offset.value > 0) virtualizer.value.scrollToOffset(offset.value)
  if (props.recentId) requestAnimationFrame(() => void reveal(props.recentId))
})
onBeforeUnmount(() => {
  offset.value = virtualizer.value.scrollOffset ?? 0
})
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

  <!-- In the mobile sheet, pad past the part of the sheet below the screen edge, so the last rows can scroll into view -->
  <div
    v-else
    ref="parent"
    class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--sheet-hidden,0px)+env(safe-area-inset-bottom)+12px)]"
    data-vaul-no-drag
  >
    <div role="list" aria-label="Positions" class="relative" :style="{ height: `${virtualizer.getTotalSize()}px` }">
      <template v-for="item in items" :key="String(item.key)">
        <!--
          Section header, an item of the list like the rows so the list stays well-formed for screen readers. The
          pinned one sits in flow (sticky), the rest scroll past like rows.
        -->
        <div
          v-if="headerAt(item.index)"
          :ref="measure"
          role="listitem"
          :data-index="item.index"
          class="top-0 left-0 z-10 w-full bg-default/95 px-4 backdrop-blur-sm"
          :class="item.index === activeHeader ? 'sticky' : 'absolute'"
          :style="item.index === activeHeader ? undefined : { transform: `translateY(${item.start}px)` }"
        >
          <h3 class="flex h-[34px] items-center gap-1.5 border-b border-default text-xs font-semibold">
            <UIcon :name="headerAt(item.index)!.icon" class="size-3.5 shrink-0" :class="headerAt(item.index)!.tone" aria-hidden="true" />
            <span class="text-highlighted">{{ headerAt(item.index)!.label }}</span>
            <span class="ml-auto font-normal text-muted tabular-nums">
              {{ headerAt(item.index)!.count }}<span class="sr-only"> positions</span>
            </span>
          </h3>
        </div>
        <div
          v-else-if="rowAt(item.index)"
          :ref="measure"
          role="listitem"
          :data-index="item.index"
          class="absolute top-0 left-0 w-full py-0.5"
          :style="{ transform: `translateY(${item.start}px)` }"
        >
          <JobRow
            :v="rowAt(item.index)!"
            :selected="rowAt(item.index)!.id === selectedId"
            :hovered="rowAt(item.index)!.id === hoveredId"
            :recent="rowAt(item.index)!.id === recentId"
            @select="emit('select', $event)"
            @hover="emit('hover', $event)"
          />
        </div>
      </template>
    </div>
  </div>
</template>
