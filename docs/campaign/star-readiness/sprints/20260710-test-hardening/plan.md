# Sprint 10 — test-hardening (B-22 + B-23 + B-24)

| 항목 | 내용 |
|------|------|
| 슬러그 | 20260710-test-hardening |
| 백로그 | B-22(M) 껍데기 단언 정리 · B-23(S) e2e 안정화 · B-24(S) e2e 잔여 커버 |
| 근거 | audit-unit-tests.md P2 ×2 (43행 껍데기 단언, 45행 SafeArea 스텁) · audit-e2e.md P2 ×5 (46행 고정 대기, 48행 위치 의존 셀렉터, 44행 ScrollLock, 50행 VirtualKeyboard, 52행 both·zoom+pan) |
| 작성 | planner (2026-07-11) |

## 목표

테스트가 "통과한다"가 아니라 "동작을 보증한다"로 격상한다.

1. **B-22**: `not.toThrow()`만 있는 껍데기 테스트 전수에 관측 가능한 부수효과 단언을 최소 1개씩 추가하고, happy-dom 한계로 무의미하게 통과 중인 SafeArea 인셋 파싱을 스텁으로 실검증한다.
2. **B-23**: e2e의 비결정 요소 2종 제거 — 고정 대기(`waitForTimeout`) 3건을 상태 폴링으로, 위치 의존 셀렉터(`select.first()` 등)를 `data-testid`로 교체한다.
3. **B-24**: e2e 커버리지 매트릭스의 P2 공백 6건을 채운다 — ScrollLock(위치 복원·중첩), VirtualKeyboard(scroll 경로·리스너 해제), ScrollContainer(`both` 폴백·줌 상태 pan).

**전제 조사 결과 (2026-07-11 기준 코드 상태)**

