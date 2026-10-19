<script setup lang="ts">
import type { Scope } from "@/features/filters/filtering"

defineProps<{ scope: Scope; hasFilters: boolean }>()
const emit = defineEmits<{ world: []; clear: [] }>()
</script>

<template>
  <div class="max-w-64 text-center">
    <UIcon name="i-lucide-search-x" class="mx-auto size-8 text-dimmed" aria-hidden="true" />
    <p class="mt-3 text-sm font-medium text-highlighted">
      No positions {{ scope === "area" ? "in this part of the map" : scope === "region" ? "in this region" : "match" }}
    </p>
    <p class="mt-1 text-xs text-muted">
      {{
        scope === "area"
          ? "Zoom out or jump to a region with openings."
          : scope === "region"
            ? "Try another region, or broaden your filters."
            : "Try broadening your filters."
      }}
    </p>
    <div class="mt-4 flex flex-col gap-2">
      <UButton v-if="scope === 'area' || scope === 'region'" color="neutral" variant="outline" size="sm" block @click="emit('world')">
        Show the whole world
      </UButton>
      <UButton v-if="hasFilters" color="neutral" variant="ghost" size="sm" block @click="emit('clear')">
        Clear search & filters
      </UButton>
    </div>
  </div>
</template>
