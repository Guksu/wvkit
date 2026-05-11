import { ref, onMounted, onUnmounted } from 'vue';
import { createVirtualKeyboard } from '@wvkit/core';
import type { VirtualKeyboardInstance } from '@wvkit/core';

interface UseVirtualKeyboardOptions {
  threshold?: number;
}

export function useVirtualKeyboard(options: UseVirtualKeyboardOptions = {}) {
  const isOpen = ref(false);
  const keyboardHeight = ref(0);
  let instance: VirtualKeyboardInstance | null = null;

  onMounted(() => {
    instance = createVirtualKeyboard({
      threshold: options.threshold,
      onChange: ({ isOpen: open, keyboardHeight: height }) => {
        isOpen.value = open;
        keyboardHeight.value = height;
      },
    });
  });

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
  });

  return { isOpen, keyboardHeight };
}
