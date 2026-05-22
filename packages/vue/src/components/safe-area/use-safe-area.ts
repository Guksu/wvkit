import { ref, onMounted, onUnmounted } from 'vue';
import { createSafeArea } from '@guksu/wvkit-core';
import type { SafeAreaInsets, SafeAreaInstance } from '@guksu/wvkit-core';

export function useSafeArea() {
  const insets = ref<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
  let instance: SafeAreaInstance | null = null;

  onMounted(() => {
    instance = createSafeArea({
      onChange: (newInsets) => {
        insets.value = newInsets;
      },
    });
    insets.value = instance.getInsets();
  });

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
  });

  return insets;
}
