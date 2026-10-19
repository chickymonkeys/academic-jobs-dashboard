<script lang="ts">
export type FacetOption = { id: string; label: string; count: number; color?: string; tag?: string }
</script>

<script setup lang="ts">
import { computed } from "vue"
import Chip from "./Chip.vue"

const props = defineProps<{ label: string; options: FacetOption[]; selected: string[]; searchable?: boolean }>()
const emit = defineEmits<{ toggle: [id: string]; clear: [] }>()

const active = computed(() => props.selected.length > 0)
const summary = computed(() => {
  if (!active.value) return props.label
  if (props.selected.length === 1) return props.options.find((o) => o.id === props.selected[0])?.label ?? props.label
  return `${props.label} · ${props.selected.length}`
})
const groups = computed(() => [{ id: "options", items: props.options }])
const model = computed(() => props.options.filter((o) => props.selected.includes(o.id)))

// The palette reports the whole new selection; turn it back into the one option that changed
function onUpdate(next: unknown) {
  const ids = new Set((Array.isArray(next) ? (next as FacetOption[]) : []).map((o) => o.id))
  const changed = props.options.find((o) => ids.has(o.id) !== props.selected.includes(o.id))
  if (changed) emit("toggle", changed.id)
}
</script>

<template>
  <UPopover :content="{ align: 'start' }">
    <Chip :active="active" :aria-label="`${label} filter`">
      <span class="max-w-[140px] truncate">{{ summary }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 opacity-60" />
    </Chip>

    <template #content>
      <UCommandPalette
        multiple
        by="id"
        :model-value="model"
        :groups="groups"
        :input="searchable ? { placeholder: `Find ${label.toLowerCase()}…` } : false"
        :fuse="{ resultLimit: 50 }"
        class="w-72"
        :ui="{ content: 'max-h-80' }"
        @update:model-value="onUpdate"
      >
        <template #item-leading="{ item }">
          <UCheckbox :model-value="selected.includes(item.id)" tabindex="-1" aria-hidden="true" class="pointer-events-none" />
          <span v-if="item.color" class="size-2.5 shrink-0 rounded-full" :style="{ background: item.color }" aria-hidden="true" />
          <span v-if="item.tag" class="font-mono text-[10px] text-muted">{{ item.tag }}</span>
        </template>
        <template #item-label="{ item }">
          <span class="truncate text-highlighted" :class="!selected.includes(item.id) && item.count === 0 && 'opacity-50'">{{ item.label }}</span>
        </template>
        <template #item-trailing="{ item }">
          <span class="ml-auto text-xs text-muted tabular-nums">{{ item.count }}</span>
        </template>
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">No match.</p>
        </template>
        <template v-if="active" #footer>
          <UButton color="neutral" variant="ghost" size="sm" block @click="emit('clear')">Clear {{ label.toLowerCase() }}</UButton>
        </template>
      </UCommandPalette>
    </template>
  </UPopover>
</template>
