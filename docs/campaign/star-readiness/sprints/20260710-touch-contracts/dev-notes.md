# Sprint 5 — touch-contracts dev-notes (implementer)

작성: 2026-07-10 · 브랜치: `sprint/20260710-touch-contracts` · plan.md 대비 구현 기록

## 1. 변경 파일

| 파일 | 태스크 | 내용 |
|---|---|---|
| `packages/core/src/components/pull-to-refresh/__tests__/pull-to-refresh.touch.test.ts` | T-01·T-02 | **신규.** U1~U11 (11건, `touch —` 접두) + 커버리지 램프 보강 7건 (아래 §4) |
| `packages/core/vitest.config.ts` | T-02 | pull-to-refresh.ts threshold `branches 80→88, functions 85→98` (실측 90.07/100 −2%p 내림) |
| `e2e/fixtures/scroll-container.ts` | T-03 G1 | `getSceneYShift(page)` 신규 — `getSceneXShift`의 Y 대칭 |
| `e2e/specs/scroll-container.gesture.spec.ts` | T-03 G1 | `@golden diagonal` 테스트 추가 (S4 describe 내) |
| `e2e/fixtures/stable-input.ts` | T-03 G2 | `installVisualViewportStub(page)` 신규 — addInitScript로 EventTarget 기반 fake VV + `window.__vvStub.setHeight(h)` |
| `e2e/specs/stable-input.spec.ts` | T-03 G2 | `@golden suppressLayoutShift` 테스트 추가 |
| `e2e/specs/safe-area.spec.ts` | T-04 G3 | `installInsetStub` (getComputedStyle 래핑, sentinel 식별 = 인라인 paddingTop의 `env(safe-area-inset-top`) + `@golden orientationchange` 테스트 |
| `examples/react-example/src/PullToRefreshDemo.tsx` | T-04 G4 | `refreshCount` state + `handleRefresh`에서 증가 + `<DataRow label="refresh-count">` (readout 1개, 스타일 변경 없음) |
| `e2e/fixtures/pull-to-refresh.ts` | T-04 G4 | `getRefreshCount(page)` + `pullWithTouchAndSyntheticPointer(page, dy)` 신규 |
| `e2e/specs/pull-to-refresh.touch.spec.ts` | T-04 G4 | **신규.** `@golden touch+합성 pointer → onRefresh 정확히 1회` |

**라이브러리 소스(`packages/*/src` 비테스트) 변경 없음 → changeset 불필요** (vitest.config·테스트·e2e·데모 계측뿐).
테스트 작성 중 라이브러리 버그 미발견 — 리더 보고 사항 없음.

## 2. 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 검증 방식 |
|---|---|---|---|
| PTR touch 입력 계약 | `pull-to-refresh.ts:216-273` + 소스 승계 224-231 | 단위 `pull-to-refresh.touch.test.ts` (happy-dom: `new Event`+defineProperty 주입) | U1~U11 — 감쇠값(240/7, 1200/17)·`defaultPrevented`·onRefresh 1회를 값으로 단언 |
| PTR touch+pointer 이중처리 | 동일 | e2e `pullWithTouchAndSyntheticPointer` (실 브라우저, pointer→touch→[touchmove,pointermove]쌍→touchend→pointerup) | `row-refresh-count-value` 정확히 1 (가드 회귀 시 2) |
| PTR → 데모 readout | `PullToRefreshDemo.tsx` `refreshCount` (onRefresh에서 증가) | `getRefreshCount` 픽스처 | testid `row-refresh-count-value` (ui.tsx DataRow 자동 생성) |
| StableInput ↔ visualViewport | `stable-input.ts:126` (create 시 capture) | `installVisualViewportStub` — **addInitScript 필수** (goto 전 호출) | resize dispatch 후 display top·scrollY ±0.5px, `data-focused` 잔존, value 불변 |
| SafeArea sentinel ↔ react state | `safe-area.ts:28-36` readInsets + `:53` orientationchange | `installInsetStub` → `window.__fakeInsets` | `expect.poll`로 `row-top-value` '47px' / `row-bottom-value` '34px' (고정 대기 없음) |
| ScrollContainer scene transform | CSS3DRenderer matrix3d | `getSceneXShift`/`getSceneYShift` | 대각(-220,-120) 후 index 1 + |ΔX|>100 + |ΔY|≤0.5 |

