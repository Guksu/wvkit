# Sprint 5 (touch-contracts) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-touch-contracts/plan.md |

## 1. 개요

star-readiness 백로그 B-08(PTR TouchEvent 경로 + activeSource 소스 승계 단위 테스트)과 B-10(e2e 골든 시나리오 4종)을 Sprint 5로 계획했다. 근거는 audit-unit-tests.md P1 1번째와 audit-e2e.md P1 1·2번째 항목. iOS 실환경 입력 계약(TouchEvent + touch→pointer 합성)이 단위·e2e 어느 레벨에서도 검증되지 않는 공백을 메우는 것이 목표.

## 2. 작업내용

- `docs/campaign/star-readiness/sprints/20260710-touch-contracts/plan.md` 신규 작성 — 태스크 4건:
  - T-01 (B-08): `pull-to-refresh.touch.test.ts` 신규, 단위 케이스 11건(U1~U11). happy-dom TouchEvent 한계는 `Object.defineProperty`로 touches/changedTouches 주입하는 기존 StableInput 패턴으로 우회. 감쇠 기대값은 `applyResistance` 수식에서 정확값 도출(240/7, 1200/17).
  - T-02 (B-08): `packages/core/vitest.config.ts`의 pull-to-refresh threshold(80/85)를 실측 −2%p 규칙으로 상향.
  - T-03 (B-10): G1 대각 스크롤 방지(픽스처 `getSceneYShift` 신규) + G2 suppressLayoutShift(`installVisualViewportStub` — addInitScript 필수, create 시점 capture 때문).
  - T-04 (B-10): G3 orientation inset 재측정(getComputedStyle 스텁으로 sentinel에 fake inset 주입) + G4 touch+합성 pointer 이중처리 1회 발화(신규 스펙 `pull-to-refresh.touch.spec.ts` + 데모에 `refresh-count` DataRow 계측 1개 추가).
- 인수조건 18건(AC-01~18) 전부 기계 검증형(명령 + exit 0)으로 명시. e2e 골든 시나리오는 `@golden` 태그로 선택 실행 가능하게 설계.
- 경계면 매핑 5건(PTR 입력소스, PTR↔데모 readout, StableInput↔visualViewport, SafeArea sentinel↔react state, scene transform↔픽스처 파서) 명시.

## 3. 주의사항

- 라이브러리 소스 변경 없음이 전제 — 구현 중 버그 발견 시 리더 보고 후 별도 백로그로 뺄 것.
- G2 visualViewport 스텁은 반드시 `page.addInitScript`여야 함(`stable-input.ts:126`이 create 시점에 window.visualViewport를 capture).
- G4는 실 브라우저 발화 순서(pointerdown이 touchstart보다 먼저 — 소스 주석 221-223 근거)를 따라야 승계 경로가 실행됨. `typeof Touch === 'undefined'` 환경은 test.skip 허용.
- 신규 e2e 스펙에 고정 대기(waitForTimeout) 금지 — audit-e2e P2 flake 지적 반영. 기존 스펙 정리는 B-23 범위로 제외.
- T-02 threshold는 T-01 완료 후 실측 기반으로만 상향(camera-control/stable-input 라인은 불변).
