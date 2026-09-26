<script setup lang="ts">
import { ref } from 'vue';
import { ScrollContainer, ScrollPanel, type ScrollContainerHandle } from '@guksu/wvkit-vue/scroll-container';

const props = withDefaults(
  defineProps<{ photos: { src: string; alt: string }[]; startIndex?: number }>(),
  { startIndex: 0 },
);
const viewer = ref<ScrollContainerHandle | null>(null);
const index = ref(props.startIndex);

function onIndexChange(i: number) {
  index.value = i;
  // Zoom belongs to the whole pager, not to one photo. Start every photo at fit.
  if ((viewer.value?.getZoom() ?? 1) > 1) viewer.value?.zoomTo(1);
}
</script>

<template>
  <div class="image-viewer">
    <ScrollContainer
      ref="viewer"
      class="image-viewer-pager"
      aria-label="Photos"
      direction="horizontal"
      :initial-index="props.startIndex"
      :gap="16"
      lazy
      :overscan="1"
      :max-zoom="4"
      :double-tap-zoom="2.5"
      @index-change="onIndexChange"
    >
      <ScrollPanel v-for="photo in photos" :key="photo.src" class="image-viewer-photo">
        <img :src="photo.src" :alt="photo.alt" decoding="async" draggable="false" />
      </ScrollPanel>
    </ScrollContainer>
    <p class="image-viewer-count" aria-hidden="true">{{ index + 1 }} / {{ photos.length }}</p>
  </div>
</template>
