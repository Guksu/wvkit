import { useState, useEffect, useCallback, useRef } from 'react';
import { createScrollLock } from '@guksu/wvkit-core';
import type { ScrollLockInstance } from '@guksu/wvkit-core';

export function useScrollLock() {
  const [isLocked, setIsLocked] = useState(false);
  const instanceRef = useRef<ScrollLockInstance | null>(null);

  useEffect(() => {
    instanceRef.current = createScrollLock({
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
