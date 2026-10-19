<script setup lang="ts">
import { computed } from "vue"
import type { Vacancy } from "@/domain/vacancy"
import { sourceLabel } from "./labels"

const props = defineProps<{ v: Pick<Vacancy, "source" | "alsoOn"> }>()
const sources = computed(() => [...new Set([props.v.source, ...props.v.alsoOn.map((a) => a.source)])])
</script>

<template>
  <span class="inline-flex gap-1">
    <span
      v-for="s in sources"
      :key="s"
      class="rounded-[5px] border border-default px-1 py-px font-mono text-[10px] leading-none tracking-wide text-muted"
    >
      {{ sourceLabel(s) }}
    </span>
  </span>
</template>
