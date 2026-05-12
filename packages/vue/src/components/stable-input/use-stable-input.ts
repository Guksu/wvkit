import { ref, onMounted, onUnmounted } from 'vue';
import { createStableInput } from '@wvkit/core';
import type { StableInputOptions, StableInputInstance } from '@wvkit/core';

export function useStableInput(options: StableInputOptions = {}) {
  const containerRef = ref<HTMLElement | null>(null);
  let instance: StableInputInstance | null = null;

  onMounted(() => {
    if (!containerRef.value) return;
    instance = createStableInput(containerRef.value, options);
  });

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
  });

  function focus() { instance?.focus(); }
  function blur() { instance?.blur(); }
  function setValue(v: string) { instance?.setValue(v); }
  function getValue() { return instance?.getValue() ?? ''; }

  return { containerRef, focus, blur, setValue, getValue };
}
