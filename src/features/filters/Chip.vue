<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <button
    type="button"
    class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
    :class="
      active
        ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15'
        : 'border-default bg-default/70 text-toned hover:bg-elevated hover:text-highlighted'
    "
  >
    <slot />
  </button>
</template>
