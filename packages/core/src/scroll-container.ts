/**
 * `@guksu/wvkit-core/scroll-container` subpath 엔트리.
 *
 * 0.4에서 three(peer) 정적 로드를 배럴(`.`)과 분리하기 위해 만든 경계다. 0.5부터 ScrollContainer는
 * 외부 의존성이 없지만, 기존 import 경로 호환을 위해 subpath를 유지한다.
 * 배럴에는 타입만 type-only re-export 로 잔존한다.
 */
export { createScrollContainer } from './components/scroll-container';
export type {
  ScrollContainerDirection,
  ScrollContainerOptions,
  ScrollContainerInstance,
} from './components/scroll-container';
