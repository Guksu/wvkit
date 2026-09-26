# @guksu/wvkit-vue

## 0.7.0

### Minor Changes

- bcd912f: ScrollContainer: 패널이 렌더 창에 들어오고 나갈 때 알리는 `onPanelVisibilityChange`, 컴포넌트의 지연 마운트 `lazy`.

  - core: 옵션 `onPanelVisibilityChange(index, visible, panel)` 추가. 패널이 렌더 창(쉴 때 화면에 보이는 패널 + 양쪽 `overscan`)에 들어오면 `true`, 나가면 `false`. 한 번도 들어온 적 없는 패널은 들어올 때까지 알리지 않고, `setPanels` 로 빠진 패널도 알리지 않는다. 콜백만 바꾸면 다시 배치하지 않는다.
  - react·vue 훅: 같은 콜백을 최신 값으로 부른다 (바꿔도 `setOptions` 를 부르지 않는다).
  - react·vue 컴포넌트: `<ScrollContainer lazy>` — 각 패널 내용을 그 패널이 처음 렌더 창에 들어올 때 마운트하고 그 뒤로 유지한다. 기본값 `false` 는 지금과 같다(모든 패널 내용을 처음부터 마운트). React 는 `onPanelVisibilityChange` prop, Vue 는 `@panel-visibility-change` 이벤트.
  - 문서: 창 밖 패널이 "문서에서 떼어진다"는 틀린 설명을 바로잡는다 (한 번도 보인 적 없는 패널만 떼어져 있고, 나머지는 `display: none`).

### Patch Changes

- Updated dependencies [bcd912f]
  - @guksu/wvkit-core@0.6.0

## 0.6.1

### Patch Changes

- Updated dependencies [a7897fe]
  - @guksu/wvkit-core@0.5.1

## 0.6.0

### Minor Changes

- 8241db9: ScrollContainer: React·Vue 컴포넌트 `ScrollContainer` + `ScrollPanel` 추가 — `panels` 배열 대신 패널을 자식으로 쓴다.

  - 패널 순서는 코드에 쓴 순서. 조건부 패널·감싼 컴포넌트도 그 순서를 따른다. 패널을 넣고 빼면 `setPanels` 와 같게 보던 패널과 남는 패널의 스크롤 위치가 유지된다.
  - `panels` 를 뺀 모든 옵션이 prop. 바뀐 prop 은 `setOptions` 로 넘겨 다시 마운트하지 않는다. `initialIndex` 는 첫 패널이 생길 때 한 번 읽는다.
  - `ScrollContainer` 의 속성은 호스트 요소에, `ScrollPanel` 의 속성은 패널 안 내용 요소(`height: 100%`)에 붙는다. `ScrollPanel` 의 `label` 은 패널 요소의 `aria-label`.
  - `ref` 핸들 `ScrollContainerHandle`: `scrollTo`·`zoomTo`·`getActiveIndex`·`getZoom`. 제어형 `activeIndex` prop 은 없다 (`onIndexChange` / `@index-change` 로 상태를 들고 `scrollTo` 로 옮긴다).
  - 패널이 없으면 인스턴스를 만들지 않는다. SSR 에서는 패널 내용을 그리지 않고 브라우저에서 마운트된 뒤 그린다.
  - react: 패널 내용을 `createPortal` 로 그리므로 peer dependency 에 `react-dom` (>=18) 추가. vue: `Teleport` 사용.
  - 번들 (size-limit, brotli, core·프레임워크 제외): React 컴포넌트 1.2 kB, Vue 컴포넌트 1.27 kB. 훅만 가져오면 컴포넌트 코드는 들어가지 않는다 (React 훅 526 B, Vue 훅 548 B).

## 0.5.0

### Minor Changes

- ff7a45e: ScrollContainer: 다시 마운트하지 않고 패널·옵션 바꾸기 — `setPanels(panels)`, `setOptions(changes)`.

  - core: 인스턴스에 `setPanels`·`setOptions` 추가 (새 타입 `ScrollContainerOptionsUpdate`). `direction` 을 포함해 모든 옵션을 바꿀 수 있다 (`initialIndex` 는 마운트 때만). `undefined` 를 주면 기본값으로.
    - 보던 패널이 남아 있으면 화면에 그대로(줌·pan 위치 포함), 번호가 바뀌면 `onIndexChange`. 지워졌으면 같은 번호 자리의 패널.
    - 남는 패널은 문서에서 떼지 않아 스크롤 위치가 유지된다. 빠진 패널은 떼고 인라인 스타일·ARIA 속성을 되돌린다.
    - 같은 값·새 콜백·같은 배치를 내는 새 함수면 아무 일도 하지 않는다. 바뀐 것이 있으면 진행 중인 제스처·애니메이션을 멈추고, 줌은 새 범위 안으로.
    - 잘못된 값이면 DOM 을 바꾸기 전에 `WebviewHeadlessError`. 같은 요소가 두 번 든 `panels` 는 생성 때도 오류.
    - 키보드를 켜고 끌 때만 호스트 `tabindex` 를 붙이고 떼어, 다른 옵션을 바꿔도 포커스를 잃지 않는다.
  - react: `useScrollContainer` 가 렌더마다 옵션을 비교해 바뀐 키만 `setOptions` 로 넘긴다. 패널 배열은 요소 단위로 비교. 더 이상 `key` 로 다시 마운트할 필요가 없다.
  - vue: `useScrollContainer` 가 `MaybeRefOrGetter<ScrollContainerOptions>` 를 받는다. `reactive`·`ref`·getter 를 넘기면 바뀐 키를 `setOptions` 로 넘긴다. 보통 객체는 이전처럼 마운트 때 한 번 읽는다.
  - 번들: core brotli 7.15 kB → 7.71 kB. size-limit 한도 7.5 KB → 8 KB.

### Patch Changes

- Updated dependencies [5ea2cd0]
- Updated dependencies [6fd98d7]
- Updated dependencies [c5e3be0]
- Updated dependencies [ff7a45e]
- Updated dependencies [7790a7e]
- Updated dependencies [0c3c0d8]
- Updated dependencies [5d5a344]
- Updated dependencies [1edced3]
- Updated dependencies [0f2b136]
- Updated dependencies [2fd8514]
  - @guksu/wvkit-core@0.5.0

## 0.4.0

### Minor Changes

- 7f9fd91: **BREAKING**: ScrollContainer는 `<pkg>/scroll-container` subpath로 이동 — three 미설치 CJS/ESM 소비자의 배럴 크래시 해소.

  - `createScrollContainer`는 `@guksu/wvkit-core/scroll-container`, `useScrollContainer`는 `@guksu/wvkit-react/scroll-container` · `@guksu/wvkit-vue/scroll-container`에서 import (배럴 `.`에는 타입만 잔존).
  - 배럴(`.`)이 더 이상 three를 정적 로드하지 않으므로 optional peer 설계대로 three 없이 StableInput 등 non-three 컴포넌트 사용 가능.
  - destroy 이후 `scrollTo`/`zoomTo`는 완전 no-op (상태 갱신·`onIndexChange`/`onZoomChange` 발화 누수 차단).

- 9380974: Trust fixes: export `WebviewHeadlessError` as a runtime value from all three barrels (core + react/vue re-export) so consumers can identify library errors via `instanceof`; relax `three` peer range from `^0.184.0` to `>=0.160.0` (floor verified by typecheck/build/test matrix); fix stale `@wvkit/core` external in react/vue tsup configs to `@guksu/wvkit-core`.

### Patch Changes

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