## 3. 실행한 검증 명령과 결과 (AC 대응)

| AC | 명령 | 결과 |
|---|---|---|
| AC-01~11 | `pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/components/pull-to-refresh` | exit 0, `grep -c "touch —"` = 16 (≥11; U1~U11 + 램프 5건이 `touch —` 접두) |
| AC-12 | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` | exit 0. 실측 branches **90.07** / functions **100** (plan 체크포인트 ≥90/≥95 충족) → threshold 88/98 |
| AC-13~16 | `pnpm test:e2e --grep "@golden"` | **16/16 pass** (4 프로젝트 × 4 시나리오, skip 0) · 안정성 확인 3회 연속 그린 · `--list` 4종 나열 확인 |
| AC-17 | `pnpm test` | exit 0 (core 250 tests 포함) |
| AC-18 | `pnpm test:e2e` | 202 passed / 10 skipped(기존 mobile-only skip) / 0 failed |
| 게이트 | `pnpm typecheck` / `pnpm lint` / `pnpm build` | 모두 exit 0 |

## 4. plan 대비 편차·트레이드오프

1. **T-02 재점검 발동 → 램프 테스트 7건 추가.** U1~U11만으로 실측 branches 83.46 (<90 체크포인트). plan 절차대로 재점검하여 계약상 의미 있는 경계 가드 7건을 같은 파일 `boundary guards (coverage ramp)` describe에 추가: armed→pulling 강등(라인 111), refreshing 중 touchstart 거절(118), 무제스처 touchend no-op(261), touch 활성 중 pointerdown 무시(279, 역순 이중처리), pointerId 불일치 pointermove(293-294), pointer 음수 delta(298), reset 트윈 중 destroy(329). 이후 실측 90.07 도달. 잔여 미커버는 방어적 가드(destroyed 재확인, null touch 등 도달 불가 경로)와 plan이 제외한 299-300 일부.
2. **G1 스와이프 크기 -160→-220 (dy는 -120 유지).** 데스크톱 프로젝트 캔버스 폭(~552px) 기준 dx 160은 dragRatio 0.29로 snapThreshold(0.3)에 미달 — 속도항 보정에 의존하는 flake 경계였음. dx 220(dragRatio ~0.40)으로 스냅을 결정적으로 만듦. Y 오염 검출력은 dy가 결정하므로 계약 불변.
3. **G4 skip 제거 — WebKit fallback.** plan의 `new Touch(...)`는 WebKit에서 Illegal constructor (typeof 가드로는 검출 불가 — Touch 심볼은 존재). 픽스처가 페이지 컨텍스트에서 구성 가능 여부를 try로 판별해 Chromium 계열은 실 생성자, WebKit은 `new Event`+defineProperty(단위 테스트와 동일 표면)로 폴백 → **4개 프로젝트 전부 실행, skip 0** (plan은 skip 허용이었으나 상회 달성). `supportsTouchEvents` 헬퍼는 불필요해져 미도입.
4. **G2 기준선 측정을 포커스 이후로 이동.** mobile-chrome에서 탭/포커스 자체의 ~3px 미세 이동이 resize 계약과 무관하게 섞여 flake — 검증 대상은 "VP resize 전후" 불변이므로 포커스 안정화 후 기준선 기록.
5. **G2 fake height를 `max(innerHeight−320, 컨테이너 bottom+24)`로 동적화.** mobile-safari에서 인풋 컨테이너 bottom(≈563) > 852−320=532 → overflow 양수가 되어 보정 스크롤이 *정당하게* 발생, "overflow 0이면 무보정" 전제가 깨짐. 전제를 모든 프로젝트에서 보존하도록 하한 설정 (데스크톱은 기존 −320 그대로).

## 5. 남은 것 / 후속

- 없음 (범위 제외 항목은 plan §범위 제외 그대로: B-18 PTR e2e 잔여 계약, B-09 어댑터 StrictMode, B-23 기존 waitForTimeout 정리).
- `docs/campaign/star-readiness/backlog.md`의 로컬 수정(M)은 이 세션 작업 아님 — planner 산출물로 추정, 건드리지 않았음.
