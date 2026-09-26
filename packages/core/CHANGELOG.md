# @guksu/wvkit-core

## 0.6.0

### Minor Changes

- bcd912f: ScrollContainer: 패널이 렌더 창에 들어오고 나갈 때 알리는 `onPanelVisibilityChange`, 컴포넌트의 지연 마운트 `lazy`.

  - core: 옵션 `onPanelVisibilityChange(index, visible, panel)` 추가. 패널이 렌더 창(쉴 때 화면에 보이는 패널 + 양쪽 `overscan`)에 들어오면 `true`, 나가면 `false`. 한 번도 들어온 적 없는 패널은 들어올 때까지 알리지 않고, `setPanels` 로 빠진 패널도 알리지 않는다. 콜백만 바꾸면 다시 배치하지 않는다.
  - react·vue 훅: 같은 콜백을 최신 값으로 부른다 (바꿔도 `setOptions` 를 부르지 않는다).
  - react·vue 컴포넌트: `<ScrollContainer lazy>` — 각 패널 내용을 그 패널이 처음 렌더 창에 들어올 때 마운트하고 그 뒤로 유지한다. 기본값 `false` 는 지금과 같다(모든 패널 내용을 처음부터 마운트). React 는 `onPanelVisibilityChange` prop, Vue 는 `@panel-visibility-change` 이벤트.
  - 문서: 창 밖 패널이 "문서에서 떼어진다"는 틀린 설명을 바로잡는다 (한 번도 보인 적 없는 패널만 떼어져 있고, 나머지는 `display: none`).

## 0.5.1

### Patch Changes

- a7897fe: ScrollContainer: 휠로 패널을 넘긴 뒤, 같은 휠 동작의 나머지가 새 패널 안의 요소를 스크롤하던 문제를 고친다.

  - 한 휠 동작(120ms 안에 이어지는 이벤트)으로 패널이 실제로 바뀌었으면, 남은 페이저 축 방향 휠은 새 패널 안의 스크롤 요소 위에 떨어져도 소비한다(`preventDefault`). 전에는 네이티브 스크롤 검사가 먼저라 그 요소로 새어 나갔다.
  - 첫·끝 패널이라 넘기지 못한 경우는 전과 같다. 같은 동작 안에서 방향을 바꾸면 패널 안의 스크롤 요소가 네이티브로 스크롤된다.
  - 헤드리스 Chromium, 세로 페이저 + 세로로 스크롤되는 패널에서 휠 4번(100px 씩): 고치기 전 새 패널이 200px 스크롤(6/6회) → 고친 뒤 0px.
  - 교차 축이 더 큰 휠과 120ms 넘게 쉰 뒤의 새 휠 동작은 전과 같다.

## 0.5.0

### Minor Changes

- 5ea2cd0: ScrollContainer: 데스크톱 입력(휠·트랙패드·키보드)과 ARIA. 새 옵션 `wheel` · `keyboard` · `a11y` (모두 기본 `true`).

  - 휠·트랙패드: 페이저 축 방향 휠 제스처(120ms 안에 이어지는 이벤트) 하나에 한 패널(누적 40px). 교차 축 성분이 더 크거나 그 방향으로 더 스크롤할 수 있는 중첩 스크롤러 위면 네이티브에 맡긴다. 줌 상태에서는 카메라 pan, `Ctrl` + 휠(트랙패드 핀치)은 커서 고정 줌. 소비한 휠만 `preventDefault`.
  - 키보드: 호스트 자신에 포커스가 있을 때 축 방향 화살표(이전/다음), `Home`/`End`, `Escape`(줌 상태면 `minZoom`). 호스트에 `tabindex`가 없으면 `0`을 주고 destroy 시 제거.
  - ARIA(APG 캐러셀 패턴): 호스트 `role="group"` + `aria-roledescription="carousel"`, 패널 `role="group"` + `aria-roledescription="slide"` + `aria-label="n / N"`, 비활성 패널 `aria-hidden` + `inert`. 이미 있는 속성은 유지, destroy 시 복원.
  - 수정: 포인터 캡처를 down 즉시가 아니라 3px 움직인 뒤에 잡는다. 이전에는 캡처 때문에 호환 마우스 이벤트가 호스트로 향해 `click`이 호스트에서 발화했고, 패널 안 버튼을 마우스로 클릭할 수 없었다(터치 탭은 click을 따로 합성해 영향이 없었다).
  - CameraControl에 `panBy(dx, dy)`·`zoomBy(factor, sx, sy)` 추가 (내부 API).
  - 번들: brotli 4.58 kB → 5.75 kB. size-limit 한도를 5 KB → 6 KB로 올렸다.

