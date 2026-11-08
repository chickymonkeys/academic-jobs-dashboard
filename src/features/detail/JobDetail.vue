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

const props = defineProps<{
  v: Vacancy
  version?: string
  nearby: Array<{ v: Vacancy; km: number }>
  variant: "panel" | "sheet"
  /** Where this listing sits in the results, for stepping to the next or previous one without going back */
  position?: { index: number; total: number } | null
  /** Sheet only: the action bar hides while the sheet is lowered to its peek, where it would cover the title */
  peeked?: boolean
}>()
const emit = defineEmits<{ close: []; select: [id: string]; showOnMap: []; step: [by: 1 | -1] }>()
const toast = useToast()

// Phones hand the link to the system share sheet (Messages, Mail, notes…); elsewhere it's copied
const canShare = typeof navigator !== "undefined" && "share" in navigator && matchMedia("(pointer: coarse)").matches
async function share() {
  const url = window.location.href
  if (canShare) {
    try {
      await navigator.share({ title: props.v.title, text: `${props.v.title} · ${props.v.institution}`, url })
      return
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: "Link copied", description: "It opens this position on the map.", icon: "i-lucide-link-2", color: "success" })
  } catch {
    toast.add({ title: "Couldn't copy the link", color: "error" })
  }
}
// The button says which of the two it does: a touch screen at desktop width (a tablet on its side) shares too
const shareLabel = canShare ? "Share" : "Copy link"
const shareIcon = canShare ? "i-lucide-share" : "i-lucide-link-2"
const iconBtn = "size-9 justify-center"
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <div class="flex items-center gap-1 px-2 pt-2 pb-1">
      <UButton
        v-if="variant === 'sheet'"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-chevron-left"
        class="-ml-0.5 h-9 pr-3 text-toned"
        @click="emit('close')"
      >
        Results
      </UButton>
      <UTooltip v-else text="Close" :kbds="['esc']">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-x" aria-label="Close details" :class="iconBtn" @click="emit('close')" />
      </UTooltip>

      <!-- Step through the results without going back to the list (j/k on a keyboard) -->
      <div v-if="position && position.total > 1" class="flex items-center" role="group" aria-label="Browse results">
        <UTooltip text="Previous" :kbds="['k']" :disabled="variant === 'sheet'">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-chevron-up"
            aria-label="Previous position"
            :disabled="position.index === 0"
            :class="iconBtn"
            @click="emit('step', -1)"
          />
        </UTooltip>
        <span class="min-w-[4.5rem] text-center text-xs text-muted tabular-nums" aria-live="polite">
          {{ position.index + 1 }} of {{ position.total.toLocaleString() }}
        </span>
        <UTooltip text="Next" :kbds="['j']" :disabled="variant === 'sheet'">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-chevron-down"
            aria-label="Next position"
            :disabled="position.index >= position.total - 1"
            :class="iconBtn"
            @click="emit('step', 1)"
          />
        </UTooltip>
      </div>

      <div class="ml-auto flex items-center gap-0.5">
        <UTooltip text="Show on map">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-crosshair" aria-label="Show on map" :class="iconBtn" @click="emit('showOnMap')" />
        </UTooltip>
        <template v-if="variant === 'panel'">
          <UTooltip :text="shareLabel">
            <UButton color="neutral" variant="ghost" size="sm" :icon="shareIcon" :aria-label="shareLabel" :class="iconBtn" @click="share" />
          </UTooltip>
          <SaveButton :id="v.id" :class="iconBtn" />
        </template>
      </div>
    </div>

    <div
      class="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
      :class="
        variant === 'sheet'
          ? 'pb-[calc(var(--sheet-hidden,0px)+env(safe-area-inset-bottom)+6rem)]'
          : 'pb-[calc(var(--sheet-hidden,0px)+env(safe-area-inset-bottom)+2rem)]'
      "
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

      <div v-if="variant === 'panel' || v.alsoOn.length" class="mt-4 flex flex-wrap items-center gap-2">
        <UButton
          v-if="variant === 'panel'"
          :to="v.url"
          target="_blank"
          trailing-icon="i-lucide-arrow-up-right"
          class="flex-1 justify-center"
        >
          View & apply on {{ sourceLabel(v.source) }}
        </UButton>
        <span v-else class="text-xs text-muted">Also listed on</span>
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

    <!--
      Phones: the actions sit in the thumb zone, pinned to the bottom of the screen. The sheet is taller than what
      shows of it at the half detent, so the bar rides --sheet-hidden up to the screen edge, in step with the sheet.
    -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-3 opacity-0"
    >
      <div
        v-if="variant === 'sheet' && !peeked"
        class="absolute inset-x-0 z-10 flex items-center gap-2 border-t border-default bg-default/95 px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),10px)] backdrop-blur-md transition-[bottom] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        :style="{ bottom: 'var(--sheet-hidden, 0px)' }"
      >
        <SaveButton :id="v.id" :tooltip="false" class="size-11 shrink-0 justify-center rounded-xl border border-default" />
        <UButton
          color="neutral"
          variant="outline"
          :icon="shareIcon"
          :aria-label="shareLabel"
          class="size-11 shrink-0 justify-center rounded-xl"
          @click="share"
        />
        <UButton
          :to="v.url"
          target="_blank"
          trailing-icon="i-lucide-arrow-up-right"
          class="h-11 min-w-0 flex-1 justify-center rounded-xl text-sm"
        >
          <span class="truncate">Apply on {{ sourceLabel(v.source) }}</span>
        </UButton>
      </div>
    </Transition>
  </div>
</template>
