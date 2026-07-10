# Sprint 5 — 터치 계약 (touch-contracts)

> 대상 백로그: **B-08**(PTR TouchEvent 경로 + `activeSource` 소스 승계 단위 테스트) · **B-10**(e2e 골든 시나리오 4종)
> 근거: `audit-unit-tests.md` P1 1번째(B-08) · `audit-e2e.md` P1 1·2번째(B-10)
> 작성일: 2026-07-10 · 규모: M + M · 브랜치: `chore/quality-sprint-1`

## 목표

iOS 실환경의 입력 계약(TouchEvent + touch→pointer 합성)을 테스트로 고정한다. 이 스프린트가 끝나면:

1. `pull-to-refresh.ts:216-273`(onTouchStart/Move/End 전체)과 소스 승계(`activeSource==='pointer' && activePointerIsTouch → 'touch'`, 224-231), `touchmove` `preventDefault`(251)가 **단위 레벨에서 값으로 단언**된다. 현재 이 방어는 e2e에만 의존하는데, 그 e2e조차 PointerEvent만 발화해(audit-e2e P1 2번째) 사실상 무검증 상태다.
2. 각 컴포넌트의 "존재 이유" 동작 4건이 e2e 골든 시나리오(`@golden` 태그)로 고정된다: 대각 스크롤 방지(ScrollContainer), VP resize 중 위치 불변(StableInput suppressLayoutShift), orientation 후 inset 재측정(SafeArea), touch+합성 pointer 이중처리 1회 발화(PullToRefresh).
3. `pull-to-refresh.ts` 커버리지 threshold를 신규 실측에 맞춰 상향해 이번 이득이 회귀로 사라지면 CI가 빨간불이 된다.

**라이브러리 소스 코드 변경 없음.** 변경 대상은 테스트 + e2e 픽스처 + 데모 계측(readout 1개) + vitest.config뿐이다. 테스트 작성 중 실제 버그가 드러나면 임의 수정하지 말고 리더에게 보고한다.

---

## 태스크

### T-01 (B-08) — PTR TouchEvent 경로 + 소스 승계 단위 테스트

**대상 코드(변경 없음):** `packages/core/src/components/pull-to-refresh/pull-to-refresh.ts`
- `onTouchStart` 216-231 (단일 터치 가드, 소스 승계, tryStart)
- `onTouchMove` 233-257 (identifier 매칭, `preventDefault`, 음수 delta 0 고정)
- `onTouchEnd` 259-273 (changedTouches identifier 매칭 → handleRelease; touchcancel도 동일 핸들러)
- `onPointerDown` 276-288 (`activePointerIsTouch = pev.pointerType === 'touch'`)

**테스트 파일(신규):** `packages/core/src/components/pull-to-refresh/__tests__/pull-to-refresh.touch.test.ts`
(기존 `pull-to-refresh.integration.test.ts`의 `makeRoot`/`pointerEvent`/`wait` 패턴 복제. 별도 파일로 분리 — 기존 파일 헤더가 "PointerEvent로 시뮬"을 명시하므로 섞지 않는다.)

**테스트 인프라 결정 (구현 힌트):**
- happy-dom v15는 `TouchEvent` 생성자를 부분 지원 → **`new Event(type, { bubbles: true, cancelable: true })` + `Object.defineProperty`로 `touches`/`changedTouches` 주입** (StableInput 테스트가 쓰는 기존 패턴). TouchList 유사 객체는 소스가 쓰는 표면만 구현하면 됨: `{ length, item(i) }` + touch 유사 객체 `{ identifier, clientX, clientY }`.
- `preventDefault` 단언은 dispatch 후 `ev.defaultPrevented`로 확인 (`cancelable: true` 필수).
- 감쇠 기대값은 `applyResistance` 수식에서 도출: `damped = raw / (1 + 0.5·raw/120)` (기본 threshold 60 / maxDistance 120 / resistance 0.5). raw 40 → **240/7 ≈ 34.29**, raw 100 → **1200/17 ≈ 70.59 (≥60 → armed)**.
- reset 트윈 flush는 기존 패턴대로 `await wait(300)`.
- 헬퍼 시그니처 제안: `touchEvent(type: string, touches: Array<{id: number; y: number}>, changed?: Array<{id: number; y: number}>): Event`.

