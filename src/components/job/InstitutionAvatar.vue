<script setup lang="ts">
import { ref, watch } from "vue"
import type { Vacancy } from "@/domain/vacancy"
import { initials } from "./labels"

const props = defineProps<{ v: Pick<Vacancy, "institution" | "logoUrl"> }>()
const failed = ref(false)
watch(
  () => props.v.logoUrl,
  () => (failed.value = false),
)
</script>

<template>
  <span
    aria-hidden="true"
    class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-elevated text-[13px] font-semibold text-muted"
  >
    <img
      v-if="v.logoUrl && !failed"
      :src="v.logoUrl"
      alt=""
      loading="lazy"
      decoding="async"
      class="size-full bg-white object-contain p-1"
      @error="failed = true"
    />
    <template v-else>{{ initials(v.institution) || "·" }}</template>
  </span>
</template>
