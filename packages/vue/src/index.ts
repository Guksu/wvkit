export { useSafeArea } from './components/safe-area';
export { useScrollLock } from './components/scroll-lock';
export { useVirtualKeyboard } from './components/virtual-keyboard';
export { useStableInput } from './components/stable-input';
// useScrollContainer 는 three 로드 경계 분리(B-02)로
// `@guksu/wvkit-vue/scroll-container` subpath 로만 노출한다 (타입은 아래 블록에 잔존).
export { usePullToRefresh } from './components/pull-to-refresh';
export { WebviewHeadlessError } from '@guksu/wvkit-core';
// core 타입을 vue 측에서도 import 가능하게 type-only re-export
export type {
  ScrollContainerDirection,
  ScrollContainerInstance,
  ScrollContainerOptions,
  PullToRefreshInstance,
  PullToRefreshOptions,
  PullToRefreshState,
} from '@guksu/wvkit-core';