- 6fd98d7: ScrollContainer: 드래그 시작 여유와 방향 잠금. 새 옵션 `dragThreshold` (기본 10px, `0`이면 이전 동작).

  - 포인터가 `dragThreshold`를 넘게 움직이기 전에는 페이저가 움직이지 않는다. 넘는 순간 우세 축(45° 기준)으로 방향을 한 번 정한다 (Android ViewPager 의 `xDiff > mTouchSlop && xDiff > yDiff` 와 같은 규칙).
  - zoom ≤ 1 에서 교차 축이 우세하면 그 제스처는 페이저가 무시한다. zoom > 1 은 양 축 자유 pan.
  - 터치·펜은 누른 요소의 실제 `touch-action`(가장 가까운 스크롤 컨테이너까지)을 계산해, 정한 방향을 브라우저가 pan 할 터치면 움직이지 않고 `pointercancel`을 기다린다 (`pan-y` 패널의 세로 터치, `pan-x pan-y` 칩 줄의 가로 터치).
  - 시작점을 여유만큼 당겨 잡아 튀지 않는다 (ViewPager 의 `mInitialMotionX ± mTouchSlop`). 핀치 뒤 남은 손가락 pan 은 여유 없이 이어간다.
  - 포인터 캡처는 드래그가 시작된 뒤에만 잡는다 — 몇 px 흔들린 마우스 클릭도 아래 버튼에 닿는다.
  - 실측(실제 터치, Pixel 7 에뮬레이션): 46°·55°·70° 스와이프와 4px 떨린 탭의 가로 흔들림 13.9 / 11.5 / 6.8 / 4px → 모두 0px.
  - 번들: brotli 5.81 kB → 6.25 kB. size-limit 한도 6 KB → 6.5 KB.

- c5e3be0: ScrollContainer: three.js 의존성 제거 — `CSS3DRenderer` + `OrthographicCamera`를 자체 카메라 모델(`camera.ts`)과 CSS transform 렌더러(`panel-renderer.ts`)로 교체.

  - `three` peer dependency 삭제. 설치 시 `three`를 더 이상 받지 않아도 된다 (남아 있어도 무해).
  - 번들: `@guksu/wvkit-core/scroll-container` 단독 gzip 약 4 KB (이전에는 three 일부 포함 60 KB).
  - 공개 API·제스처·스냅·줌·가상화 동작 동일. 렌더 결과는 같은 수식(`screenX = (worldX − cameraX)·zoom + width/2`)이며 교체 전후 화면을 픽셀 비교로 확인.
  - 내부 DOM 구조가 `root > domElement > scene > panel` 2단계로 단순해졌다 (이전 3단계). 렌더러 내부 DOM에 의존하던 e2e 픽스처는 갱신됨. 렌더러 내부 구조는 공개 계약이 아니다.
  - `@guksu/wvkit-core/scroll-container` subpath는 import 경로 호환을 위해 유지.

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

- 7790a7e: ScrollContainer: 릴리스 관성 — 스냅 트윈 시간이 놓는 속도에 이어지고, 줌 상태 pan은 감속 투영으로 멈출 위치를 정한다.

  - 릴리스 트윈 시간 `snapDurationMs`: ease-out 초기 속도가 손가락 속도와 같도록 `3 × 거리 / 속도`, 120ms ~ 거리 비례 상한 400ms(줌 상태 자유 pan 800ms). 정지 릴리스·목표 반대 방향 속도는 상한 사용. 이전에는 항상 300ms 고정.
  - 줌 상태(zoom > 1) 릴리스: 패널 안에서 놓으면 `projectInertia`(iOS 감속 0.998/ms, 이동거리 = 속도 × 500)로 구한 정지점까지 감속하되 그 패널 가장자리를 넘지 않는다 (관성만으로 페이지 전환 없음). 가장자리 밖(gap·저항 구간)에서 놓으면 기존처럼 방향·속도로 스냅.
  - 페이저(zoom ≤ 1)의 목표 결정(`decideSnapTarget`, 한 제스처 최대 한 패널)은 그대로. `scrollTo`/`zoomTo`의 `animated: true`는 고정 300ms 유지.

