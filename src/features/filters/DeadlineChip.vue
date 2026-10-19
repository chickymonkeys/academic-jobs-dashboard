<script setup lang="ts">
import { computed } from "vue"
import type { AppSearch, SetSearch } from "@/app/search"
import Chip from "./Chip.vue"

const props = defineProps<{ search: AppSearch; set: SetSearch }>()

const DEADLINES = [
  { value: "any", label: "Any deadline" },
  { value: "week", label: "Closing within 7 days" },
  { value: "month", label: "Closing within 30 days" },
  { value: "none", label: "Open until filled" },
] as const

const active = computed(() => !!props.search.dl || !!props.search.closed)
const label = computed(() => {
  const current = DEADLINES.find((d) => d.value === props.search.dl)
  return props.search.dl && current ? current.label.replace("Closing within", "≤") : "Deadline"
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
  <UPopover :content="{ align: 'start' }">
    <Chip :active="active" aria-label="Deadline filter">
      {{ label }}
      <UIcon name="i-lucide-chevron-down" class="size-3.5 opacity-60" />
    </Chip>

    <template #content>
      <div class="w-64 p-1">
        <URadioGroup v-model="dl" :items="[...DEADLINES]" legend="Deadline" :ui="{ legend: 'sr-only', fieldset: 'gap-0', item: 'rounded-md px-2 py-1.5 hover:bg-elevated' }" />
        <label class="mt-1 flex cursor-pointer items-center justify-between gap-2 border-t border-default px-2 pt-2.5 pb-1.5 text-sm">
          Include closed
          <USwitch v-model="closed" />
        </label>
      </div>
    </template>
  </UPopover>
</template>
