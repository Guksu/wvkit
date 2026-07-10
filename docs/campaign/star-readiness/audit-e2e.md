# E2E 테스트 감사 — wvkit

> 감사 범위: `e2e/playwright.config.ts`, `e2e/specs/*`, `e2e/fixtures/*`, `.github/workflows/*`, `test-apps/ios-webview`. Playwright 실행 없이 정적 분석.

## 요약 (5줄)

1. **최대 결함: e2e가 CI에서 전혀 실행되지 않는다.** `ci.yml`은 `pnpm test`(단위)만 돌리고 어떤 워크플로도 `test:e2e`/playwright를 호출하지 않는다 → 리그레션 가드 0.
2. 스펙 자체의 폭은 준수하다(6컴포넌트, 32 test, 매트릭스 대부분 커버). 그러나 **각 컴포넌트의 존재 이유(핵심 값 제안)가 되는 동작이 빠져 있다**: StableInput의 레이아웃 시프트 억제, ScrollContainer의 대각 스크롤 방지, PullToRefresh의 touch→pointer 이중 처리 가드, SafeArea의 방향 전환 재측정.
3. 제스처는 실제 터치 입력이 아니라 `page.evaluate`로 합성 `PointerEvent`를 dispatch — `TouchEvent`는 한 번도 발화되지 않아 PTR의 `activeSource` 이중처리 가드가 구조적으로 검증 불가.
4. `webkit`/`mobile-safari` 프로젝트는 Playwright 번들 WebKit이지 실제 iOS WKWebView가 아니다. 라이브러리 가치의 핵심인 WKWebView 특이 동작(visualViewport·키보드·safe-area)은 자동화로 실기기에서 한 번도 검증되지 않는다. `test-apps/ios-webview`(RN WKWebView 셸)는 존재하나 Detox/Appium/Maestro 연결 없이 `renders correctly` 단위 스냅샷 1개뿐.
5. `test-results/.last-run.json`은 `passed`(마지막 로컬 실행). 보존된 trace/flaky 흔적 없음. 다만 `waitForTimeout(50/400)` 고정 대기 + RAF settle 폴링은 CI 부하 시 flake 소지.

## 커버리지 매트릭스

범례: ✅ 커버 · ⚠️ 부분/우회 · ❌ 없음 · — 해당 없음

| 컴포넌트 | 마운트/스모크 | 핵심 제스처 | 스냅/축제약 | 줌 | 상태전이 | 옵션/리마운트 | destroy/cleanup | 값제안 핵심동작 |
|---|---|---|---|---|---|---|---|---|
| ScrollContainer | ✅ | ✅ 가로/세로 드래그 | ⚠️ 스냅 fwd/back·엣지저항 O, **대각 방지 ❌**, `both` ❌ | ✅ 핀치 in / off, zoomTo API | — | ✅ direction·overscan | ✅ 탭전환·reload 콘솔에러 | ⚠️ 축정렬 스냅·zoom+pan 합성·min/maxZoom 클램프 ❌ |
| StableInput | ✅ 듀얼인풋·readonly·aria | ⚠️ 프로그램적 value setter만 | — | — | — | — | ✅ 탭전환 hidden 제거 | ❌ **suppressLayoutShift·scrollAnchor·onSubmit(Enter)·onBlur** 미검증 |
| useVirtualKeyboard | ✅ 초기값 | — | ⚠️ resize만 발화(scroll 경로 ❌) | — | ✅ open/close/threshold 경계 | — | ❌ unmount 리스너 해제 미검증 | ⚠️ iOS/Android 휴리스틱 분기 동일코드로만 |
| useSafeArea | ✅ 4방향 readout·px포맷 | — | — | — | — | — | — | ❌ **방향전환 재측정·비영(非0) 인셋·동적 갱신** |
| ScrollLock | ✅ 초기 unlocked | — | — | — | ✅ lock/unlock·버튼 disable | — | ✅ 탭전환 자동 unlock | ❌ 스크롤 위치 보존·중첩(ref-count)·scrollbar 보정·iOS touchmove 차단 |
| PullToRefresh | ✅ 컨테이너·readout | ⚠️ pull(under/over/hold) — Pointer만 | ✅ threshold 트리거/미트리거 | — | ✅ idle→refreshing→idle, trigger() | ❌ setEnabled(false) 차단 | ⚠️ 탭 lifecycle 없음 | ❌ **touch→pointer 가드·onRefresh 에러복구·maxDistance cap·resistance 수식·scrollTop>0 거절·overscroll-behavior 적용** |