- 0c3c0d8: ScrollContainer: 새 옵션 `noDragSelector` — 패널 안 JS 캐러셀(Swiper·Embla 등)이 제스처를 가져가게 한다.

  - 누른 요소가 이 CSS 선택자에 맞는 요소(호스트 안) 안에 있으면 그 제스처는 그 요소의 것이다. 페이저는 끌기·핀치·더블탭 줌을 하지 않고, 그 제스처에 더해지는 손가락도 무시한다. 다른 곳에서 시작한 제스처는 그대로.
  - 그 요소 위의 휠(페이지 넘김·줌 상태 pan)은 손대지 않는다. `Ctrl` + 휠 줌은 그대로.
  - 캐러셀 끝에서 더 밀어도 패널은 넘어가지 않는다.
  - 끝 이벤트를 놓쳐도 새 primary 포인터가 오면 무시 목록을 비운다. 호스트 자신·조상이 선택자에 맞는 것은 세지 않는다. 잘못된 선택자는 생성 시 `WebviewHeadlessError`.
  - 번들: brotli 6.95 kB → 7.15 kB. size-limit 한도 7 KB → 7.5 KB.

- 5d5a344: ScrollContainer: 패널 폭·간격·정렬 옵션. 새 옵션 `panelWidth`, `gap`, `align`. 주지 않으면 이전과 같은 배치·동작.

  - `panelWidth`: 가로 패널 폭. `(0, 1]`은 호스트 폭 비율, 1 초과는 px, 함수 `(index) => number`는 패널마다. 각 패널의 인라인 `width`에 쓰고 `destroy()` 때 원래 값으로 되돌린다. 1보다 작게 주면 양옆 패널이 가장자리에 보인다(피킹).
  - `gap`: 이웃 패널 사이 간격(px). 가로·세로 모두.
  - `align: 'center' | 'start'` (기본 `'center'`): 활성 패널을 가운데에 두거나, 시작 가장자리를 호스트 시작 가장자리에 붙인다.
  - 한 제스처에 한 칸은 그대로. `snapThreshold`와 플릭 가중치는 호스트 폭 대신 두 정착 위치 사이 거리(패널 폭 + `gap`)로 잰다.
  - 가상화는 활성 패널이 멈춘 위치에서 화면에 보이는 패널 + 양쪽 `overscan`을 붙인다. 전폭 패널이면 이전과 같다.
  - 잘못된 `panelWidth`(0 이하·유한하지 않음, 함수가 돌려준 값 포함)와 `gap`(음수·유한하지 않음)은 생성 시 `WebviewHeadlessError`. `panelWidth` 함수 검사는 DOM 을 바꾸기 전에 한다.
  - 번들: brotli 6.25 kB → 6.83 kB. size-limit 한도 6.5 KB → 7 KB.

- 0f2b136: ScrollContainer: 줌 마무리 — 줌 상태 교차 축 pan, 더블탭 줌(`doubleTapZoom`), min/max 줌 고무줄, 핀치 앵커 좌표 수정.

  - 줌 상태(zoom > 1)에서 한 손가락 pan이 교차 축(horizontal이면 Y)으로도 움직인다. 범위는 패널의 교차 축 반폭 `(crossSize/2)(1 − 1/zoom)`, 밖은 엣지 저항, 릴리스 시 관성 투영을 범위 안으로 잘라 감속. zoom ≤ 1이면 기존처럼 고정.
  - 새 옵션 `doubleTapZoom?: number | false` (기본 `false`): 더블탭으로 `minZoom` ↔ 지정 레벨 토글. 확대는 탭한 지점 고정, 축소는 패널 중심. `(minZoom, maxZoom]` 밖이면 `WebviewHeadlessError`.
  - 핀치가 `minZoom`/`maxZoom`을 넘으면 `applyZoomResistance`(배율 공간, `resistance` 지수)로 감쇠해 따라가다 마지막 손가락을 떼면 경계로 복귀. `onZoomChange`는 항상 범위 안 값. `resistance: 0`이면 기존 하드 클램프.
  - 수정: 핀치·더블탭 앵커가 `clientX/Y`를 그대로 써서 호스트가 페이지 (0,0)에 있지 않으면 확대 중심이 어긋났다. 제스처 시작 시 호스트 rect를 읽어 로컬 좌표로 계산한다.
  - 수정: 줌 트윈(`zoomTo`·더블탭)이 탭으로 끊기면 줌이 중간값에 남았다. 릴리스가 마지막으로 정한 줌으로 이어간다.

