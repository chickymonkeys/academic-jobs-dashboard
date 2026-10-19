<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="mt-6">
    <h3 class="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">{{ title }}</h3>
    <slot />
  </section>
</template>
