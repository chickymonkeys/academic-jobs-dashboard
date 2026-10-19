<script setup lang="ts">
import { computed } from "vue"
import type { Block } from "@/domain/vacancy"

const props = defineProps<{ blocks: Block[] }>()

// Consecutive list items become one <ul>; headings and paragraphs stay as they are
const groups = computed(() => {
  const out: Array<{ t: "h" | "p"; text: string } | { t: "ul"; items: string[] }> = []
  for (const b of props.blocks) {
    const last = out[out.length - 1]
    if (b.t === "li") {
      if (last?.t === "ul") last.items.push(b.text)
      else out.push({ t: "ul", items: [b.text] })
    } else out.push({ t: b.t, text: b.text })
  }
  return out
})
</script>

<!-- Blocks are plain text from the ingest; they render as text nodes, so no source markup reaches the DOM -->
<template>
  <div class="prose-job">
    <template v-for="(g, i) in groups" :key="i">
      <ul v-if="g.t === 'ul'">
        <li v-for="(t, j) in g.items" :key="j">{{ t }}</li>
      </ul>
      <h4 v-else-if="g.t === 'h'">{{ g.text }}</h4>
      <p v-else>{{ g.text }}</p>
    </template>
  </div>
</template>
