<script setup lang="ts">
import { computed } from "vue"
import { toggleSaved, useShortlist } from "@/lib/shortlist"

// Rows skip the tooltip: one per row is most of the cost of mounting rows while a long list scrolls
const props = withDefaults(defineProps<{ id: string; tooltip?: boolean }>(), { tooltip: true })
const shortlist = useShortlist()
const saved = computed(() => shortlist.value.has(props.id))
const label = computed(() => (saved.value ? "Remove from saved" : "Save position"))
</script>

<template>
  <UTooltip v-if="tooltip" :text="saved ? 'Saved — click to remove' : 'Save to shortlist'">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :aria-pressed="saved"
      :aria-label="label"
      :class="saved ? 'text-soon hover:text-soon' : 'text-muted hover:text-highlighted'"
      @click.stop="toggleSaved(id)"
    >
      <UIcon name="i-lucide-star" class="size-4" :class="saved && '*:fill-current'" />
    </UButton>
  </UTooltip>
  <UButton
    v-else
    color="neutral"
    variant="ghost"
    size="sm"
    square
    :aria-pressed="saved"
    :aria-label="label"
    :title="label"
    :class="saved ? 'text-soon hover:text-soon' : 'text-muted hover:text-highlighted'"
    @click.stop="toggleSaved(id)"
  >
    <UIcon name="i-lucide-star" class="size-4" :class="saved && '*:fill-current'" />
  </UButton>
</template>
