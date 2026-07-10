# Sprint 2 (core-behavior-tests) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-core-behavior-tests/plan.md |

## 1. 개요

star-readiness 캠페인 Sprint 2 계획. 대상은 B-05(CameraControl 핵심 수식 단위 검증, branch 56.5%)와 B-06(StableInput suppressLayoutShift/scrollAnchor 0% 커버). 근거는 audit-unit-tests.md P0 1·2번째 항목이며, 라이브러리의 존재 이유가 되는 두 핵심 동작을 값 단언으로 고정하는 것이 목표.

## 2. 작업내용

- `docs/campaign/star-readiness/sprints/20260710-core-behavior-tests/plan.md` 신규 작성 — 태스크 3건:
  - T-01 (B-05): camera-control 제스처 테스트 18케이스 (A: updatePan 수식 5, B: endPan 스냅 방향 5 — 지터 보정 버그픽스 회귀 포함, C: 핀치 줌+앵커 6, D: 다지 승계 2). 기대값은 matrix-utils 수식에서 직접 도출한 정확값(예: 저항 -20, 앵커 보정 후 x=416)으로 명시.
  - T-02 (B-06): stable-input suppressLayoutShift 테스트 8케이스 (anchor 3종 × 게이트 조건 + opt-out + destroy 해제 + vv 부재). visualViewport 목 주입 패턴(EventTarget + defineProperty, 생성 전 주입 필수) 명시.
  - T-03: Sprint 1이 잠근 커버리지 threshold 램프 — camera-control branches ≥70 / stable-input branches ≥90·functions ≥85 최소 플로어, pull-to-refresh 미변경.
- 인수조건 8블록(AC-01~08), 전부 명령+기대 exit code로 기계 검증 가능. Sprint 1 교훈 반영: vitest 타이틀 grep은 `--reporter=verbose`, 필터명은 `@guksu/wvkit-core`.
- 소스 무변경 불변식을 AC-08(git status --porcelain, 읽기 명령)로 qa가 교차검증하도록 설계.

## 3. 주의사항

- B4/B5(속도·지터) 케이스는 performance.now 목킹 필수 — 목킹 없이는 비결정적. 계획에 시퀀스 타임스탬프까지 명시했으므로 그대로 구현할 것.
- T-03 플로어는 커버리지 예측에 기반한 값 — 실측이 플로어 미달이면 threshold를 낮추지 말고 테스트를 보강하거나 리더 에스컬레이션.
- 테스트 작성 중 실제 버그가 드러나면(예: destroy 후 콜백) 소스를 임의 수정하지 말고 리더 보고 — 동작 변경은 이 스프린트 범위 밖(B-13 등 별도 백로그).
- camera-control functions 하한 90은 유지만 함 — stepTween(트윈)은 B-17 범위라 이번에 커버되지 않음.
