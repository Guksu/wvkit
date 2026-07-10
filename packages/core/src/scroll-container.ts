/**
 * `@guksu/wvkit-core/scroll-container` subpath 엔트리.
 *
 * ScrollContainer 는 three(peer, optional)를 정적 로드하므로 배럴(`.`)에서 분리한다 —
 * three 미설치 CJS/ESM 소비자가 non-three 컴포넌트를 크래시 없이 쓸 수 있게 하는 경계.
 * 배럴에는 타입만 type-only re-export 로 잔존한다 (런타임 비용 0).
 */
export { createScrollContainer } from './components/scroll-container';
export type {
  ScrollContainerDirection,
  ScrollContainerOptions,
  ScrollContainerInstance,
} from './components/scroll-container';
