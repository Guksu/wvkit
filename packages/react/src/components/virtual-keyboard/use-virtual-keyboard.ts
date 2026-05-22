import { useState, useEffect } from 'react';
import { createVirtualKeyboard } from '@guksu/wvkit-core';
import type { VirtualKeyboardState } from '@guksu/wvkit-core';

interface UseVirtualKeyboardOptions {
  threshold?: number;
}

const INITIAL_STATE: VirtualKeyboardState = { isOpen: false, keyboardHeight: 0 };

export function useVirtualKeyboard(options: UseVirtualKeyboardOptions = {}): VirtualKeyboardState {
  const [state, setState] = useState<VirtualKeyboardState>(INITIAL_STATE);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 의도적 빈 배열 — threshold는 마운트 시점에 고정, 인스턴스 라이프사이클은 마운트/언마운트에만 묶는다.
  useEffect(() => {
    const instance = createVirtualKeyboard({
      ...(options.threshold !== undefined && { threshold: options.threshold }),
      onChange: setState,
    });
    return () => instance.destroy();
  }, []);

  return state;
}
