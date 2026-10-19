<script setup lang="ts">
import { SNAP_FULL, SNAP_HALF, SNAP_PEEK, type Snap } from "./sheet"

const snap = defineModel<Snap>("snap", { required: true })
</script>

<!--
  Apple-Maps-style bottom sheet: non-modal (the map stays interactive), three detents.
  Peek shows the count, half shows a list or details, full is for reading.
-->
<template>
  <UDrawer
    v-model:active-snap-point="snap"
    :open="true"
    :modal="false"
    :dismissible="false"
    :overlay="false"
    no-body-styles
    :snap-points="[SNAP_PEEK, SNAP_HALF, SNAP_FULL]"
    title="Positions"
    :ui="{
      content: 'surface-float inset-x-0 bottom-0 z-20 mt-0 h-[calc(100dvh-8px)] max-h-none rounded-t-2xl ring-0',
      handle: 'mt-2 mb-1 !h-1 !w-10',
    }"
  >
    <template #content>
      <slot />
    </template>
  </UDrawer>
</template>
