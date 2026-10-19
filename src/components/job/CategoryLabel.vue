<script setup lang="ts">
import { CATEGORY_BY_ID } from "@/domain/taxonomy"
import type { Category } from "@/domain/vacancy"
import CategoryDot from "./CategoryDot.vue"

defineProps<{ category: Category }>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <CategoryDot :category="category" class="size-2" />
    {{ CATEGORY_BY_ID[category].label }}
  </span>
</template>