**완료 기준 — 아래 11개 `it` 케이스가 추가되고 통과 (타이틀에 `touch —` 접두 고정, qa grep용):**

**그룹 U-A — 순수 touch 경로 (216-273 라인 커버):**
| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| U1 | touchstart 단독 시작 + 감쇠값 | touchstart(id 1, y 100) → touchmove(id 1, y 140) | `getState()==='pulling'`, `onPull` 마지막 distance `toBeCloseTo(240/7, 2)` |
| U2 | armed → touchend → refresh 1회 → idle | touchstart(y 100) → touchmove(y 200, damped≈70.59) → touchend(changed id 1) → `wait(300)` | 상태열 `pulling→armed→refreshing→resetting→idle`(onStateChange), `onRefresh` **정확히 1회**, 최종 `idle` |
| U3 | 양수 delta에서 preventDefault | U1 시퀀스의 touchmove 이벤트 | `ev.defaultPrevented === true` |
| U4 | 음수 delta → distance 0 + native scroll 비차단 | touchstart(y 100) → touchmove(y 80) | `onPull` 마지막 distance `0`, `ev.defaultPrevented === false` |
| U5 | 멀티터치 시작 거부 | touchstart(touches 2개: id 1·2) | `getState()==='idle'`, `onStateChange` 미호출 |
| U6 | identifier 불일치 touchmove 무시 | touchstart(id 1, y 100) → touchmove(**id 9**, y 200) | `onPull` 미호출(또는 distance 불변), 상태 `pulling` 유지 |
| U7 | changedTouches 불일치 touchend 무시 | touchstart(id 1) → touchmove(armed) → touchend(changed **id 9**) | `onRefresh` 미호출, 상태 `armed` 유지 |
| U8 | touchcancel = release 경로 | touchstart(id 1, y 100) → touchmove(y 140, sub-threshold) → touchcancel(changed id 1) → `wait(300)` | `onRefresh` 미호출, `resetting` 경유 후 `idle` |

**그룹 U-B — 소스 승계 / 이중처리 방어 (224-231 + 276-288):**
| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| U9 | pointer(touch합성) → touch 승계 | pointerdown(**pointerType 'touch'**, pointerId 1, y 100) → touchstart(id 1, y 100) → pointermove(pointerId 1, y 300) → touchmove(id 1, y 200) | pointermove는 무시(직후 `onPull` 미호출), touchmove가 distance 구동: 마지막 distance `toBeCloseTo(1200/17, 2)` (startClientY 100 승계 증명) + 해당 touchmove `defaultPrevented === true` |
| U10 | 승계 후 touchend 1회 발화 + 후행 pointerup no-op | U9 이어서 touchend(changed id 1) → pointerup(pointerId 1) → `wait(300)` | `onRefresh` **총 1회**, pointerup이 새 상태 전이를 만들지 않음(최종 `idle`, `onStateChange`에 idle 이후 추가 호출 없음) |
| U11 | 비합성 pointer(mouse)는 승계 없음 | pointerdown(**pointerType 'mouse'**, pointerId 1, y 100) → touchstart(id 5, y 100) → touchmove(id 5, y 200) → pointermove(pointerId 1, y 140) | touchmove 무시(`defaultPrevented === false`, distance 불변), pointermove가 distance 구동(`toBeCloseTo(240/7, 2)`) |

### T-02 (B-08) — pull-to-refresh.ts 커버리지 threshold 상향

**대상 파일:** `packages/core/vitest.config.ts:19` — 현재 `'**/pull-to-refresh.ts': { branches: 80, functions: 85 }`.

