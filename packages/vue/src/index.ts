export { useSafeArea } from './components/safe-area';
export { useScrollLock } from './components/scroll-lock';
export { useVirtualKeyboard } from './components/virtual-keyboard';
export { useStableInput } from './components/stable-input';
export { useScrollContainer } from './components/scroll-container';
// core 타입을 vue 측에서도 import 가능하게 type-only re-export
export type {
  ScrollContainerDirection,
  ScrollContainerInstance,
  ScrollContainerOptions,
} from '@wvkit/core';
