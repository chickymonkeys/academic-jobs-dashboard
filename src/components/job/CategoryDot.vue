<script setup lang="ts">
import { CATEGORY_BY_ID } from "@/domain/taxonomy"
import type { Category } from "@/domain/vacancy"
import { useMode } from "@/lib/theme"

defineProps<{ category: Category }>()
const mode = useMode()
</script>

<template>
  <span aria-hidden="true" class="inline-block size-2.5 shrink-0 rounded-full" :style="{ background: CATEGORY_BY_ID[category].color[mode] }" />
</template>