**절차 (Sprint 1·2와 동일한 램프 규칙):** T-01 머지 후 `pnpm --filter @guksu/wvkit-core exec vitest run --coverage`로 실측 → **실측값 −2%p(내림)** 로 상향. 예상: 216-273 전체 커버로 branches 90 이상, functions 96 이상 실측 — 최소 `branches ≥ 90, functions ≥ 95`를 하회하면 T-01 누락 케이스가 있는 것이므로 재점검.

**완료 기준:** vitest.config diff에 pull-to-refresh 라인 상향이 존재하고 커버리지 실행이 exit 0. 다른 파일(camera-control/stable-input) threshold는 건드리지 않는다.

### T-03 (B-10) — e2e 골든 시나리오 G1(대각 방지) + G2(suppressLayoutShift)

**G1 — 대각 스크롤 방지 (ScrollContainer):**
- **픽스처 추가:** `e2e/fixtures/scroll-container.ts`에 `getSceneYShift(page): Promise<number | null>` — 기존 `getSceneXShift`(55-72)의 Y 대칭: `parseMatrix3dTranslation(...).y` + `translate(x, y)` 매치의 2번째 그룹 합산.
- **스펙:** `e2e/specs/scroll-container.gesture.spec.ts`에 test 추가, 타이틀에 **`@golden`** 포함.
- **시나리오:** `gotoDemo` (direction 기본 horizontal) → `y0 = getSceneYShift()`, `x0 = getSceneXShift()` 기록 → `swipeOnCanvas(page, -160, -120)` (**dy 동반 대각 드래그**) → `waitForScrollSettle(page, 1)` → 단언: `getActiveIndex() === 1`, `getSceneXShift()`가 x0에서 패널 폭만큼 이동, **`getSceneYShift()`가 y0과 동일(±0.5px)** — Y축 오염 없음.

**G2 — suppressLayoutShift: VP resize 중 display 위치 불변 (StableInput):**
- **픽스처 추가:** `e2e/fixtures/stable-input.ts`에 `installVisualViewportStub(page)` — **`page.addInitScript`** 로 페이지 스크립트 실행 전에 `window.visualViewport`를 EventTarget 기반 fake로 교체(`stable-input.ts:126`이 create 시점에 `window.visualViewport`를 capture하므로 반드시 init script여야 함). fake: `{ width, height, offsetTop: 0, addEventListener, removeEventListener, dispatchEvent }`, 초기 height = `window.innerHeight`, 제어용 전역 `window.__vvStub.setHeight(h)` (height 갱신 + `resize` dispatch).
- **스펙:** `e2e/specs/stable-input.spec.ts`에 test 추가, 타이틀에 **`@golden`** 포함.
- **시나리오:** stub 설치 → `gotoStableInputTab` → `rect0 = display input boundingClientRect`, `scrollY0 = window.scrollY` 기록 → `stable-input-focus` 버튼으로 포커스(`dataset.focused === 'true'` 폴링) → `__vvStub.setHeight(innerHeight − 320)` (키보드 등장 시뮬) → 단언: display input `boundingClientRect().top === rect0.top` (±0.5px), `window.scrollY === scrollY0` (데모 인풋은 뷰포트 상단이라 overflow 0 → 보정 스크롤 없어야 함), 포커스 상태 유지(`data-focused` 잔존), display value 불변.

### T-04 (B-10) — e2e 골든 시나리오 G3(orientation inset 재측정) + G4(touch 이중처리 1회 발화)

