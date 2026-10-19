<script setup lang="ts">
import { computed } from "vue"
import type { Meta } from "@/domain/vacancy"
import { META_POLL_MS } from "@/data/api"
import { ago } from "@/lib/dates"

const props = defineProps<{ meta?: Meta; refreshing: boolean; crossListed: number }>()
const healthy = computed(() => props.meta?.sources.every((s) => s.ok) ?? true)
</script>

<!-- Trust signal: how fresh the data is and which feeds are healthy, one click away -->
<template>
  <USkeleton v-if="!meta" class="h-5 w-28 rounded-full" />
  <UPopover v-else :content="{ align: 'end' }">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-muted transition-colors hover:bg-elevated hover:text-highlighted"
    >
      <UIcon v-if="refreshing" name="i-lucide-refresh-cw" class="size-3 animate-spin" aria-hidden="true" />
      <span v-else class="size-1.5 rounded-full" :class="healthy ? 'bg-ok' : 'bg-soon'" aria-hidden="true" />
      {{ refreshing ? "Updating…" : `Updated ${ago(meta.generatedAt)}` }}
    </button>

    <template #content>
      <div class="w-80">
        <div class="border-b border-default px-4 py-3">
          <div class="text-sm font-medium text-highlighted">Live sources</div>
          <p class="mt-0.5 text-xs text-muted">
            {{ meta.total.toLocaleString() }} open positions · {{ crossListed }} cross-listed and merged
          </p>
        </div>
        <ul class="divide-y divide-default">
          <li v-for="s in meta.sources" :key="s.id" class="flex items-start gap-3 px-4 py-3">
            <UIcon v-if="s.ok" name="i-lucide-circle-check" class="mt-0.5 size-4 shrink-0 text-ok" aria-label="Healthy" />
            <UIcon v-else name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-soon" aria-label="Degraded" />
            <div class="min-w-0 flex-1 text-sm">
              <a
                :href="s.homepage"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 font-medium text-highlighted hover:underline"
              >
                {{ s.name }} <UIcon name="i-lucide-external-link" class="size-3 opacity-50" />
              </a>
              <div class="text-xs text-muted">
                {{ s.count.toLocaleString() }} listings{{ s.fetchedAt ? ` · fetched ${ago(s.fetchedAt)}` : "" }}
              </div>
              <div v-if="s.error" class="mt-1 text-xs text-soon">Using cached data: {{ s.error }}</div>
            </div>
          </li>
        </ul>
        <p class="border-t border-default px-4 py-2.5 text-xs text-muted">
          Checks for new listings every {{ Math.round(META_POLL_MS / 60_000) }} minutes while this tab is open.
        </p>
      </div>
    </template>
  </UPopover>
</template>
