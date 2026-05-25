# @guksu/wvkit-core

## 0.3.1

### Patch Changes

- fix(scroll-container): destroy 시 누수 경로 3건 정리 (P3 polish)

  - **m-3**: `destroy()`의 `renderer.domElement.parentNode === root` 동등성 체크를 존재성 체크로 완화 — 외부에서 renderer를 다른 컨테이너로 옮긴 뒤 destroy 호출 시 detach 누락되던 버그 수정.
  - **m-4**: destroy 끝에서 `scene.clear()`로 보유 중인 CSS3DObject 참조를 일괄 해제. camera/renderer 자체는 클로저 GC로 회수되므로 명시적 null 할당은 없음.
  - **m-5**: CameraControl이 setPointerCapture된 pointerId를 Set으로 트래킹하고, destroy 시점에 남은 모든 캡처를 `releasePointerCapture`로 명시 해제 — 진행 중 제스처가 있는 상태로 컴포넌트가 unmount될 때 capture 누수 방지.

  행동 변화 없음 (기존 정상 destroy 시퀀스에서 동작 동일). 외부 API 변경 없음.

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