## 발견 목록

### P0

- [P0] e2e가 어떤 CI 워크플로에서도 실행되지 않음 — 근거(`.github/workflows/ci.yml:35-36`은 `pnpm test`만, `deploy-demo.yml`/`release.yml` 어디에도 playwright 없음; `grep -rin playwright .github/workflows` → 0건). `package.json:18`에 `test:e2e`는 정의돼 있으나 호출자 없음. 결과: 32개 e2e 전부 로컬 수동 실행 의존, PR 리그레션 가드 부재. `config`의 `retries:2`/`forbidOnly`/`github` reporter는 CI 전제인데 사실상 사문화. / 제안: CI에 별도 `e2e` job 추가(`playwright install --with-deps chromium webkit` → `pnpm test:e2e`), PR 필수 체크로 승격, trace/report 아티팩트 업로드. / 규모: M

### P1

- [P1] 각 컴포넌트의 핵심 값 제안 동작이 미검증 — 근거: StableInput 스펙(`stable-input.spec.ts` 전체)은 듀얼인풋 값 동기화·포커스·destroy만 보고 `suppressLayoutShift`(visualViewport resize 중 레이아웃 튀어오름 억제)를 한 번도 트리거하지 않음; SafeArea(`safe-area.spec.ts`)는 CLAUDE의 "방향 전환 시 자동 갱신"을 검증 안 함; ScrollContainer는 "대각 스크롤 방지/축 정렬 스냅"(컴포넌트 존재 이유, CLAUDE §1)을 `swipeOnCanvas(dx,dy 동시)`로 시험하지 않음. / 제안: 값 제안별 "골든 시나리오" 1건씩 추가 — VP resize 하 display 위치 불변 assert, `orientationchange` 후 inset 재측정, 대각 드래그가 단일 축으로만 스냅되는지. / 규모: M

- [P1] 제스처가 합성 PointerEvent만 발화 → touch→pointer 이중처리 가드 검증 불가 — 근거: `fixtures/pull-to-refresh.ts:83-99`·`scroll-container.ts:121-137`이 `page.evaluate`로 `PointerEvent`만 dispatch(`TouchEvent` 없음, `isTrusted=false`). CLAUDE §5는 PTR이 "touch+pointer 양쪽 핸들러 + `activeSource` 가드로 iOS 합성 이중 처리 방지"가 핵심이라 명시하나, TouchEvent가 안 오므로 이 경로가 구조적으로 미실행. / 제안: 최소 1개 스펙에서 `touchstart/move/end` + 뒤따르는 합성 `pointer*`를 함께 발화해 onRefresh가 1회만 발화되는지 검증하거나, Playwright 실터치(`page.touchscreen`/CDP dispatchTouchEvent)로 전환. / 규모: M

