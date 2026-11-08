<script setup lang="ts">
import { computed } from "vue"
import type { AppSearch, SetSearch } from "@/app/search"
import Chip from "./Chip.vue"
import { DEADLINE_CHOICES as DEADLINES } from "./facets"

const props = defineProps<{ search: AppSearch; set: SetSearch; sheet?: boolean }>()
const emit = defineEmits<{ open: [] }>()

const active = computed(() => !!props.search.dl || !!props.search.closed)
const label = computed(() => {
  const current = DEADLINES.find((d) => d.value === props.search.dl)
  if (props.search.dl && current) return current.chip
  return props.search.closed ? "Incl. closed" : "Deadline"
})
const dl = computed({
  get: () => props.search.dl ?? "any",
  set: (v: string) => props.set({ dl: v === "any" ? undefined : (v as AppSearch["dl"]) }),
})
const closed = computed({
  get: () => !!props.search.closed,
  set: (c: boolean) => props.set({ closed: c || undefined }),
})
</script>

<template>
  <Chip v-if="sheet" :active="active" aria-label="Deadline filter" aria-haspopup="dialog" @click="emit('open')">
    <UIcon name="i-lucide-calendar-clock" class="size-3.5" aria-hidden="true" />
    {{ label }}
    <UIcon name="i-lucide-chevron-down" class="size-3.5 opacity-60" />
  </Chip>
  <UPopover v-else :content="{ align: 'start' }">
    <Chip :active="active" aria-label="Deadline filter">
      {{ label }}
      <UIcon name="i-lucide-chevron-down" class="size-3.5 opacity-60" />
    </Chip>

    <template #content>
      <div class="w-64 p-1">
        <URadioGroup v-model="dl" :items="DEADLINES.map(({ value, label }) => ({ value, label }))" legend="Deadline" :ui="{ legend: 'sr-only', fieldset: 'gap-0', item: 'rounded-md px-2 py-1.5 hover:bg-elevated' }" />
        <label class="mt-1 flex cursor-pointer items-center justify-between gap-2 border-t border-default px-2 pt-2.5 pb-1.5 text-sm">
          Include closed
          <USwitch v-model="closed" />
        </label>
      </div>
    </template>
  </UPopover>
</template>
