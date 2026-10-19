<script setup lang="ts">
import { computed, ref } from "vue"
import { useDetail } from "@/data/api"
import DescriptionBlocks from "./DescriptionBlocks.vue"
import DetailSection from "./DetailSection.vue"

const props = defineProps<{ id: string; version?: string; summary: string }>()
const { data, isLoading, isError, refetch } = useDetail(
  () => props.id,
  () => props.version,
)
const expanded = ref(false)

const PREVIEW_BLOCKS = 6
const long = computed(() => (data.value?.blocks.length ?? 0) > PREVIEW_BLOCKS + 2)
const blocks = computed(() => {
  const all = data.value?.blocks ?? []
  return long.value && !expanded.value ? all.slice(0, PREVIEW_BLOCKS) : all
})
</script>

<template>
  <!-- Progressive: the index already carries a summary, so show it instantly while the full body streams in -->
  <div v-if="isLoading" aria-busy="true">
    <p v-if="summary" class="mb-3 text-sm leading-relaxed text-toned">{{ summary }}</p>
    <div class="space-y-2">
      <USkeleton v-for="w in [100, 92, 97, 60]" :key="w" class="h-3.5" :style="{ width: `${w}%` }" />
    </div>
  </div>

  <p v-else-if="isError || !data" class="text-sm text-muted">
    Couldn't load the full description.
    <button class="text-primary underline underline-offset-2" @click="refetch()">Retry</button>
  </p>

  <template v-else>
    <DetailSection v-if="data.requirements.length" title="What to submit" class="mt-0 mb-6">
      <ul class="grid gap-1.5">
        <li v-for="r in data.requirements" :key="r" class="flex items-start gap-2 text-sm">
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
          {{ r }}
        </li>
      </ul>
    </DetailSection>
    <p v-if="data.salary" class="mb-4 rounded-lg bg-elevated px-3 py-2 text-sm">
      <span class="text-muted">Salary · </span>{{ data.salary }}
    </p>
    <p v-if="!data.blocks.length" class="text-sm text-muted">
      No description came with this listing. Read it on the original posting.
    </p>
    <div class="relative">
      <DescriptionBlocks :blocks="blocks" />
      <div
        v-if="long && !expanded"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-(--ui-bg) to-transparent"
      />
    </div>
    <UButton v-if="long" color="neutral" variant="outline" size="sm" block class="mt-2" @click="expanded = !expanded">
      {{ expanded ? "Show less" : "Read full description" }}
    </UButton>
    <DetailSection v-if="data.jel.length" title="JEL classification">
      <ul class="grid gap-1 text-sm">
        <li v-for="j in data.jel" :key="j.code" class="flex gap-2">
          <span class="w-8 shrink-0 font-mono text-xs leading-5 text-muted">{{ j.code }}</span>
          <span>{{ j.label }}</span>
        </li>
      </ul>
    </DetailSection>
    <DetailSection v-if="data.keywords.length" title="Keywords">
      <div class="flex flex-wrap gap-1.5">
        <span v-for="k in data.keywords.slice(0, 16)" :key="k" class="rounded-md bg-elevated px-2 py-0.5 text-xs text-toned">
          {{ k }}
        </span>
      </div>
    </DetailSection>
  </template>
</template>
