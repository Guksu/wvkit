# @guksu/wvkit-react

## 0.4.0

### Minor Changes

- 7f9fd91: **BREAKING**: ScrollContainer는 `<pkg>/scroll-container` subpath로 이동 — three 미설치 CJS/ESM 소비자의 배럴 크래시 해소.

  - `createScrollContainer`는 `@guksu/wvkit-core/scroll-container`, `useScrollContainer`는 `@guksu/wvkit-react/scroll-container` · `@guksu/wvkit-vue/scroll-container`에서 import (배럴 `.`에는 타입만 잔존).
  - 배럴(`.`)이 더 이상 three를 정적 로드하지 않으므로 optional peer 설계대로 three 없이 StableInput 등 non-three 컴포넌트 사용 가능.
  - destroy 이후 `scrollTo`/`zoomTo`는 완전 no-op (상태 갱신·`onIndexChange`/`onZoomChange` 발화 누수 차단).

- 9380974: Trust fixes: export `WebviewHeadlessError` as a runtime value from all three barrels (core + react/vue re-export) so consumers can identify library errors via `instanceof`; relax `three` peer range from `^0.184.0` to `>=0.160.0` (floor verified by typecheck/build/test matrix); fix stale `@wvkit/core` external in react/vue tsup configs to `@guksu/wvkit-core`.

### Patch Changes

- 7924f51: `react-dom` peer dependency 제거 — 소스가 react-dom을 참조하지 않으므로 소비자 설치 제약만 완화된다(`react >=18` peer는 유지).
- ce9601c: fix exports map: split CJS types to .d.cts (attw FalseESM)
- Updated dependencies [7924f51]
- Updated dependencies [ce9601c]
- Updated dependencies [7f9fd91]
- Updated dependencies [9380974]
  - @guksu/wvkit-core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies
  - @guksu/wvkit-core@0.3.1

## 0.3.0

### Minor Changes

- feat(pull-to-refresh): add PullToRefresh for core/react/vue

  WebView 환경에서 네이티브급 당김 새로고침을 위한 헤드리스 컴포넌트.

  - 상태 머신(`idle → pulling → armed → refreshing → resetting → idle`) — `onStateChange` 콜백으로 dedupe 발화
  - 저항 곡선 (`resistance` 옵션) 으로 자연스러운 elastic 느낌, `maxDistance` 로 hard cap
  - touch + pointer 이벤트 양쪽 핸들러 + `activeSource` 가드 (iOS의 touch→pointer 합성 이중 발화 방지)
  - `overscroll-behavior: contain` 자동 적용 (`disableOverscrollContain` 으로 opt-out) — iOS WebView native PTR과 충돌 방지
  - `onRefresh` 는 `Promise<void> | void` 모두 지원, throw/reject 시 `console.error` 로 swallow + `idle` 복귀
  - 명령형 API: `trigger()` (Promise<void>, 동시 호출 차단 — 같은 Promise 인스턴스 반환) / `getState()` / `setEnabled(enabled)` / `destroy()` (멱등성)
  - React 어댑터 `usePullToRefresh` — `{ containerRef, state, distance, progress, trigger, setEnabled }`
  - Vue 3 어댑터 `usePullToRefresh` — `{ containerRef, state(Ref), distance(Ref), progress(Ref), trigger, setEnabled }`

  **외부 의존성 추가 없음** — `@guksu/wvkit-core` 에 zero runtime deps (ScrollContainer 의 `three` peer dep 과 달리 PullToRefresh 는 추가 설치 불필요).

- feat(core,react,vue): ScrollContainer 컴포넌트 추가 (Three.js 기반)

  WebView에서 네이티브급 화면 전환을 위한 헤드리스 컴포넌트.

  - Three.js + CSS3DRenderer + OrthographicCamera 기반 렌더링
  - 커스텀 CameraControl: axis-constrained pan / snap / 엣지 저항 / 핀치 줌
  - frustum + overscan 가상화 (활성 패널 ± overscan만 visible)
  - 명령형 API: `scrollTo(index, { animated? })`, `zoomTo(level, { animated? })`, `getActiveIndex()`, `getZoom()`, `destroy()`
  - React 어댑터 `useScrollContainer` — `{ containerRef, activeIndex, activeZoom, scrollTo, zoomTo }`
  - Vue 3 어댑터 `useScrollContainer` — `{ containerRef, activeIndex(Ref), activeZoom(Ref), scrollTo, zoomTo }`

  **Peer dependency 추가**: `@guksu/wvkit-core`는 `three@^0.184.0`을 peer dependency로 요구합니다. 호스트 앱에서 한 번 설치하면 `@guksu/wvkit-react` / `@guksu/wvkit-vue` 어댑터는 transitively external로 처리됩니다.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @guksu/wvkit-core@0.3.0