- `grep -rn "not.toThrow"` 41건 중 상당수는 B-09/B-13에서 이미 부수효과 단언이 동반됨(예: `scroll-container.test.ts` TC-B13-1~3, `vue/use-scroll-container.test.ts:116` 블록). **잔여 껍데기만** 대상으로 한다 — 아래 T1/T2에 전수 목록.
- PTR 픽스처(`e2e/fixtures/pull-to-refresh.ts:276`)는 B-23이 이미 선반영됨(testid 기반). 잔여는 scroll-container 계열 3곳.
- ScrollLock 코어는 ref-count가 아니라 **prev-값 복원 방식**(`scroll-lock.ts:39-40, 56-57`)으로 중첩을 지원한다. e2e는 이 의미론(마지막 unlock에서만 완전 복원)을 그대로 고정한다.
- 데모 확장 필요 2곳: `ScrollLockDemo.tsx`(스크롤 스페이서 + 2번째 lock 인스턴스), `ScrollContainerDemo.tsx`(컨트롤 testid). 라이브러리 코드(packages/*) 동작 변경은 **없음** — 이 스프린트는 테스트·데모만 수정한다.

---

## 태스크

### T1 — [B-22] core 껍데기 단언 강화 (규모 M의 2/3)

각 항목: 기존 테스트를 **삭제하지 않고** 해당 `not.toThrow()` 옆에 부수효과 단언을 추가한다(커버리지 threshold 하락 방지 — camera-control 55/90, ptr 80/85, stable-input 85/75).

| # | 파일 (packages/core/src/components/...) | 현재 껍데기 | 추가할 단언 |
|---|---|---|---|
| 1 | `scroll-container/__tests__/scroll-container.test.ts:105-107` (SSR) | scrollTo(5)/zoomTo(2) no-throw | 호출 후 `getActiveIndex()===0`, `getZoom()===1` (noop 인스턴스 상태 불변) |
| 2 | `scroll-container/__tests__/scroll-container.test.ts:551-557` ('both' 폴백) | scrollTo(1) no-throw | `onIndexChange` 스파이 주입 → scrollTo(1) 후 `getActiveIndex()===1` + `onIndexChange` (1)로 호출 — horizontal 폴백이 실제로 horizontal처럼 동작함을 고정 |
| 3 | `scroll-container/__tests__/scroll-container.test.ts:360-367` (destroy 멱등) | 2차 destroy no-throw | 2차 destroy 후 모든 panel `style.display === ''` 유지(1차 destroy가 복원한 상태 재변형 없음) |
| 4 | `pull-to-refresh/__tests__/pull-to-refresh.test.ts:345-350` (destroy 멱등) | 2차 destroy no-throw | `onStateChange` 스파이 → 2차 destroy 후에도 미호출 + `getState()==='idle'` |
| 5 | `pull-to-refresh/__tests__/pull-to-refresh.test.ts:387-388` (setEnabled no-throw) | 토글 no-throw | `onPull` 스파이 → setEnabled(false) 후 pointerdown/move 시퀀스에 `onPull` 미호출, setEnabled(true) 후 동일 시퀀스에 호출됨 (기존 동등 테스트가 이미 있으면 그 테스트로 병합하고 껍데기 문구만 제거) |
| 6 | `pull-to-refresh/__tests__/pull-to-refresh.test.ts:109-110` (SSR) | setEnabled/destroy no-throw | 호출 후 `getState()==='idle'` 유지 (trigger 단언은 기존에 있음) |
| 7 | `scroll-container/__tests__/camera-control.test.ts:260` (tween 없이 cancelAnimation) | no-throw | 호출 전후 `camera.position.x/y` 불변 |
| 8 | `scroll-container/__tests__/camera-control.test.ts:281` (destroy 멱등) | 2차 destroy no-throw | 2차 destroy 후 `camera.position` 불변 + `root.removeEventListener` 스파이의 추가 호출 없음 |
| 9 | `scroll-container/__tests__/camera-control.tween.test.ts:239` (destroy 중 tween) | no-throw | destroy 후 RAF 큐 flush 시 `onChange` 미호출(트윈 정지) |
| 10 | `scroll-container/__tests__/matrix-utils.test.ts:75` | `applyResistance(5,10,0,0.2)` no-throw | 반환값을 실제 기대값으로 단언 (`Number.isFinite` + 수식 결과값. 구현 수식 기준 정확값 계산해 고정) |
| 11 | `scroll-container/__tests__/scroll-container.integration.test.ts:243-251` (핀치) | 핀치 시퀀스 no-throw | `onZoomChange` 스파이 호출 or `getZoom() > 1` 단언 (B-05가 camera-control 단위에서 값 검증했으므로 여기서는 통합 경로 발화 여부만) |
| 12 | `scroll-container/__tests__/scroll-container.integration.test.ts:283` (destroy) | no-throw | destroy 후 root 하위에 renderer DOM 잔존 없음(`root.children.length===0` 또는 동등) |
| 13 | `scroll-container/__tests__/scroll-container.resize.test.ts:202` (destroy 후 ro.trigger) | no-throw | trigger 후 `onIndexChange`/카메라 위치 불변 (해제된 관찰자가 아무 부수효과도 못 냄) |
| 14 | SSR destroy 3건: `scroll-lock.test.ts:199-201`, `virtual-keyboard.test.ts:206`, `safe-area.test.ts:68`, `stable-input.test.ts:418-422(S8)·431-434(SSR)` | lock/focus/destroy no-throw | scroll-lock: SSR `lock()` 후 `isLocked===false` + `document.body.style.overflow` 불변 · virtual-keyboard/safe-area: destroy 후 getter 값 유지(`isOpen===false`, `getInsets()` 동일 객체값) · stable-input S8: `focus()` 후 hidden input이 `document.activeElement` (visualViewport 부재에서도 포커스 계약 유지) |

### T2 — [B-22] 어댑터 잔여 껍데기 강화 (규모 M의 1/3)

B-09(Sprint 6)가 강화 테스트를 **별도 블록으로 추가**했으나 레거시 스모크는 껍데기로 남음. 대상 6곳:

| # | 파일 | 추가할 단언 |
|---|---|---|
| 1 | `packages/react/src/components/pull-to-refresh/__tests__/use-pull-to-refresh.test.tsx:47` | unmount 후 컨테이너에 pointerdown 디스패치 → `state` 미변화 (또는 B-09 블록의 removeEventListener 패턴 재사용) |
| 2 | `packages/react/src/components/stable-input/__tests__/use-stable-input.test.tsx:24` | render 후 hidden input이 DOM에 존재 + display input `readOnly===true` 단언 |
| 3 | `packages/vue/src/components/safe-area/__tests__/use-safe-area.test.ts:38` | unmount 후 sentinel이 `document.body`에서 제거됨(`document.body.children.length` 감소) |
| 4 | `packages/vue/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts:46` | threshold 옵션 마운트 후 `isOpen.value===false` 초기값 단언 |
| 5 | `packages/vue/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts:51` | unmount 후 `visualViewport`(또는 window) resize 디스패치 → `isOpen.value` 불변 |
| 6 | `packages/vue/src/components/scroll-container/__tests__/use-scroll-container.test.ts:86` | unmount 후 컨테이너 엘리먼트에 renderer DOM 잔존 없음 |

### T3 — [B-22] SafeArea 인셋 파싱 스텁 실검증 (audit-unit 45행)

파일: `packages/core/src/components/safe-area/__tests__/safe-area.test.ts` (추가), 대상 구현: `safe-area.ts:28-36` `readInsets`.

happy-dom은 `env()`를 0으로 계산하므로 `getComputedStyle`을 `vi.spyOn(window, 'getComputedStyle')`로 스텁하고 **sentinel 엘리먼트에 대해서만** 주입값을 반환하게 한다(다른 호출은 원본 위임).

- TC-22-20: 스텁이 `paddingTop:'44px'`, `paddingBottom:'34px'`, 나머지 `'0px'` 반환 → `getInsets()`가 `{ top: 44, right: 0, bottom: 34, left: 0 }` — **파싱·방향 매핑**을 값으로 단언.
- TC-22-21: 스텁이 파싱 불가 문자열(`''`)을 반환 → 각 인셋 `0` 폴백 (`|| 0` 분기).
- TC-22-22: 스텁 값을 44→20으로 바꾼 뒤 `orientationchange` 디스패치 → `onChange`가 `{ top: 20, ... }`로 호출 (동적 갱신이 재파싱을 거침).

### T4 — [B-23] e2e 고정 대기 제거 (audit-e2e 46행)

| # | 위치 | 교체 방법 |
|---|---|---|
| 1 | `e2e/specs/scroll-container.gesture.spec.ts:112` (`waitForTimeout(400)`) | `e2e/fixtures/scroll-container.ts`의 `waitForScrollSettle` 후반부(transform 3프레임 연속 동일)를 `waitForSceneStable(page)` 헬퍼로 추출·export → 핀치 후 `waitForSceneStable` + `getActiveZoom()===1` 단언. `waitForScrollSettle`은 내부에서 이 헬퍼를 재사용하도록 리팩토링 |
| 2 | `e2e/specs/pull-to-refresh.gesture.spec.ts:18` (`waitForTimeout(50)`) | `expect.poll(getState)` 로 `refreshing` 미진입을 검증: release 직후부터 `waitForState(page,'idle',2000)`까지 poll 콜백 안에서 관측된 state가 `refreshing`이면 즉시 fail (관측 배열 수집 후 `expect(observed).not.toContain('refreshing')`) |
| 3 | `e2e/specs/scroll-container.lifecycle.spec.ts:104` (`waitForTimeout(150)`) | `page.getByTestId('ptr-container').waitFor()` (PTR 탭 마운트 완료 신호) |

### T5 — [B-23] 위치 의존 셀렉터 → data-testid (audit-e2e 48행)

**데모 수정** (`examples/react-example/src/ScrollContainerDemo.tsx`):

- direction `<select>` (146행)에 `data-testid="ctl-direction"`
- enablePinchZoom `<input type="checkbox">` (174행)에 `data-testid="ctl-enable-pinch-zoom"`

**스펙 교체**:

- `scroll-container.gesture.spec.ts:72` `page.locator('select').first()` → `page.getByTestId('ctl-direction')`
- `scroll-container.gesture.spec.ts:106` `page.locator('input[type="checkbox"]').first()` → `page.getByTestId('ctl-enable-pinch-zoom')`
- `scroll-container.lifecycle.spec.ts:103, 107-110` role/텍스트 정규식 탭 셀렉터 → 기존 `tab-pull-to-refresh` / `tab-scroll-container` testid (`main.tsx:71`의 `tab-${id}` 이미 존재 — id 값은 main.tsx에서 확인)

CSS3DRenderer 내부 래퍼 체인(`fixtures/scroll-container.ts:33,91,265`의 `:scope > div > div > div`)은 렌더러가 생성하는 DOM이라 testid 부여 불가 — **범위 제외**(픽스처 주석에 구조 의존임을 명시하는 것까지만).

### T6 — [B-24] ScrollLock e2e: 위치 복원·중첩 (audit-e2e 44행)

**데모 확장** (`examples/react-example/src/ScrollLockDemo.tsx`):

- 카드 하단에 세로 스페이서 `<div data-testid="scroll-spacer" style={{height:1600}} />` — body를 실제 스크롤 가능하게
- 2번째 `useScrollLock()` 인스턴스 + 버튼 `data-testid="lock2-btn"` / `"unlock2-btn"` / 상태 `"lock2-status"`(`data-locked` 속성 동일 패턴)

**스펙 추가** (`e2e/specs/scroll-lock.spec.ts`):

- TC-24-01 위치 복원: `window.scrollTo(0,500)` → `lock-btn` 클릭 → `page.evaluate(() => window.scrollTo(0,0))`(잠금 중 프로그램적 이동) → `unlock-btn` 클릭 → `expect.poll(() => window.scrollY)` = 500 (`scroll-lock.ts:60`의 `window.scrollTo(0, scrollY)` 복원 계약)
- TC-24-02 중첩: `lock-btn` → `lock2-btn` → `unlock2-btn` 후 body `overflow==='hidden'` **유지**(2번째 인스턴스는 자신이 저장한 prev='hidden'을 복원) → `unlock-btn` 후 `overflow===''` 완전 복원. 잠금 순서와 해제 역순의 prev-복원 의미론을 e2e로 고정

### T7 — [B-24] VirtualKeyboard e2e: scroll 경로·리스너 해제 (audit-e2e 50행)

파일: `e2e/specs/virtual-keyboard.spec.ts` (mobile-only describe에 추가). 대상 구현: `virtual-keyboard.ts:56-61` (visualViewport에 resize **와 scroll** 양쪽 리스너), `63-66` (destroy).

- TC-24-03 scroll 경로: 기존 패턴대로 `visualViewport.height` getter를 -300 override 하되 `dispatchEvent(new Event('scroll'))`만 발화 → `row-isOpen-value`가 `true` (resize 없이 scroll 이벤트만으로 갱신)
- TC-24-04 리스너 해제: `page.addInitScript`로 `VisualViewport.prototype.addEventListener/removeEventListener`를 래핑해 `window.__vvCount = {add:{}, remove:{}}`에 타입별 카운트 → VK 탭 진입(마운트) 후 다른 탭으로 이탈(언마운트) → `expect.poll`로 `resize`·`scroll` 각각 `remove >= add - (다른 컴포넌트 몫)` 대신 **탭 진입 직전 스냅샷과의 델타**로 add 델타 === remove 델타 단언 (StableInput 등 다른 visualViewport 소비자와의 간섭을 델타 비교로 차단)

### T8 — [B-24] ScrollContainer e2e: both 폴백·줌 상태 pan (audit-e2e 52행)

파일: `e2e/specs/scroll-container.gesture.spec.ts` (T5의 `ctl-direction` testid 선행 필요). 픽스처 헬퍼 재사용: `swipeOnCanvas` / `getSceneXShift` / `getSceneYShift` / `clickZoomTo` / `waitForScrollSettle`.

- TC-24-05 `both` 폴백: `ctl-direction`을 `both`로 선택(리마운트) → 가로 스와이프(-260,0) → `activeIndex===1` (horizontal 폴백 동작) / 이어서 세로 스와이프(0,-260) → `activeIndex` 유지 + scene Y-shift 변화 `<= 0.5` (CLAUDE §1 "1차 구현에서는 horizontal로 폴백" 계약)
- TC-24-06 줌 상태 pan: `clickZoomTo(page, 2, false)` → `row-activeZoom-value`=`2.000` 확인 → `getSceneXShift` 스냅샷 → 가로 스와이프 → `waitForSceneStable` → X-shift 변화량 `> 50` (줌 상태에서 pan이 콘텐츠를 실제 이동) + `getActiveZoom()===2` 유지 (pan이 zoom을 오염시키지 않음)

---

## 인수조건 (기계 검증 — 명령 + 기대 exit code)

TDD 전제: 아래 테스트를 먼저 작성해 실패(또는 신규 e2e의 경우 데모 testid 부재로 실패)를 확인한 뒤 테스트·데모를 완성한다. 라이브러리 코드는 건드리지 않으므로 "red"는 주로 신규 단언·셀렉터가 준비 전 상태에서 실패하는 형태다.

### 게이트 (전부 exit 0)

```bash
pnpm --filter @guksu/wvkit-core test -- --coverage   # T1/T3 후에도 threshold 통과 (테스트 삭제 금지 확인)
pnpm test                                             # 전 패키지 단위 (react/vue 포함 — T2)
pnpm test:e2e                                         # 4 프로젝트 전체 (T4~T8)
pnpm lint
pnpm typecheck
```

### grep 가드 (전부 exit 0)

```bash
# 고정 대기 소멸 — 주석은 허용, 호출만 검출
! grep -rn "waitForTimeout(" /Users/kimjongmin/dev/wvkit/e2e/specs /Users/kimjongmin/dev/wvkit/e2e/fixtures

# 위치 의존 셀렉터 소멸
! grep -rn "locator('select').first()" /Users/kimjongmin/dev/wvkit/e2e/specs
! grep -rn 'input\[type="checkbox"\]' /Users/kimjongmin/dev/wvkit/e2e/specs

# 신규 testid가 데모에 존재
grep -rn 'ctl-direction\|ctl-enable-pinch-zoom' /Users/kimjongmin/dev/wvkit/examples/react-example/src/ScrollContainerDemo.tsx
grep -rn 'lock2-btn\|scroll-spacer' /Users/kimjongmin/dev/wvkit/examples/react-example/src/ScrollLockDemo.tsx
```

### 테스트 케이스 존재 검증 (Sprint 1 교훈: non-TTY에서 `--reporter=verbose` 필수)

```bash
pnpm --filter @guksu/wvkit-core test -- --reporter=verbose 2>&1 | grep -c "TC-22-2"   # ≥ 3 (T3: TC-22-20~22)
pnpm exec playwright test --list 2>/dev/null | grep -c "TC-24"                          # ≥ 6 (T6~T8)
```

(신규 e2e 테스트 타이틀에 `TC-24-01`~`TC-24-06`, 신규 SafeArea 단위 테스트 타이틀에 `TC-22-20`~`TC-22-22` 프리픽스를 넣는다. T1/T2의 기존 테스트 증강분은 타이틀 변경 없이 단언만 추가 — qa는 diff로 확인.)

### 테스트 케이스 목록 (총 33)

- **T1 (14)**: 위 표 #1~#14 — 각 행이 1 케이스 (표의 "추가할 단언"이 곧 인수 단언)
- **T2 (6)**: 위 표 #1~#6
- **T3 (3)**: TC-22-20 파싱·매핑 / TC-22-21 0 폴백 / TC-22-22 orientationchange 재파싱
- **T4 (3)**: TC-23-01 핀치 무시 + waitForSceneStable / TC-23-02 PTR 미달 당김 state 관측 poll / TC-23-03 탭 마운트 신호 대기
- **T5 (1)**: 셀렉터 교체 후 기존 S5·S6·S10 스펙 green + grep 가드 통과 (신규 케이스 아님 — 리팩토링)
- **T6 (2)**: TC-24-01 위치 복원 / TC-24-02 중첩 해제 순서
- **T7 (2)**: TC-24-03 scroll 이벤트 경로 / TC-24-04 리스너 add/remove 델타 일치
- **T8 (2)**: TC-24-05 both 폴백 / TC-24-06 줌 2.0 pan 합성

## 경계면 매핑 (생산자 ↔ 소비자)

| 경계면 | 생산자 | 소비자 | 계약 |
|---|---|---|---|
| 데모 testid | `ScrollContainerDemo.tsx` (`ctl-direction`, `ctl-enable-pinch-zoom`), `ScrollLockDemo.tsx` (`lock2-btn`, `unlock2-btn`, `lock2-status`, `scroll-spacer`) | `e2e/specs/scroll-container.gesture.spec.ts`, `scroll-lock.spec.ts` | testid 문자열이 유일 결합점 — 이름 변경 시 스펙 동시 수정 |
| 픽스처 헬퍼 | `e2e/fixtures/scroll-container.ts` — 신규 export `waitForSceneStable(page)` | `scroll-container.gesture.spec.ts` (TC-23-01, TC-24-06), 기존 `waitForScrollSettle` 내부 | transform 3프레임 연속 동일 = settle. `window.__lastTf/__sameCount` 상태는 호출 후 반드시 리셋 |
| ScrollLock prev-복원 의미론 | `packages/core/.../scroll-lock.ts:39-40,56-60` (동작 변경 없음) | TC-24-01/02 | e2e가 현 구현 의미론을 고정 — ref-count로 바꾸면 TC-24-02가 red가 되도록 설계된 것 (의도) |
| VirtualKeyboard 리스너 | `virtual-keyboard.ts:56-66` | TC-24-04 initScript 카운터 | 델타 비교(탭 진입 전 스냅샷 대비)로 다른 visualViewport 소비자와 간섭 차단 |
| getComputedStyle 스텁 | `safe-area.test.ts` (T3) | `safe-area.ts:28-36 readInsets` | 스텁은 sentinel 엘리먼트 인자에만 반응, 나머지는 원본 위임 — 전역 오염 금지, afterEach에서 restore |
| 커버리지 threshold | `packages/core/vitest.config.ts` (camera-control 55/90, ptr 80/85, stable-input 85/75) | T1 전체 | 테스트 삭제·skip 금지, 증강만 허용 |

## 범위 제외

- **라이브러리 소스 변경 없음** — B-22~24는 전부 테스트·픽스처·데모 수정. 테스트 작성 중 구현 결함이 드러나면 백로그에 신규 항목으로 등록하고 리더에게 보고 (이 스프린트에서 즉석 수정 금지).
- CSS3DRenderer 래퍼 체인 셀렉터(`:scope > div > div > div`) — 렌더러 생성 DOM이라 testid 불가. 주석 보강만.
- `pull-to-refresh.contract.spec.ts:17` 주석의 "waitForTimeout" 언급 — 호출이 아니므로 유지.
- WKWebView 실기기 검증(B-19 보류), README GIF(B-14a 보류), B-25 어댑터·설정 정리(차기 스프린트).
- vue example 데모 수정 — e2e는 react-example(:4173)만 대상이므로 이번 데모 확장은 react-example에 한정.
