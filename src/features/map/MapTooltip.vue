<script setup lang="ts">
import { computed } from "vue"
import { CATEGORIES, CATEGORY_BY_ID } from "@/domain/taxonomy"
import type { Mode } from "@/lib/colors"
import DeadlineText from "@/components/job/DeadlineText.vue"
import type { Tip } from "./types"

const props = defineProps<{ tip: Tip; mode: Mode; container: HTMLElement | null }>()

const position = computed(() => {
  const w = props.container?.clientWidth ?? 1000
  const h = props.container?.clientHeight ?? 800
  const { x, y } = props.tip
  return { left: `${x > w - 300 ? x - 284 : x + 16}px`, top: `${y > h - 200 ? y - 150 : y + 16}px` }
})
const parts = computed(() => {
  const t = props.tip
  return t.kind === "group" ? CATEGORIES.filter((c) => t.breakdown[c.id] > 0) : []
})
</script>

<template>
  <div role="tooltip" class="surface-float pointer-events-none absolute z-20 w-[268px] rounded-xl p-3 text-xs" :style="position">
    <template v-if="tip.kind === 'point'">
      <div class="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span class="size-2 rounded-full" :style="{ background: CATEGORY_BY_ID[tip.v.category].color[mode] }" aria-hidden="true" />
        {{ CATEGORY_BY_ID[tip.v.category].label }}
      </div>
      <div class="line-clamp-2 text-[13px] leading-snug font-medium text-highlighted">{{ tip.v.title }}</div>
      <div class="mt-0.5 truncate text-muted">{{ tip.v.institution }}</div>
      <div class="mt-2 flex items-center justify-between">
        <DeadlineText :deadline="tip.v.deadline" />
        <span class="text-muted">Click for details</span>
      </div>
    </template>

    <template v-else>
      <div class="line-clamp-2 text-[13px] font-semibold text-highlighted">
        {{ tip.count }} positions <span class="font-normal text-muted">{{ tip.where }}</span>
      </div>
      <div class="mt-2 flex h-2 w-full gap-[2px]" aria-hidden="true">
        <div
          v-for="c in parts"
          :key="c.id"
          class="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
          :style="{ flexGrow: tip.breakdown[c.id], background: c.color[mode] }"
        />
      </div>
      <ul class="mt-2 space-y-0.5">
        <li v-for="c in parts" :key="c.id" class="flex items-center gap-1.5 text-toned">
          <span class="size-2 rounded-full" :style="{ background: c.color[mode] }" aria-hidden="true" />
          {{ c.label }}
          <span class="ml-auto text-muted tabular-nums">{{ tip.breakdown[c.id] }}</span>
        </li>
      </ul>
      <div v-if="tip.names.length" class="mt-2 border-t border-default pt-2 text-muted">
        <span class="line-clamp-2">
          {{ tip.names.slice(0, 3).join(" · ") }}{{ tip.names.length > 3 ? ` +${tip.names.length - 3} more` : "" }}
        </span>
      </div>
      <div v-if="tip.approx" class="mt-2 text-[11px] text-muted">Pinned to the city, not the exact address</div>
      <div class="mt-2 text-[11px] text-muted">{{ tip.hint }}</div>
    </template>
  </div>
</template>
