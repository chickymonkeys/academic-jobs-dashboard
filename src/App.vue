<script setup lang="ts">
import { computed } from "vue"
import { useIsDesktop } from "@/lib/media"

const isDesktop = useIsDesktop()
const toaster = computed(() => ({ position: isDesktop.value ? ("bottom-center" as const) : ("top-center" as const) }))
</script>

<template>
  <UApp :toaster="toaster" :tooltip="{ delayDuration: 350 }">
    <RouterView />
  </UApp>
</template>
