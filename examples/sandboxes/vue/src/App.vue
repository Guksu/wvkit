<script setup lang="ts">
import { usePullToRefresh, useStableInput } from '@guksu/wvkit-vue';
import { ref } from 'vue';

// --- PullToRefresh ---
const items = ref<string[]>([
  'Pull down inside the list to refresh',
  'Works on touch devices and DevTools mobile emulation',
]);

const { containerRef, state, distance, progress } = usePullToRefresh({
  onRefresh: async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    items.value = [
      `#${items.value.length + 1} — refreshed at ${new Date().toLocaleTimeString()}`,
      ...items.value,
    ];
  },
});

// --- StableInput ---
const value = ref('');
const { containerRef: inputContainerRef } = useStableInput({
  placeholder: 'Type here — layout stays put on iOS',
  onChange: (v) => {
    value.value = v;
  },
});
</script>

<template>
  <div class="app">
    <h1>wvkit sandbox (Vue)</h1>

    <section class="section">
      <h2>PullToRefresh — headless pull-to-refresh</h2>
      <div ref="containerRef" class="ptr-container">
        <!-- Headless: you render the indicator yourself. progress goes 0 → 1 → beyond -->
        <div
          class="ptr-indicator"
          :style="{ opacity: progress, transform: `translateY(${distance}px)` }"
        >
          {{ state === 'refreshing' ? 'Refreshing…' : state === 'armed' ? 'Release to refresh' : 'Pull to refresh' }}
        </div>
        <div v-for="item in items" :key="item" class="ptr-item">
          {{ item }}
        </div>
      </div>
    </section>

    <section class="section">
      <h2>StableInput — iOS keyboard layout-shift prevention</h2>
      <div ref="inputContainerRef" class="stable-input-display"></div>
      <p class="value-echo">value: {{ value || '(empty)' }}</p>
    </section>
  </div>
</template>
