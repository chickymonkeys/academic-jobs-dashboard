<script setup lang="ts">
defineProps<{ active: boolean; count?: number; color?: string; tag?: string }>()
</script>

<!--
  A finger-sized choice in the filter sheet: the check mark, not only the tint, says it's on. A pressed button
  even where only one can be on (the deadline): each choice is a Tab stop and Space or Enter picks it, as a
  button does, where a radio would promise arrow keys.
-->
<template>
  <button
    type="button"
    :aria-pressed="active"
    class="inline-flex h-10 max-w-full items-center gap-2 rounded-full border px-3.5 text-sm transition-[color,background-color,border-color,transform] duration-150 select-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-[0.97]"
    :class="
      active
        ? 'border-primary/40 bg-primary/10 font-medium text-primary'
        : count === 0
          ? 'border-default text-dimmed'
          : 'border-default text-toned hover:bg-elevated hover:text-highlighted'
    "
  >
    <UIcon v-if="active" name="i-lucide-check" class="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
    <span v-else-if="color" class="size-2.5 shrink-0 rounded-full" :style="{ background: color }" aria-hidden="true" />
    <span v-if="tag" class="font-mono text-[11px] opacity-70">{{ tag }}</span>
    <span class="truncate"><slot /></span>
    <span v-if="count != null" class="text-xs tabular-nums" :class="active ? 'text-primary/75' : 'text-muted'">
      {{ count.toLocaleString() }}
    </span>
  </button>
</template>
