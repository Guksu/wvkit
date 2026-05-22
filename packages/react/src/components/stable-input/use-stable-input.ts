import { useEffect, useRef, useCallback } from 'react';
import { createStableInput } from '@guksu/wvkit-core';
import type { StableInputOptions, StableInputInstance } from '@guksu/wvkit-core';

export function useStableInput(options: StableInputOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<StableInputInstance | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  useEffect(() => {
    if (!containerRef.current) return;
    instanceRef.current = createStableInput(containerRef.current, optionsRef.current);
    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  const focus = useCallback(() => instanceRef.current?.focus(), []);
  const blur = useCallback(() => instanceRef.current?.blur(), []);
  const setValue = useCallback((v: string) => instanceRef.current?.setValue(v), []);
  const getValue = useCallback(() => instanceRef.current?.getValue() ?? '', []);

  return { containerRef, focus, blur, setValue, getValue };
}
