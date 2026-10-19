<script setup lang="ts">
import { CATEGORIES } from "@/domain/taxonomy"
import { useMode } from "@/lib/theme"

defineProps<{ counts: Record<string, number>; active: string[] }>()
const emit = defineEmits<{ toggle: [id: string] }>()
const mode = useMode()
</script>

<!-- The legend doubles as the position-type filter: click a key to isolate it -->
<template>
  <div class="surface-float w-56 rounded-xl p-1.5 text-xs" role="group" aria-label="Position types">
    <div class="px-2 pt-1 pb-1.5 text-[11px] font-medium text-muted">Position type</div>
    <button
      v-for="c in CATEGORIES"
      :key="c.id"
      type="button"
      :aria-pressed="active.includes(c.id)"
      :title="c.description"
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      :class="active.length > 0 && !active.includes(c.id) && 'opacity-45'"
      @click="emit('toggle', c.id)"
    >
      <span class="size-2.5 rounded-full ring-2 ring-(--ui-bg)" :style="{ background: c.color[mode] }" aria-hidden="true" />
      <span class="text-highlighted">{{ c.label }}</span>
      <span class="ml-auto text-muted tabular-nums">{{ counts[c.id] ?? 0 }}</span>
    </button>
  </div>
</template>
