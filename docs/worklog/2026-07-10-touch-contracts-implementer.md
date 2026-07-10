# Sprint 5 touch-contracts 구현 (B-08 + B-10)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer (star-readiness Sprint 5) |
| 관련 경로 | `packages/core/src/components/pull-to-refresh/__tests__/pull-to-refresh.touch.test.ts`, `packages/core/vitest.config.ts`, `e2e/fixtures/*`, `e2e/specs/*`, `examples/react-example/src/PullToRefreshDemo.tsx` |

## 1. 개요

iOS 실환경 입력 계약(TouchEvent 경로 + touch→pointer 합성 이중처리 방어)이 e2e에만 — 그마저 PointerEvent만 발화해 — 의존하던 것을 테스트로 고정했다. plan: `docs/campaign/star-readiness/sprints/20260710-touch-contracts/plan.md` (B-08 단위 11건 + threshold 램프, B-10 골든 e2e 4종). 라이브러리 소스 변경 없음.

## 2. 작업내용

- `packages/core/.../pull-to-refresh.touch.test.ts` **신규**: U1~U11 (`touch —` 접두, happy-dom용 `new Event`+defineProperty TouchList 주입, 감쇠값 240/7·1200/17 단언) + 커버리지 램프 경계 가드 7건. 총 18 케이스.
- `packages/core/vitest.config.ts`: pull-to-refresh.ts threshold `branches 80→88 / functions 85→98` (실측 90.07/100 −2%p).
- e2e 골든 4종 (`@golden`, 4 프로젝트 × 4 = 16 전부 pass, skip 0):
  - G1 `scroll-container.gesture.spec.ts` + `getSceneYShift` 픽스처 — 대각(-220,-120) 드래그 후 index 1 스냅 + scene Y-shift ±0.5px 불변.
  - G2 `stable-input.spec.ts` + `installVisualViewportStub` (addInitScript) — VP resize 중 display input top·scrollY·포커스·value 불변.
  - G3 `safe-area.spec.ts` — getComputedStyle 래핑 스텁 + orientationchange → readout '47px'/'34px' `expect.poll` 갱신.
  - G4 `pull-to-refresh.touch.spec.ts` **신규** + `pullWithTouchAndSyntheticPointer`/`getRefreshCount` 픽스처 + 데모 `refresh-count` readout — touch+합성 pointer 풀 시퀀스 후 onRefresh 정확히 1회.
- 게이트 전부 그린: `pnpm test`(250 core tests)·`typecheck`·`lint`·`build`·`test:e2e`(202 pass/10 기존 skip) exit 0. 골든 3회 연속 그린.
- changeset 없음 — 배포 패키지 런타임 변경 없음(테스트·config·데모 계측뿐).

## 3. 주의사항

- plan 대비 편차 4건(사유 포함)은 `sprints/20260710-touch-contracts/dev-notes.md` §4 참조: (1) branches 실측 83.46<90 → plan 재점검 절차대로 램프 테스트 7건 추가해 90.07 달성, (2) G1 dx -160→-220(데스크톱 캔버스 폭에서 snapThreshold 미달 flake 경계), (3) G4 WebKit은 `new Touch`가 Illegal constructor → 픽스처 폴백으로 skip 없이 4 프로젝트 실행, (4) G2 기준선을 포커스 후 기록 + fake height 하한(컨테이너 bottom+24) — overflow 0 전제 보존.
- G2/G3 스텁은 **`page.goto` 전에 설치**해야 함(addInitScript — create 시점 capture 때문). 후속 스펙 작성 시 동일.
- `backlog.md` 로컬 수정은 planner 산출물 — 이 작업에서 건드리지 않음.
