import { ref, onMounted, onUnmounted } from 'vue';
import { createScrollLock } from '@guksu/wvkit-core';
import type { ScrollLockInstance } from '@guksu/wvkit-core';

interface UseScrollLockOptions {
  /** 잠금 중에도 터치 스크롤을 허용할 영역 (CSS 선택자 또는 엘리먼트) */
  allowScrollWithin?: string | HTMLElement;
}

export function useScrollLock(options: UseScrollLockOptions = {}) {
  const isLocked = ref(false);
  let instance: ScrollLockInstance | null = null;

  onMounted(() => {
    instance = createScrollLock({
      ...(options.allowScrollWithin !== undefined && {
        allowScrollWithin: options.allowScrollWithin,
      }),
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
