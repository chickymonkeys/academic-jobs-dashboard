<script setup lang="ts">
defineProps<{ scope: "group" | "area" | "world" | "everywhere"; hasFilters: boolean }>()
const emit = defineEmits<{ world: []; clear: [] }>()
</script>

<template>
  <div class="max-w-64 text-center">
    <UIcon name="i-lucide-search-x" class="mx-auto size-8 text-dimmed" aria-hidden="true" />
    <p class="mt-3 text-sm font-medium text-highlighted">No positions {{ scope === "area" ? "in this part of the map" : "match" }}</p>
    <p class="mt-1 text-xs text-muted">
      {{ scope === "area" ? "Zoom out or jump to a region with openings." : "Try broadening your filters." }}
    </p>
    <div class="mt-4 flex flex-col gap-2">
      <UButton v-if="scope === 'area'" color="neutral" variant="outline" size="sm" block @click="emit('world')">
        Show the whole world
      </UButton>
      <UButton v-if="hasFilters" color="neutral" variant="ghost" size="sm" block @click="emit('clear')">
        Clear search & filters
      </UButton>
    </div>
  </div>
</template>
