<script setup lang="ts">
import { computed } from "vue"
import { deadlineLabel, deadlineState, type DeadlineState } from "@/lib/dates"

const props = defineProps<{ deadline: string | null }>()

const STYLE: Record<DeadlineState, { tone: string; icon: string }> = {
  closed: { tone: "text-muted", icon: "i-lucide-calendar-x-2" },
  urgent: { tone: "text-urgent font-medium", icon: "i-lucide-alarm-clock" },
  soon: { tone: "text-soon font-medium", icon: "i-lucide-calendar-clock" },
  open: { tone: "text-muted", icon: "i-lucide-calendar-days" },
  rolling: { tone: "text-muted", icon: "i-lucide-infinity" },
}
const style = computed(() => STYLE[deadlineState(props.deadline)])
</script>

<!-- Deadline urgency always ships as icon + words, never color alone -->
<template>
  <span class="inline-flex items-center gap-1 text-xs whitespace-nowrap" :class="style.tone">
    <UIcon :name="style.icon" class="size-3.5 shrink-0" aria-hidden="true" />
    {{ deadlineLabel(deadline) }}
  </span>
</template>