**G3 — orientation 후 inset 재측정 (SafeArea):**
- **스텁:** `e2e/specs/safe-area.spec.ts` 내 `page.addInitScript` — `window.getComputedStyle`을 래핑: 대상 element의 인라인 `style.paddingTop`이 `env(safe-area-inset-top`을 포함하면(= `safe-area.ts:12-26` sentinel 식별) padding 4방향을 전역 `window.__fakeInsets`(기본 `{top:'0px',right:'0px',bottom:'0px',left:'0px'}`)에서 읽어 반환, 그 외 passthrough.
- **스펙:** `safe-area.spec.ts`에 test 추가, 타이틀에 **`@golden`** 포함.
- **시나리오:** stub 설치 → `gotoSafeAreaTab` → `row-top-value === '0px'` 확인 → `page.evaluate`로 `window.__fakeInsets = { top: '47px', right: '0px', bottom: '34px', left: '0px' }` 설정 + `window.dispatchEvent(new Event('orientationchange'))` → `expect.poll`: `row-top-value === '47px'` **그리고** `row-bottom-value === '34px'`. (근거 체인: `safe-area.ts:53` orientationchange 리스너 → `readInsets` 재실행 → react `use-safe-area.ts:11` `onChange: setInsets` → 데모 `DataRow` readout. 고정 대기 금지 — audit-e2e P2 flake 지적.)

**G4 — touch + 합성 pointer 이중처리 1회 발화 (PullToRefresh):**
- **데모 계측:** `examples/react-example/src/PullToRefreshDemo.tsx` — `refreshCount` state 추가, `onRefresh` 콜백에서 증가, `<DataRow label="refresh-count" value={refreshCount} />` 렌더 → testid `row-refresh-count-value` 자동 생성(`ui.tsx:35-37`). 스타일·레이아웃 변경 없음.
- **픽스처 추가:** `e2e/fixtures/pull-to-refresh.ts`에 `pullWithTouchAndSyntheticPointer(page, dy)` — `page.evaluate`로 **실 iOS 발화 순서** 재현(소스 주석 216-231 근거: pointer가 touch보다 먼저): `pointerdown(pointerType:'touch')` → `touchstart` → 스텝마다 `[touchmove, pointermove]` 쌍 → `touchend` → `pointerup`. TouchEvent는 `new Touch({ identifier, target: el, clientX, clientY })` + `new TouchEvent(type, { touches, changedTouches, bubbles: true, cancelable: true })` 사용 (Chromium·WebKit 페이지 컨텍스트 모두 지원 — `typeof Touch === 'undefined'`면 `test.skip`으로 방어). 헬퍼 추가: `getRefreshCount(page)` (`row-refresh-count-value` 파싱).
- **스펙(신규):** `e2e/specs/pull-to-refresh.touch.spec.ts`, 타이틀에 **`@golden`** 포함.
- **시나리오:** `gotoPtrTab` → `getRefreshCount() === 0` → `pullWithTouchAndSyntheticPointer(page, 150)` → `waitForState(page, 'idle')` → 단언: **`getRefreshCount() === 1` (정확히 1 — `activeSource` 가드 회귀 시 touch·pointer가 각각 release해 2가 되어 실패)**, 리스트에 "Refreshed" 항목 1건.

---

## 인수조건 (기계 검증 — 명령 + 기대 exit code)

> 인수조건 = 테스트 케이스 (TDD). AC-01~11은 T-01의 U1~U11과 1:1.

**단위 (B-08) — 검증 명령:**
```bash
pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/components/pull-to-refresh
# 기대: exit 0
```
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-01~08 | U1~U8 (순수 touch 경로 8건) 통과 | 위 명령 exit 0 + verbose 출력에 `touch —` 접두 `it` 타이틀 8건 존재 (`grep -c "touch —"` 결과에 포함) |
| AC-09~11 | U9~U11 (소스 승계·이중처리 3건) 통과 | 동일 명령 exit 0 + 해당 타이틀 3건 존재 — verbose 출력 전체에서 `grep -c "touch —"` ≥ 11 |

