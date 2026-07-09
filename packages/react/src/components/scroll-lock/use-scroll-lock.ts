import { useState, useEffect, useCallback, useRef } from 'react';
import { createScrollLock } from '@guksu/wvkit-core';
import type { ScrollLockInstance } from '@guksu/wvkit-core';

interface UseScrollLockOptions {
  /** 잠금 중에도 터치 스크롤을 허용할 영역 (CSS 선택자 또는 엘리먼트) */
  allowScrollWithin?: string | HTMLElement;
}

export function useScrollLock(options: UseScrollLockOptions = {}) {
  const [isLocked, setIsLocked] = useState(false);
  const instanceRef = useRef<ScrollLockInstance | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 의도적 빈 배열 — allowScrollWithin은 마운트 시점에 고정, 인스턴스 라이프사이클은 마운트/언마운트에만 묶는다.
  useEffect(() => {
    instanceRef.current = createScrollLock({
      ...(options.allowScrollWithin !== undefined && {
        allowScrollWithin: options.allowScrollWithin,
      }),
      onLock: () => setIsLocked(true),
      onUnlock: () => setIsLocked(false),
    });
    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  const lock = useCallback(() => instanceRef.current?.lock(), []);
  const unlock = useCallback(() => instanceRef.current?.unlock(), []);

  return { lock, unlock, isLocked };
}
