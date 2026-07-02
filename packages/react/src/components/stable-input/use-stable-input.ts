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
    // 사용자 콜백은 최신 ref 경유로 호출 — 마운트 시점 options 스냅샷을 그대로 넘기면
    // 리렌더 이후 교체된 콜백 대신 stale closure가 호출된다 (다른 훅들과 동일한 wrap 패턴).
    instanceRef.current = createStableInput(containerRef.current, {
      ...optionsRef.current,
      onChange: (v) => optionsRef.current.onChange?.(v),
      onFocus: () => optionsRef.current.onFocus?.(),
      onBlur: () => optionsRef.current.onBlur?.(),
      onSubmit: (v) => optionsRef.current.onSubmit?.(v),
    });
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
