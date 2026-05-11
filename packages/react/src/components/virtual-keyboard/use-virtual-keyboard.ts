import { useState, useEffect } from 'react';
import { createVirtualKeyboard } from '@wvkit/core';
import type { VirtualKeyboardState } from '@wvkit/core';

interface UseVirtualKeyboardOptions {
  threshold?: number;
}

const INITIAL_STATE: VirtualKeyboardState = { isOpen: false, keyboardHeight: 0 };

export function useVirtualKeyboard(options: UseVirtualKeyboardOptions = {}): VirtualKeyboardState {
  const [state, setState] = useState<VirtualKeyboardState>(INITIAL_STATE);

  useEffect(() => {
    const instance = createVirtualKeyboard({
      ...(options.threshold !== undefined && { threshold: options.threshold }),
      onChange: setState,
    });
    return () => instance.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
