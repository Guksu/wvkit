import { useState, useEffect } from 'react';
import { createSafeArea } from '@guksu/wvkit-core';
import type { SafeAreaInsets } from '@guksu/wvkit-core';

const INITIAL_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(INITIAL_INSETS);

  useEffect(() => {
    const instance = createSafeArea({ onChange: setInsets });
    setInsets(instance.getInsets());
    return () => instance.destroy();
  }, []);

  return insets;
}
