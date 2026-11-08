<script setup lang="ts">
import { computed } from "vue"
import { useWindowSize } from "@vueuse/core"
import { SNAP_FULL, SNAP_HALF, sheetHeight, type Snap } from "./sheet"

defineProps<{ peek: string }>()
const snap = defineModel<Snap>("snap", { required: true })

// The sheet is always full height and slides down to a detent, so part of it sits below the screen edge. Its
// scrolling content pads by that much (--sheet-hidden), or the last rows could only be reached at full height,
// and the detail's action bar rides up by it to sit on the screen edge. The drawer slides down by the viewport's
// height less the detent's, whatever its own height, so that is what lies below the edge.
const { height } = useWindowSize()
const hidden = computed(() => Math.max(0, Math.round(height.value - sheetHeight(snap.value, height.value))))
</script>

<!--
  Apple-Maps-style bottom sheet: non-modal (the map stays interactive), three detents.
  Peek shows the count, half shows a list or details, full is for reading.
  From 640px wide (tablets, phones on their side) it floats as a left-hand card, SHEET_W wide, so the map stays in view.
-->
<template>
  <UDrawer
    v-model:active-snap-point="snap"
    :open="true"
    :modal="false"
    :dismissible="false"
    :overlay="false"
    no-body-styles
    :snap-points="[peek, SNAP_HALF, SNAP_FULL]"
    title="Positions"
    :ui="{
      content:
        'surface-float inset-x-0 bottom-0 z-20 mt-0 h-[calc(100dvh-8px)] max-h-none rounded-t-2xl ring-0 sm:right-auto sm:left-[max(env(safe-area-inset-left),12px)] sm:w-[400px]',
      handle: 'mt-2 mb-1 !h-1 !w-10',
    }"
  >
    <template #content>
      <div class="flex min-h-0 flex-1 flex-col" :style="{ '--sheet-hidden': `${hidden}px` }">
        <slot />
      </div>
    </template>
  </UDrawer>
</template>
