<script setup lang="ts">
import { WORLD_REGIONS } from "@/domain/geo"
import type { RegionId } from "@/domain/vacancy"

defineProps<{ counts: Partial<Record<RegionId, number>>; total: number; active: string | null }>()
const emit = defineEmits<{ select: [id: RegionId | "world"] }>()

const chip =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors text-toned hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
const on = "bg-primary text-inverted hover:bg-primary/90"
</script>

<!-- One-tap geographic jumps — the fastest way across a world map -->
<template>
  <nav
    aria-label="Jump to region"
    class="flex items-center gap-0.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none]"
  >
    <button type="button" :aria-pressed="active === 'world'" :class="[chip, active === 'world' && on]" @click="emit('select', 'world')">
      <UIcon name="i-lucide-globe" class="size-3.5" aria-hidden="true" /> World
      <span class="tabular-nums" :class="active === 'world' ? 'text-inverted/75' : 'text-muted'">{{ total }}</span>
    </button>
    <button
      v-for="r in WORLD_REGIONS"
      :key="r.id"
      type="button"
      :aria-pressed="active === r.id"
      :class="[chip, active === r.id && on]"
      @click="emit('select', r.id)"
    >
      {{ r.short }}
      <span class="tabular-nums" :class="active === r.id ? 'text-inverted/75' : 'text-muted'">{{ counts[r.id] ?? 0 }}</span>
    </button>
  </nav>
</template>
