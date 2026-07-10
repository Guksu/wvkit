# Sprint 2 core-behavior-tests QA 검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-core-behavior-tests/qa-report.md, packages/core/src/components/scroll-container/__tests__/camera-control.gestures.test.ts, packages/core/src/components/stable-input/__tests__/stable-input.test.ts, packages/core/vitest.config.ts |

## 1. 개요

Sprint 2(B-05 CameraControl 제스처 수식 테스트 · B-06 StableInput suppressLayoutShift/scrollAnchor 테스트 · T-03 threshold 램프)의 구현 결과를 구현자와 분리된 시선으로 교차검증했다. plan.md 인수조건 AC-01~AC-08 전 항목을 명령 직접 재실행(exit code)으로 판정하고, dev-notes.md의 생산자↔소비자 매핑을 소스(`camera-control.ts`/`matrix-utils.ts`/`stable-input.ts`) 대조로 검증했다.

## 2. 작업내용

- AC-01~AC-08 전 명령 재실행 — 8/8 exit code 기준 통과. camera-control 38 tests(신규 gestures 25), stable-input 29 tests(신규 8), coverage gate 그린(cc 84.26/94.73, si 92.59/85.71 실측 — dev-notes 기재와 일치), pnpm test/typecheck/lint 모두 exit 0, 비-테스트 core 소스 무변경(AC-08 exit 1) 확인.
- 경계면 교차검증 — 테스트 기대값 전수를 수식에서 재도출: `updatePan`(start−dx/z), `applyResistance`(−20/−40/−10/−290), 지터 보정 `dt=max(1,interval,sinceLastMove)`(B4/B5), `decideSnapTarget` effective 계산(B1~B3/E2/E3), 핀치 앵커(416=480−64) + `screenPointToWorld` 왕복, 다지 승계 재앵커(20/1.5)·재시작 dist(hypot 계산), stable-input 게이트 2종·`overflow+8` 인자까지 모두 소스와 일치.
- 껍데기 판정 — 신규 33케이스 전수 검토: 전량 정확값/스파이 인자·횟수 단언으로 load-bearing. 미호출 단언도 발화 조건을 만든 뒤 게이트만으로 차단됨을 검증하는 구조라 자명한 통과 없음.
- 산출물: `docs/campaign/star-readiness/sprints/20260710-core-behavior-tests/qa-report.md` (8/8 PASS, FAIL 0건, 수정 요청 없음).

## 3. 주의사항

- stable-input functions threshold 85는 실측 85.71 대비 마진 0.71%p — stable-input에 함수를 추가하는 후속 작업은 해당 함수 테스트를 동반하지 않으면 coverage gate가 즉시 red.
- plan AC-07 주석의 "신규 26케이스"는 실제 33케이스(구현자가 threshold 플로어 달성을 위해 그룹 E 7건 보강) — 문서 주석 불일치일 뿐 판정 무관.
- `pnpm test`는 turbo 캐시가 일부 태스크를 재생했으나 core 단위 테스트는 vitest 직접 재실행으로 별도 확인함.
