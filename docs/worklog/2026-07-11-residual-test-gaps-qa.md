# Sprint 8 (residual-test-gaps) QA 교차검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-residual-test-gaps/qa-report.md, packages/core/src/components/{scroll-container,virtual-keyboard}/__tests__/, e2e/specs/pull-to-refresh.contract.spec.ts, e2e/fixtures/pull-to-refresh.ts, examples/react-example/src/PullToRefreshDemo.tsx, packages/core/vitest.config.ts |

## 1. 개요

Sprint 8(B-17 잔여 단위 공백 3건 + B-18 PTR e2e 계약 5건)의 구현 산출물을 인수조건 AC-01~23 전 항목 기계 검증(직접 재실행)하고, dev-notes의 생산자↔소비자 경계면 6종을 소스 대조로 교차검증했으며, 신규 테스트의 껍데기 여부를 판정했다.

## 2. 작업내용

- 인수조건 전 항목 재실행 — 결과 **PASS 23 / FAIL 0**:
  - 단위(AC-01~15): scroll-container+virtual-keyboard 대상 vitest verbose exit 0, `tween —` 6 / `rotate —` 3 / `resize —` 6 grep 확인 (146 passed)
  - 커버리지(AC-16): coverage exit 0, camera-control 실측 branches 84.04/functions 100 → threshold 81/92→82/98 상향(−2%p 램프 규칙 준수), 타 파일 threshold 무변경
  - e2e 계약(AC-17~21): `--grep "contract —"` --list 20건(5×4 프로젝트) 나열 + 실행 20 passed/skip 0
  - 회귀(AC-22/23): `pnpm test` exit 0(328 passed), `pnpm test:e2e` exit 0(222 passed/10 skipped) + typecheck/lint exit 0
- 경계면 소스 대조 6종 전부 일치 — CameraControl stepTween 프레임 시맨틱, VirtualKeyboard 회전 리셋(:34-37), RO 콜백 가드/조기리턴/보정 경로, 데모 remountKey에 failNext 미포함(ref 경유), console.error prefix 문자열, 인라인 overscrollBehavior 판정. 상세는 qa-report §2.
- 껍데기 판정 — 신규 3파일+contract 스펙 모두 load-bearing(정확 수치·부정 단언·양방향 증명). 기존 케이스 삭제 0건 확인.
- 산출물: `docs/campaign/star-readiness/sprints/20260710-residual-test-gaps/qa-report.md` 작성.

## 3. 주의사항

- **e2e 부하 flake**: `pnpm test`와 `pnpm test:e2e`를 동시 실행하면 mobile-safari 기존 ScrollContainer 스펙 2건(api.spec:43, lifecycle.spec:25)이 5s 타임아웃으로 실패할 수 있음 — 단독 실행 시 통과. 이번 스프린트 변경과 무관, B-23 처리 시 참고.
- resize 테스트의 cameraEl(firstChild.firstChild)은 CSS3DRenderer 내부 DOM 구조 의존 — three 버전 상향 시 우선 파손 지점(의도된 카나리아, dev-notes 문서화됨).
- 라이브러리 소스 무변경 확인 완료 → changeset 불필요 판단에 동의.
