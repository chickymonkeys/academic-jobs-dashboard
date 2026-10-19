<script setup lang="ts">
defineProps<{ message: string }>()
const reload = () => window.location.reload()
</script>

<template>
  <div class="m-4 rounded-xl border border-error/30 bg-error/5 p-4 text-sm">
    <p class="font-medium text-highlighted">Couldn't load listings</p>
    <p class="mt-1 text-xs text-muted">{{ message }}</p>
    <UButton color="neutral" variant="outline" size="sm" class="mt-3" @click="reload">Retry</UButton>
  </div>
</template>
