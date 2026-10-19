<script setup lang="ts">
import type { Vacancy } from "@/domain/vacancy"
import CategoryLabel from "@/components/job/CategoryLabel.vue"
import DeadlineText from "@/components/job/DeadlineText.vue"
import InstitutionAvatar from "@/components/job/InstitutionAvatar.vue"
import NewBadge from "@/components/job/NewBadge.vue"
import SaveButton from "@/components/job/SaveButton.vue"
import SourceTags from "@/components/job/SourceTags.vue"
import { placeLabel } from "@/components/job/labels"
import { isFresh } from "@/lib/dates"

defineProps<{ v: Vacancy; selected: boolean; hovered: boolean }>()
const emit = defineEmits<{ select: [id: string]; hover: [id: string | null] }>()
</script>

<!-- Card with a stretched primary button, so the save star stays a separate, valid control -->
<template>
  <article
    class="group relative mx-2 flex gap-3 rounded-xl p-2.5 transition-colors"
    :class="selected ? 'bg-primary/8 ring-1 ring-primary/25' : hovered ? 'bg-elevated' : 'hover:bg-elevated'"
    @mouseenter="emit('hover', v.id)"
    @mouseleave="emit('hover', null)"
  >
    <button
      type="button"
      class="absolute inset-0 z-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
      :aria-label="`${v.title}, ${v.institution}`"
      :aria-current="selected || undefined"
      @click="emit('select', v.id)"
    />
    <InstitutionAvatar :v="v" class="pointer-events-none" />
    <div class="pointer-events-none min-w-0 flex-1">
      <div class="flex items-start gap-1">
        <h3 class="line-clamp-2 flex-1 text-sm leading-snug font-medium text-highlighted">{{ v.title }}</h3>
        <SaveButton
          :id="v.id"
          class="pointer-events-auto relative z-10 -mt-1 -mr-1 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100 [@media(hover:none)]:opacity-100"
        />
      </div>
      <p class="mt-0.5 truncate text-xs text-muted">
        {{ v.institution }} <span aria-hidden="true">·</span> {{ placeLabel(v) }}
      </p>
      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-toned">
        <CategoryLabel :category="v.category" />
        <DeadlineText :deadline="v.deadline" />
        <NewBadge v-if="isFresh(v)" />
        <SourceTags :v="v" class="ml-auto" />
      </div>
    </div>
  </article>
</template>