- 2fd8514: ScrollContainer: 줌 상태 pan 개선 — 핀치 줌 후 손을 떼도 카메라가 패널 중심으로 되돌아가지 않고, 줌 상태에서 첫/끝 패널의 가장자리까지 pan할 수 있다.

  - 릴리스 시 위치 유지: 패널 범위 안이면 그 자리, 엣지 저항 구간이면 가장자리로 복귀, 패널 사이 gap이면 진행 방향·속도 기준으로 앞/뒤 패널의 가까운 가장자리로 스냅(`snapThreshold` 그대로 적용, `onIndexChange` 발화).
  - pan 경계가 줌 반폭 `(panelSize / 2) × (1 − 1 / zoom)`만큼 넓어져 줌 상태에서 잘려 있던 가장자리를 볼 수 있다. zoom ≤ 1 동작은 기존과 같다.
  - `zoomTo()`는 새 줌 기준 활성 패널 범위 안으로 카메라를 끌어온다 (줌아웃 시 패널 중심 복귀).
  - 내부 `CameraControl`이 릴리스 트윈을 직접 시작한다 (`onPanRelease`는 상태 갱신 전용). 공개 API 변경 없음.
  - 문서: 세로 스크롤되는 패널에 `touch-action: pan-y`가 필수임을 명시 (없으면 브라우저가 가로 스와이프를 가져가 페이저가 넘어가지 않음).

### Patch Changes

- 1edced3: ScrollContainer: 짧고 빠른 플릭으로 한 칸 넘기기 (Android ViewPager 의 플릭 조건).

  - zoom ≤ 1 에서 손가락이 누른 지점부터 25px 넘게 움직였고 놓는 속도가 0.4px/ms(400dp/s)를 넘으면, 끈 거리와 상관없이 플릭 방향으로 한 칸 넘긴다. 끌던 방향과 반대로 튕기면 제자리 (ViewPager `determineTargetPage` 와 같음).
  - 조건을 넘지 못하면 이전처럼 `snapThreshold` 거리 비율(+ 속도 가중치)로 정한다. 한 제스처에 한 칸은 그대로.
  - 실측(실제 터치, Pixel 7 에뮬레이션, 412px): 30px·0.45px/ms, 40px·0.6px/ms, 60px·0.9px/ms 플릭이 제자리 → 한 칸. 40px·0.24px/ms 는 그대로 제자리. 이전에는 약 130px 를 움직여야 넘어갔다.

## 0.4.0

### Minor Changes

- 7924f51: StableInput: `validateOptions` 도입 — 잘못된 `container`(HTMLElement 아님)·`scrollAnchor`(`'top' | 'bottom' | 'none'` 외 값)는 이제 생성 시점에 `WebviewHeadlessError`를 던진다(기존에는 조용히 통과 — breaking-ish 동작 변경). `destroy()`가 `isFocused` 상태도 초기화한다. ScrollLock의 scrollY 저장/복원 의도(overflow:hidden 전략의 안전망)를 주석으로 명확화.
- 7f9fd91: **BREAKING**: ScrollContainer는 `<pkg>/scroll-container` subpath로 이동 — three 미설치 CJS/ESM 소비자의 배럴 크래시 해소.

  - `createScrollContainer`는 `@guksu/wvkit-core/scroll-container`, `useScrollContainer`는 `@guksu/wvkit-react/scroll-container` · `@guksu/wvkit-vue/scroll-container`에서 import (배럴 `.`에는 타입만 잔존).
  - 배럴(`.`)이 더 이상 three를 정적 로드하지 않으므로 optional peer 설계대로 three 없이 StableInput 등 non-three 컴포넌트 사용 가능.
  - destroy 이후 `scrollTo`/`zoomTo`는 완전 no-op (상태 갱신·`onIndexChange`/`onZoomChange` 발화 누수 차단).

- 9380974: Trust fixes: export `WebviewHeadlessError` as a runtime value from all three barrels (core + react/vue re-export) so consumers can identify library errors via `instanceof`; relax `three` peer range from `^0.184.0` to `>=0.160.0` (floor verified by typecheck/build/test matrix); fix stale `@wvkit/core` external in react/vue tsup configs to `@guksu/wvkit-core`.

### Patch Changes

- ce9601c: fix exports map: split CJS types to .d.cts (attw FalseESM)

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
