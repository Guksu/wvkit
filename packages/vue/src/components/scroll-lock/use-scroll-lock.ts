import { ref, onMounted, onUnmounted } from 'vue';
import { createScrollLock } from '@guksu/wvkit-core';
import type { ScrollLockInstance } from '@guksu/wvkit-core';

export function useScrollLock() {
  const isLocked = ref(false);
  let instance: ScrollLockInstance | null = null;

  onMounted(() => {
    instance = createScrollLock({
      onLock: () => { isLocked.value = true; },
      onUnlock: () => { isLocked.value = false; },
    });
  });

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
  });

  function lock() { instance?.lock(); }
  function unlock() { instance?.unlock(); }

  return { lock, unlock, isLocked };
}
