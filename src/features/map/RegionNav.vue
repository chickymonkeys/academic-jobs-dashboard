<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue"
import { WORLD_REGIONS } from "@/domain/geo"
import type { RegionId } from "@/domain/vacancy"
import { usePrefersReducedMotion } from "@/lib/media"

const props = defineProps<{ counts: Partial<Record<RegionId, number>>; total: number; active: RegionId | "world" | null }>()
const emit = defineEmits<{ select: [id: RegionId | "world"] }>()

// Active and idle looks never share a property, so the active chip can't lose its ink to the idle text color
const chip =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors pointer-coarse:py-2 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
const on = "bg-primary text-inverted hover:bg-primary/90"
const off = "text-toned hover:bg-elevated"

// The strip scrolls sideways on narrow screens: bring the active chip into view, clear of the fade on the right
const nav = useTemplateRef<HTMLElement>("nav")
const reduce = usePrefersReducedMotion()
function reveal(smooth: boolean) {
  const el = nav.value
  const c = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
  if (!el || !c) return
  const start = c.offsetLeft - 8
  const end = c.offsetLeft + c.offsetWidth + 28
  const left = start < el.scrollLeft ? start : end > el.scrollLeft + el.clientWidth ? end - el.clientWidth : null
  if (left != null) el.scrollTo({ left, behavior: smooth && !reduce.value ? "smooth" : "auto" })
}
onMounted(() => reveal(false))
watch(
  () => props.active,
  () => reveal(true),
  { flush: "post" },
)
</script>

<!-- One-tap geographic jumps — the fastest way across a world map -->
<template>
  <nav
    ref="nav"
    aria-label="Jump to region"
    class="relative flex items-center gap-0.5 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none]"
  >
    <button type="button" :aria-pressed="active === 'world'" :class="[chip, active === 'world' ? on : off]" @click="emit('select', 'world')">
      <UIcon name="i-lucide-globe" class="size-3.5" aria-hidden="true" /> World
      <span class="tabular-nums" :class="active === 'world' ? 'text-inverted/75' : 'text-muted'">{{ total }}</span>
    </button>
    <button
      v-for="r in WORLD_REGIONS"
      :key="r.id"
      type="button"
      :aria-pressed="active === r.id"
      :aria-label="`${r.label}, ${counts[r.id] ?? 0} positions`"
      :class="[chip, active === r.id ? on : off]"
      @click="emit('select', r.id)"
    >
      {{ r.short }}
      <span class="tabular-nums" :class="active === r.id ? 'text-inverted/75' : 'text-muted'">{{ counts[r.id] ?? 0 }}</span>
    </button>
  </nav>
</template>
