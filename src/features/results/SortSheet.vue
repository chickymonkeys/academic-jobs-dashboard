<script setup lang="ts">
import type { AppSearch, SetSearch } from "@/app/search"
import type { SortKey } from "@/features/filters/filtering"
import { sortsFor } from "./sorts"

const props = defineProps<{ sortKey: SortKey; hasQuery: boolean; search: AppSearch; set: SetSearch }>()
const open = defineModel<boolean>("open", { required: true })

function pick(id: SortKey) {
  props.set({ sort: id })
  open.value = false
}
</script>

<!-- Phones: one tap picks an order and closes, like a native action sheet -->
<template>
  <UDrawer
    v-model:open="open"
    title="Sort positions"
    description="Choose the order of the list"
    :ui="{
      overlay: 'z-40 bg-black/35 dark:bg-black/55',
      content: 'z-50 rounded-t-2xl ring-0 sm:right-auto sm:left-[max(env(safe-area-inset-left),12px)] sm:w-[400px]',
      handle: 'mt-2 mb-0 !h-1 !w-10',
    }"
  >
    <template #content>
      <div class="px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        <h2 id="sort-title" class="px-3 pt-1 pb-2 text-base font-semibold text-highlighted">Sort by</h2>
        <div role="group" aria-labelledby="sort-title">
          <button
            v-for="s in sortsFor(hasQuery)"
            :key="s.id"
            type="button"
            :aria-pressed="sortKey === s.id"
            :disabled="s.id === 'relevance' && !hasQuery"
            class="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-elevated active:bg-elevated disabled:opacity-45 disabled:hover:bg-transparent"
            @click="pick(s.id)"
          >
            <UIcon :name="s.icon" class="size-5 shrink-0" :class="sortKey === s.id ? 'text-primary' : 'text-muted'" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium" :class="sortKey === s.id ? 'text-primary' : 'text-highlighted'">{{ s.label }}</span>
              <span class="block text-xs text-muted">
                {{ s.id === "relevance" && !hasQuery ? "Search for something to rank by match" : s.hint }}
              </span>
            </span>
            <UIcon v-if="sortKey === s.id" name="i-lucide-check" class="size-5 shrink-0 text-primary" aria-hidden="true" />
          </button>
        </div>
        <div class="mx-3 my-2 border-t border-default" />
        <label class="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2">
          <UIcon name="i-lucide-map" class="size-5 shrink-0 text-muted" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-highlighted">Follow the map</span>
            <span class="block text-xs text-muted">List only what's in view as you pan and zoom</span>
          </span>
          <USwitch
            :model-value="search.area !== false"
            @update:model-value="(on: boolean) => set({ area: on ? undefined : false })"
          />
        </label>
      </div>
    </template>
  </UDrawer>
</template>
