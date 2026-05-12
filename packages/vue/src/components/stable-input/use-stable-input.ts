import { ref, onMounted, onUnmounted } from 'vue';
import { createStableInput } from '@wvkit/core';
import type { StableInputOptions, StableInputInstance } from '@wvkit/core';

export function useStableInput(options: StableInputOptions = {}) {
  const containerRef = ref<HTMLElement | null>(null);
  let instance: StableInputInstance | null = null;

  onMounted(() => {
    if (!containerRef.value) return;
    instance = createStableInput(containerRef.value, {
      ...(options.type !== undefined && { type: options.type }),
      ...(options.placeholder !== undefined && { placeholder: options.placeholder }),
      ...(options.inputMode !== undefined && { inputMode: options.inputMode }),
      ...(options.autocomplete !== undefined && { autocomplete: options.autocomplete }),
      ...(options.suppressLayoutShift !== undefined && { suppressLayoutShift: options.suppressLayoutShift }),
      ...(options.scrollAnchor !== undefined && { scrollAnchor: options.scrollAnchor }),
      onChange: (v) => options.onChange?.(v),
      onFocus: () => options.onFocus?.(),
      onBlur: () => options.onBlur?.(),
      onSubmit: (v) => options.onSubmit?.(v),
    });
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