**커버리지 게이트 (T-02):**
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-12 | pull-to-refresh.ts threshold 상향 후 커버리지 통과 | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` → exit 0, `git diff packages/core/vitest.config.ts`에 `pull-to-refresh.ts` 라인 변경 존재(branches > 80, functions > 85) |

**e2e (B-10) — 검증 명령:**
```bash
pnpm test:e2e --grep "@golden"
# 기대: exit 0 (4개 프로젝트 × 4시나리오; Touch 미지원 환경의 G4는 skip 허용)
pnpm test:e2e --grep "@golden" --list
# 기대: exit 0, 시나리오 타이틀 4종(G1~G4) 모두 나열
```
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-13 | G1: 대각 스와이프(-160,-120) 후 index 1 스냅 + scene Y-shift 불변(±0.5px) | `pnpm test:e2e --grep "@golden.*diagonal\|diagonal.*@golden"` exit 0 (권장 타이틀에 `diagonal` 포함) |
| AC-14 | G2: VP height −320 dispatch 후 display input top·scrollY·포커스 불변 | `pnpm test:e2e --grep "@golden"` 내 stable-input 스펙 pass |
| AC-15 | G3: `__fakeInsets` 변경 + orientationchange → readout '47px'/'34px' 갱신 | 동일 실행 내 safe-area 스펙 pass |
| AC-16 | G4: touch+합성 pointer 풀 시퀀스 후 `row-refresh-count-value` **정확히 1** | 동일 실행 내 `pull-to-refresh.touch.spec.ts` pass |

**전체 회귀 게이트:**
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-17 | 단위 전체 그린 (threshold 포함) | `pnpm test` → exit 0 |
| AC-18 | e2e 전체 그린 (기존 32건 + 신규) | `pnpm test:e2e` → exit 0 |

---

## 경계면 매핑 (생산자 ↔ 소비자 — qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 이번 스프린트의 계약 |
|---|---|---|---|
| PTR 입력 소스 | `pull-to-refresh.ts` touch/pointer 핸들러 (216-309) | T-01 단위 테스트 · G4 e2e 픽스처 | touch 우선 + 합성 pointer 무시 → `onRefresh` 1회. 단위(happy-dom 주입 이벤트)와 e2e(실 브라우저 TouchEvent)가 같은 계약을 양쪽에서 고정 |
| PTR → 데모 readout | react `use-pull-to-refresh` → `PullToRefreshDemo.tsx` `onRefresh`/`refreshCount` | `e2e/fixtures/pull-to-refresh.ts` `getRefreshCount` | `row-refresh-count-value` testid (T-04에서 신설 — 데모 변경은 이 readout 1개뿐) |
| StableInput ↔ visualViewport | `stable-input.ts:126-144` (create 시점 capture) | G2 `installVisualViewportStub` (**addInitScript 필수**) | resize 시 anchor 'bottom' overflow 0이면 무스크롤 = display 위치 불변 |
| SafeArea sentinel ↔ react state | `safe-area.ts:28-36` `readInsets` + `:53` orientationchange | react `use-safe-area.ts:11` `onChange: setInsets` → 데모 `DataRow` | orientationchange 1회 → readout 재측정 (getComputedStyle 스텁으로 값 주입) |
| ScrollContainer scene transform | CSS3DRenderer `matrix3d` (카메라 역행렬) | `e2e/fixtures/scroll-container.ts` `getSceneXShift`/**`getSceneYShift`(신규)** | horizontal 모드에서 대각 입력의 Y 성분이 transform에 누출되지 않음 |

## 범위 제외

- **PTR e2e 잔여 계약** (setEnabled(false)·onRefresh reject 복구·maxDistance cap·scrollTop>0 거절·overscroll-behavior) — **B-18** 별도.
- **어댑터 StrictMode/rerender 테스트** — **B-09** 별도.
- pull-to-refresh.ts 299-300·330-332(pointer 경로 잔여 라인) 커버 자체가 목적이 아님 — T-02 threshold가 실측 기준이므로 무리한 케이스 추가 금지.
- WKWebView 실기기 자동화(**B-19**), 기존 스펙의 `waitForTimeout` 정리(**B-23**) — 단, 이번 신규 스펙에는 고정 대기 금지(`expect.poll`/`waitForFunction`만).
- `both` direction·줌 상태 pan(**B-24**), 데모 스타일·i18n 변경.
- 라이브러리 소스(`packages/*/src`) 동작 변경 — 테스트 중 버그 발견 시 리더 보고 후 별도 백로그.
