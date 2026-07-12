# dev-notes — Sprint 10 test-hardening (B-22 + B-23 + B-24)

| 항목 | 내용 |
|------|------|
| 작성 | implementer (2026-07-11) |
| 계획 | 같은 폴더 `plan.md` |
| 결론 | 태스크 T1~T8 전체 구현 완료 — 게이트·grep 가드·타이틀 카운트 전부 통과. **라이브러리(packages/*) 런타임 변경 없음 → changeset 불필요** |

## 1. 변경 파일 목록

### T1 — core 껍데기 단언 강화 (14/14)

| 파일 | 변경 |
|---|---|
| `packages/core/src/components/scroll-container/__tests__/scroll-container.test.ts` | #1 SSR: scrollTo/zoomTo 후 `getActiveIndex()===0`·`getZoom()===1` / #2 'both' 폴백: `onIndexChange` 스파이 + `getActiveIndex()===1` / #3 destroy 멱등: 2차 destroy 후 전 패널 `display===''` |
| `packages/core/src/components/pull-to-refresh/__tests__/pull-to-refresh.test.ts` | #4 destroy 멱등: `onStateChange` 미호출 + `getState()==='idle'` / #5 setEnabled: onPull 스파이 + pointer 시퀀스로 게이트 동작 검증(통합 scenario 9와 동일 계약을 unit 레벨 고정 — 기존 테스트 미삭제) / #6 SSR: setEnabled/destroy 후 `getState()==='idle'` |
| `packages/core/src/components/scroll-container/__tests__/camera-control.test.ts` | #7 cancelAnimation no-op: 호출 전후 `camera.position.x/y` 불변 / #8 destroy 멱등: removeEventListener 추가 호출 없음 + position 불변 |
| `packages/core/src/components/scroll-container/__tests__/camera-control.tween.test.ts` | #9 V6: destroy 전 onChange 호출 수 캡처 → flushAll 후 불변 (트윈 정지) |
| `packages/core/src/components/scroll-container/__tests__/matrix-utils.test.ts` | #10 `applyResistance(5,10,0,0.2)` === **10** (max<min → clamp, value<min 분기 선평가) + `Number.isFinite` |
| `packages/core/src/components/scroll-container/__tests__/scroll-container.integration.test.ts` | #11 핀치: `onZoomChange` 발화 or `getZoom()>1` / #12 destroy 멱등: `root.children.length===0` |
| `packages/core/src/components/scroll-container/__tests__/scroll-container.resize.test.ts` | #13 R5: `onIndexChange` 스파이(destroy 후 mockClear) → ro.trigger 후 미호출 |
| `packages/core/src/components/scroll-lock/__tests__/scroll-lock.test.ts` | #14a SSR: lock() 후 `isLocked===false` + body overflow 불변 |
| `packages/core/src/components/virtual-keyboard/__tests__/virtual-keyboard.test.ts` | #14b SSR: destroy 후 `isOpen===false`·`keyboardHeight===0` 유지 |
| `packages/core/src/components/safe-area/__tests__/safe-area.test.ts` | #14c SSR: destroy 후 `getInsets()` 동일 객체값 |
| `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` | #14d S8: focus() 후 hidden input이 `document.activeElement` / SSR: destroy 후 `getValue()===''` |

### T2 — 어댑터 잔여 껍데기 강화 (6/6)

| 파일 | 변경 |
|---|---|
| `packages/react/src/components/pull-to-refresh/__tests__/use-pull-to-refresh.test.tsx` | unmount 후 overscrollBehavior `''` 복원 + pointerdown/move 디스패치 → `onStateChange` 미호출 |
| `packages/react/src/components/stable-input/__tests__/use-stable-input.test.tsx` | render 후 hiddenInput 존재 + displayInput `readOnly===true` |
| `packages/vue/src/components/safe-area/__tests__/use-safe-area.test.ts` | mount 시 body children +1(sentinel), unmount 시 원복 |
| `packages/vue/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts` | threshold 마운트 초기값(`isOpen===false`, `keyboardHeight===0`) / unmount 테스트를 window 폴백 경로로 재구성 — unmount 전 resize→isOpen 토글로 계약 성립 확인 후, unmount 후 동일 시퀀스 불변 |
| `packages/vue/src/components/scroll-container/__tests__/use-scroll-container.test.ts` | unmount 전 renderer DOM 존재 확인 → unmount 후 `children.length===0` |

### T3 — SafeArea 인셋 파싱 스텁 실검증 (3/3)

`packages/core/src/components/safe-area/__tests__/safe-area.test.ts` — 신규 describe `inset parsing — getComputedStyle 스텁`:
- `TC-22-20` 44px/34px 주입 → `{top:44, right:0, bottom:34, left:0}` 파싱·방향 매핑
- `TC-22-21` `''` 주입 → 전 인셋 0 폴백 (`|| 0` 분기)
- `TC-22-22` 44→20 변경 후 orientationchange → onChange가 `{top:20,...}` (재파싱)
- 스텁은 `el !== sentinel`이면 원본 위임, afterEach `vi.restoreAllMocks()` — 전역 오염 없음

### T4 — e2e 고정 대기 제거 (3/3)

| 파일 | 변경 |
|---|---|
| `e2e/fixtures/scroll-container.ts` | `waitForSceneStable(page)` 신규 export (transform 3프레임 연속 동일 + `__lastTf/__sameCount` 리셋). `waitForScrollSettle`이 내부 재사용하도록 리팩토링. CSS3D 래퍼 체인 셀렉터에 구조 의존 주석 보강 |
| `e2e/specs/scroll-container.gesture.spec.ts` | `waitForTimeout(400)` → `waitForSceneStable` + `getActiveZoom()===1` |
| `e2e/specs/pull-to-refresh.gesture.spec.ts` | `waitForTimeout(50)` → `expect.poll` 관측 배열 수집 → idle 정착까지 `refreshing` 미관측 단언 |
| `e2e/specs/scroll-container.lifecycle.spec.ts` | `waitForTimeout(150)` → `ptr-container.waitFor()` (마운트 신호) |

### T5 — 위치 의존 셀렉터 → testid

- 데모: `ScrollContainerDemo.tsx`에 `ctl-direction`(select)·`ctl-enable-pinch-zoom`(checkbox)
- 스펙: `scroll-container.gesture.spec.ts:72,106` + **`scroll-container.lifecycle.spec.ts:30`**(plan 미기재였으나 grep 가드 대상이라 함께 교체), 탭 셀렉터 role/regex → `tab-pull-to-refresh`/`tab-scroll-container`

### T6~T8 — 신규 e2e (6 케이스)

| 케이스 | 파일 | 내용 |
|---|---|---|
| TC-24-01 | `e2e/specs/scroll-lock.spec.ts` | unlock이 lock 시점 scrollY 복원 (아래 트레이드오프 ①② 참조) |
| TC-24-02 | 〃 | 중첩 lock — prev-값 복원 의미론 고정 (unlock2 후 hidden 유지 → unlock 후 완전 복원) |
| TC-24-03 | `e2e/specs/virtual-keyboard.spec.ts` | scroll 이벤트 단독 경로로 isOpen 갱신 (mobile-only) |
| TC-24-04 | 〃 | `VisualViewport.prototype` initScript 래핑 — 탭 진입 전 스냅샷 대비 add 델타 === remove 델타 (mobile-only) |
| TC-24-05 | `e2e/specs/scroll-container.gesture.spec.ts` | both → horizontal 폴백: 가로 스와이프 스냅 + 세로 스와이프 Y-shift ≤0.5 |
| TC-24-06 | 〃 | zoomTo(2) 후 스와이프(-500) → 다음 패널 스냅(X-shift >50) + zoom 2 유지 |

데모: `ScrollLockDemo.tsx`에 2번째 `useScrollLock` 인스턴스(`lock2-btn`/`unlock2-btn`/`lock2-status`) + `scroll-spacer`(height 1600).

## 2. 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 계약 |
|---|---|---|---|
| `ctl-direction`, `ctl-enable-pinch-zoom` | `examples/react-example/src/ScrollContainerDemo.tsx` | `scroll-container.gesture.spec.ts` (S5·S6·TC-24-05·TC-24-06), `scroll-container.lifecycle.spec.ts` (S7) | testid 문자열이 유일 결합점 |
| `lock2-btn`/`unlock2-btn`/`lock2-status`/`scroll-spacer` | `examples/react-example/src/ScrollLockDemo.tsx` | `scroll-lock.spec.ts` (TC-24-01/02) | `lock2-status`는 `data-locked` 속성 패턴 동일 |
| `waitForSceneStable` | `e2e/fixtures/scroll-container.ts` | `scroll-container.gesture.spec.ts` (S6·TC-24-05·TC-24-06) + `waitForScrollSettle` 내부 | 3프레임 연속 동일 = settle, `__lastTf/__sameCount` 호출 후 리셋 |
| ScrollLock prev-복원 의미론 | `packages/core/.../scroll-lock.ts:39-40,56-60` (변경 없음) | TC-24-01/02 | ref-count로 바꾸면 TC-24-02 red — 의도된 설계 |
| VirtualKeyboard vv 리스너 | `virtual-keyboard.ts:56-66` (변경 없음) | TC-24-04 initScript 카운터 | 델타 비교로 타 vv 소비자 간섭 차단 |
| getComputedStyle 스텁 | `safe-area.test.ts` T3 describe | `safe-area.ts:28-36 readInsets` | sentinel 인자만 반응·원본 위임·restoreAllMocks |
| 커버리지 threshold | `packages/core/vitest.config.ts` | T1 전체 | 테스트 삭제 0건 — 증강만 수행, threshold 통과 확인 |

## 3. 실행한 검증 명령과 결과

| 명령 | 결과 |
|---|---|
| `pnpm --filter @guksu/wvkit-core test -- --coverage` | exit 0 — 16 files / 268 tests, threshold 통과 (camera-control ≥55/90, ptr ≥80/85, stable-input ≥85/75) |
| `pnpm test` | exit 0 — core 268 / react 34 / vue 29 전부 pass |
| `pnpm test:e2e` | exit 0 — **242 passed / 14 skipped**(mobile-only VK의 desktop skip) ×4 프로젝트 |
| `pnpm lint` | exit 0 — 145 files |
| `pnpm typecheck` | exit 0 — 6 tasks |
| `pnpm build` | exit 0 |
| grep 가드 5종 (waitForTimeout·select.first·checkbox·데모 testid 2종) | 전부 통과 |
| `playwright --list \| grep -c "TC-24"` | 24 (6 케이스 × 4 프로젝트 ≥ 6) |
| `core test --reporter=verbose \| grep -c "TC-22-2"` | 3 (≥ 3) |

TDD red 증거: 데모 testid 부재 상태에서 chromium 서브셋 실행 → 신규·교체 스펙 6건 red 확인 후 데모 수정으로 green 전환.

## 4. 남긴 트레이드오프·특이사항

1. **TC-24-01 DOM click 사용**: Playwright `click()`의 자동 스크롤(scrollIntoView)이 lock 시점 scrollY를 훼손해 `page.evaluate`의 DOM click으로 잠금/해제. 접근성 관점의 실 클릭 검증은 기존 lock/unlock 테스트가 담당.
2. **TC-24-01 오차 허용 ±2px**: chromium에서 `scrollTo(0,500)` 후 `scrollY===507` 관측(레이아웃 정착 드리프트) — 절대값 대신 "lock 직전 저장값 복원"을 `|Δ|≤2`로 단언. 초기 스크롤도 poll 안에서 반복 시도(레이아웃 정착 전 0 클램프 flake 방지).
3. **TC-24-06 스와이프 -500px**: zoom=2에서 화면 1px=월드 0.5unit이라 -200px는 스냅 임계 미달로 원위치 복귀(Δ=0) — 임계 초과분으로 상향하고 `waitForScrollSettle(page,1)`로 스냅 완료를 기다림.
4. **plan 외 추가 교체 1건**: `scroll-container.lifecycle.spec.ts:30`의 `locator('select').first()` — plan T5 표에 없었으나 grep 가드가 검출하므로 함께 `ctl-direction`으로 교체.
5. **T1 #9는 기존 단언이 사실상 커버**: V6에 `onChange 1회` 단언이 이미 있어, destroy 전 호출 수 캡처→flush 후 불변으로 의도를 명시화하는 수준의 증강.
6. **pre-existing flake 관측**: 첫 풀 e2e에서 `scroll-container.lifecycle.spec.ts:70`(S8 scrollTo(5), mobile-safari)가 1회 실패 — 이번 스프린트 미변경 테스트, 격리 실행·재실행 모두 green. 4-프로젝트 병렬 부하에서 `toHaveText` 5s 타임아웃 초과로 추정. 백로그 후보로 리더에게 보고.
7. **e2e 전용 tsconfig 부재**: `pnpm typecheck`는 packages/examples만 커버 — e2e 스펙 TS는 Playwright 변환 시점 검증에 의존(기존과 동일, B-25 어댑터·설정 정리 후보).
