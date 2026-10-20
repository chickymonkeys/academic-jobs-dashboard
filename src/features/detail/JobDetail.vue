<script setup lang="ts">
import { useToast } from "@nuxt/ui/composables"
import { DISCIPLINE_LABEL, FIELD_LABEL } from "@/domain/taxonomy"
import type { Vacancy } from "@/domain/vacancy"
import CategoryLabel from "@/components/job/CategoryLabel.vue"
import DeadlineText from "@/components/job/DeadlineText.vue"
import InstitutionAvatar from "@/components/job/InstitutionAvatar.vue"
import NewBadge from "@/components/job/NewBadge.vue"
import SaveButton from "@/components/job/SaveButton.vue"
import SourceTags from "@/components/job/SourceTags.vue"
import { placeLabel, sourceLabel, sourceList } from "@/components/job/labels"
import { deadlineNotes, fmtDate, isFresh } from "@/lib/dates"
import DetailSection from "./DetailSection.vue"
import JobDescription from "./JobDescription.vue"

defineProps<{
  v: Vacancy
  version?: string
  nearby: Array<{ v: Vacancy; km: number }>
  variant: "panel" | "sheet"
}>()
const emit = defineEmits<{ close: []; select: [id: string]; showOnMap: [] }>()
const toast = useToast()

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast.add({ title: "Link copied", description: "It opens this position on the map.", icon: "i-lucide-link-2", color: "success" })
  } catch {
    toast.add({ title: "Couldn't copy the link", color: "error" })
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center gap-1 px-2 pt-2 pb-1">
      <UButton
        v-if="variant === 'sheet'"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-arrow-left"
        class="text-muted"
        @click="emit('close')"
      >
        Results
      </UButton>
      <UTooltip v-else text="Close" :kbds="['esc']">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          aria-label="Close details"
          class="size-9 justify-center"
          @click="emit('close')"
        />
      </UTooltip>
      <div class="ml-auto flex items-center gap-0.5">
        <UTooltip text="Show on map">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-crosshair"
            aria-label="Show on map"
            class="size-9 justify-center"
            @click="emit('showOnMap')"
          />
        </UTooltip>
        <UTooltip text="Copy link">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-link-2"
            aria-label="Copy link"
            class="size-9 justify-center"
            @click="copyLink"
          />
        </UTooltip>
        <SaveButton :id="v.id" class="size-9 justify-center" />
      </div>
    </div>

    <div
      class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(var(--sheet-hidden,0px)+env(safe-area-inset-bottom)+2rem)]"
      data-vaul-no-drag
    >
      <div class="flex items-center gap-3">
        <InstitutionAvatar :v="v" class="size-12" />
        <div class="flex flex-col gap-1 text-xs text-muted">
          <span class="flex items-center gap-2">
            <CategoryLabel :category="v.category" class="text-toned" />
            <NewBadge v-if="isFresh(v)" />
          </span>
          <span>{{ v.positionTypes.slice(0, 3).join(" · ") }}</span>
        </div>
      </div>
      <h2 class="mt-3 text-lg leading-snug font-semibold text-balance text-highlighted">{{ v.title }}</h2>
      <p class="mt-1 text-sm text-muted">
        <span class="text-toned">{{ v.institution }}</span>
        <template v-if="v.department"> · {{ v.department }}</template>
      </p>

      <dl class="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-default bg-(--ui-border)">
        <div class="bg-default px-3 py-2.5">
          <dt class="text-[11px] text-muted">Deadline</dt>
          <dd class="mt-0.5 text-[13px] text-highlighted">
            <DeadlineText :v="v" class="text-[13px]" />
            <!-- What each date means: postings give a review start or full-consideration date before their close -->
            <div v-for="note in deadlineNotes(v)" :key="note" class="text-xs text-muted">{{ note }}</div>
          </dd>
        </div>
        <div class="bg-default px-3 py-2.5">
          <dt class="text-[11px] text-muted">Location</dt>
          <dd class="mt-0.5 text-[13px] text-highlighted">
            <span class="inline-flex items-start gap-1">
              <UIcon name="i-lucide-map-pin" class="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
              {{ placeLabel(v) }}
            </span>
            <div v-if="v.geoPrecision === 'country'" class="text-xs text-muted">Approximate pin</div>
            <div v-else-if="v.geoPrecision === 'city'" class="text-xs text-muted">Pinned to the city</div>
          </dd>
        </div>
        <div class="bg-default px-3 py-2.5">
          <dt class="text-[11px] text-muted">Posted</dt>
          <dd class="mt-0.5 text-[13px] text-highlighted">
            <template v-if="v.postedAt">{{ fmtDate(v.postedAt) }}</template>
            <span v-else class="text-muted">Not stated</span>
          </dd>
        </div>
        <div class="bg-default px-3 py-2.5">
          <dt class="text-[11px] text-muted">Listed on</dt>
          <dd class="mt-0.5 text-[13px] text-highlighted"><SourceTags :v="v" /></dd>
        </div>
      </dl>

      <div class="mt-4 flex gap-2">
        <UButton
          :to="v.url"
          target="_blank"
          trailing-icon="i-lucide-arrow-up-right"
          class="flex-1 justify-center"
        >
          View & apply on {{ sourceLabel(v.source) }}
        </UButton>
        <UButton
          v-for="a in v.alsoOn"
          :key="a.url"
          :to="a.url"
          target="_blank"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-arrow-up-right"
          :aria-label="`Also on ${sourceLabel(a.source)}`"
        >
          {{ sourceLabel(a.source) }}
        </UButton>
      </div>

      <DetailSection title="Discipline & fields">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="d in v.disciplines"
            :key="d"
            class="rounded-full bg-elevated px-2.5 py-0.5 text-xs font-medium text-highlighted"
          >
            {{ DISCIPLINE_LABEL[d] }}
          </span>
          <span v-for="f in v.fields" :key="f" class="rounded-full border border-default px-2.5 py-0.5 text-xs text-toned">
            {{ FIELD_LABEL[f] ?? f }}
          </span>
        </div>
      </DetailSection>

      <DetailSection title="About the position">
        <JobDescription :id="v.id" :version="version" :summary="v.summary" />
      </DetailSection>

      <DetailSection v-if="nearby.length" title="Nearby positions">
        <ul class="-mx-2">
          <li v-for="{ v: n, km } in nearby" :key="n.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-elevated"
              @click="emit('select', n.id)"
            >
              <InstitutionAvatar :v="n" class="size-8 text-[11px]" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ n.title }}</span>
                <span class="block truncate text-xs text-muted">{{ n.institution }}</span>
              </span>
              <span class="shrink-0 text-xs text-muted tabular-nums">{{ km < 1 ? "Same place" : `${Math.round(km)} km` }}</span>
            </button>
          </li>
        </ul>
      </DetailSection>

      <p class="mt-8 text-xs leading-relaxed text-muted">
        Aggregated from {{ sourceList([v.source, ...v.alsoOn.map((a) => a.source)]) }}. Always confirm details and deadlines on
        the original posting.
      </p>
    </div>
  </div>
</template>
