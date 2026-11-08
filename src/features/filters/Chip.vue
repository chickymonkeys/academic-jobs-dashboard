<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<!--
  A filter that is on hides listings, so it reads as on at a glance: filled, like the pressed region chip, never
  just tinted (a tinted "New 210" passed for a count of new listings rather than a filter in force).
-->
<template>
  <button
    type="button"
    class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors pointer-coarse:h-9 pointer-coarse:px-3.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:outline-none"
    :class="
      active
        ? 'border-primary bg-primary text-inverted hover:bg-primary/90'
        : 'border-default bg-default/70 text-toned hover:bg-elevated hover:text-highlighted'
    "
  >
    <slot />
  </button>
</template>
