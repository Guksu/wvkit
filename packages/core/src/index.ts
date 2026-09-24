export { WebviewHeadlessError } from './errors';
export { createSafeArea } from './components/safe-area';
export type { SafeAreaInsets, SafeAreaOptions, SafeAreaInstance } from './components/safe-area';
export { createScrollLock } from './components/scroll-lock';
export type { ScrollLockOptions, ScrollLockInstance } from './components/scroll-lock';
export { createVirtualKeyboard } from './components/virtual-keyboard';
export type {
  VirtualKeyboardState,
  VirtualKeyboardOptions,
  VirtualKeyboardInstance,
} from './components/virtual-keyboard';
export { createStableInput } from './components/stable-input';
export type { StableInputOptions, StableInputInstance } from './components/stable-input';
// ScrollContainer 값(createScrollContainer)은 `@guksu/wvkit-core/scroll-container` subpath 로만
// 노출한다 (B-02 — 0.4의 three 경계에서 시작, 0.5부터 의존성은 없지만 import 경로 호환을 위해 유지).
// 타입은 type-only 라 dist 런타임에 흔적이 없으므로 배럴에 유지한다.
export type {
  ScrollContainerDirection,
  ScrollContainerOptions,
  ScrollContainerOptionsUpdate,
  ScrollContainerInstance,
} from './components/scroll-container';
export { createPullToRefresh } from './components/pull-to-refresh';
export type {
  PullToRefreshState,
  PullToRefreshOptions,
  PullToRefreshInstance,
} from './components/pull-to-refresh';
