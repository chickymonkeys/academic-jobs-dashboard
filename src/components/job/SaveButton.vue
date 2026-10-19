<script setup lang="ts">
import { computed } from "vue"
import { toggleSaved, useShortlist } from "@/lib/shortlist"

const props = defineProps<{ id: string }>()
const shortlist = useShortlist()
const saved = computed(() => shortlist.value.has(props.id))
</script>

<template>
  <UTooltip :text="saved ? 'Saved — click to remove' : 'Save to shortlist'">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :aria-pressed="saved"
      :aria-label="saved ? 'Remove from saved' : 'Save position'"
      :class="saved ? 'text-soon hover:text-soon' : 'text-muted hover:text-highlighted'"
      @click.stop="toggleSaved(id)"
    >
      <UIcon name="i-lucide-star" class="size-4" :class="saved && '*:fill-current'" />
    </UButton>
  </UTooltip>
</template>