- [P1] 실제 iOS WKWebView 자동화 부재 — 근거: `playwright.config.ts:31-33`의 `mobile-safari`는 `devices['iPhone 14 Pro']`(Playwright 번들 WebKit, viewport/UA 에뮬레이션일 뿐 WKWebView 아님). `test-apps/ios-webview`는 RN+react-native-webview 셸이 있으나(`App.tsx:45`) 자동화 하네스 없이 `__tests__/App.test.tsx`의 `renders correctly` 1개뿐이고, 앱은 `:5173`(dev) / playwright는 `:4173`(preview)로 대상도 불일치. visualViewport·소프트키보드·safe-area는 WKWebView 실동작이 브라우저와 달라 값 제안이 실환경에서 미검증. / 제안: Maestro 또는 Detox로 시뮬레이터에서 데모 URL 로드 후 키보드/PTR 스모크 1~2건 자동화, 최소 nightly로. 단기적으로는 README에 "webkit 프로젝트 ≠ WKWebView" 한계 명시. / 규모: L

- [P1] PullToRefresh 계약의 나머지 분기 미커버 — 근거: `pull-to-refresh.*.spec.ts` 어디에도 `setEnabled(false)` 후 당김 무시, `onRefresh` reject 시 `console.error` swallow + idle 복귀(CLAUDE §5), `maxDistance` cap, `scrollTop>0`일 때 tryStart 거절(픽스처가 `scrollTop=0`을 강제만 하고 가드 자체는 미검증), `overscroll-behavior:contain` 자동 적용/opt-out 검증이 없음. / 제안: lifecycle 스펙에 enabled 토글·에러 복구·overscroll 스타일 assert 추가(fixture에 `setEnabled` 헬퍼 이미 존재). / 규모: S

### P2

- [P2] ScrollLock 심화 동작 미커버 — 근거: `scroll-lock.spec.ts`는 `body.style.overflow` 토글만 검증. 스크롤 위치 보존/복원, 중첩 lock ref-count, scrollbar-width 보정, iOS `touchmove` 차단은 없음. / 제안: 스크롤 후 lock→unlock 시 scrollTop 복원 assert 1건 + 중첩 lock 1건. / 규모: S

- [P2] 고정 시간 대기로 인한 flake 소지 — 근거: `pull-to-refresh.gesture.spec.ts:18` `waitForTimeout(50)`, `scroll-container.gesture.spec.ts:87` `waitForTimeout(400)` 등 절대 대기가 상태 폴링 대신 사용됨. CI(`retries:2`) 부하에서 비결정적. / 제안: `expect.poll`/`waitForFunction`으로 대체(이미 다른 스펙에서 쓰는 패턴). / 규모: S

- [P2] 픽스처의 위치 의존 셀렉터가 취약 — 근거: `select` first(`scroll-container.gesture.spec.ts:47`), `input[type="checkbox"]` first(`:81`, `pull-to-refresh.ts:160` — 주석 스스로 "fragile/순서 의존" 인정), CSS3D `:scope > div > div > div` 깊은 체인(`scroll-container.ts:33,76`). 데모 DOM/컨트롤 순서 변경 시 조용히 오탐. / 제안: 데모에 `data-testid`(예: `ctl-direction`, `ctl-enablePinch`) 부여 후 픽스처 전환. `demo` 감사 에이전트와 협의. / 규모: S

- [P2] VirtualKeyboard `scroll` 경로 및 리스너 해제 미검증 — 근거: `virtual-keyboard.spec.ts`는 `resize`만 dispatch, CLAUDE가 언급한 `visualViewport.scroll` 조합 경로와 iOS/Android 휴리스틱 분기가 동일 코드로만 실행됨. 언마운트 후 리스너 해제(destroy) 스펙 없음. / 제안: scroll 이벤트 케이스 1건 + 탭 이탈 후 resize 발화해도 무반응(리스너 해제) 1건. / 규모: S

- [P2] `both` direction·zoom+pan 합성 미커버 — 근거: CLAUDE §1은 `both`가 1차 horizontal 폴백이라 명시하나 이 폴백 동작(both 선택 시 가로처럼 동작)을 검증하는 스펙 없음. 핀치 줌 후 pan 합성(줌 상태에서 드래그)도 없음. / 제안: `both` 폴백 assert 1건, 줌 2.0 상태에서 pan이 콘텐츠를 이동시키는지 1건. / 규모: S
