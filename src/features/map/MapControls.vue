<script setup lang="ts">
import { computed } from "vue"
import { useToast } from "@nuxt/ui/composables"
import { useTheme } from "@/lib/theme"
import type { Camera } from "./camera"

const props = defineProps<{ camera: Camera; globe: boolean; compact?: boolean }>()
const emit = defineEmits<{ globe: [on: boolean]; fitResults: [] }>()

const { mode, setTheme } = useTheme()
const toast = useToast()
const dark = computed(() => mode.value === "dark")

function locate() {
  if (!("geolocation" in navigator)) return void toast.add({ title: "Location isn't available in this browser", color: "error" })
  navigator.geolocation.getCurrentPosition(
    (p) => props.camera.flyTo(p.coords.longitude, p.coords.latitude, 7, { byUser: true }),
    () =>
      toast.add({
        title: "Couldn't get your location",
        description: "Check the browser's location permission.",
        color: "error",
      }),
    { timeout: 8000 },
  )
}

type Ctl = { label: string; icon: string; kbd?: string; pressed?: boolean; onClick: () => void }
const zoom = computed<Ctl[]>(() => [
  { label: "Zoom in", icon: "i-lucide-plus", kbd: "+", onClick: () => props.camera.zoomBy(1) },
  { label: "Zoom out", icon: "i-lucide-minus", kbd: "−", onClick: () => props.camera.zoomBy(-1) },
])
const tools = computed<Ctl[]>(() => [
  { label: "Fit map to results", icon: "i-lucide-scan-search", kbd: "F", onClick: () => emit("fitResults") },
  { label: "Near me", icon: "i-lucide-locate-fixed", onClick: locate },
  { label: "Globe view", icon: "i-lucide-globe-2", pressed: props.globe, onClick: () => emit("globe", !props.globe) },
  {
    label: dark.value ? "Light mode" : "Dark mode",
    icon: dark.value ? "i-lucide-sun" : "i-lucide-moon",
    onClick: () => setTheme(dark.value ? "light" : "dark"),
  },
])
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(group, gi) in compact ? [tools] : [zoom, tools]" :key="gi" class="surface-float flex flex-col rounded-xl p-0.5">
      <UTooltip v-for="c in group" :key="c.label" :text="c.label" :kbds="c.kbd ? [c.kbd] : undefined" :content="{ side: 'left' }">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="c.icon"
          :aria-label="c.label"
          :aria-pressed="c.pressed"
          class="size-9 justify-center rounded-lg aria-pressed:bg-elevated aria-pressed:text-primary"
          @click="c.onClick"
        />
      </UTooltip>
    </div>
  </div>
</template>
