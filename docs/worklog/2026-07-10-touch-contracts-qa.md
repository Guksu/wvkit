# Sprint 5 (touch-contracts) QA 검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa 에이전트 |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-touch-contracts/qa-report.md, packages/core/src/components/pull-to-refresh/__tests__/pull-to-refresh.touch.test.ts, e2e/specs/*, e2e/fixtures/* |

## 1. 개요

Sprint 5(touch-contracts: B-08 PTR TouchEvent 단위 테스트 + B-10 e2e 골든 4종)의 구현 결과를 구현자와 분리된 시선으로 검증했다. plan.md 인수조건 AC-01~18 전 항목을 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면 6건을 소스 대조로 교차검증하며, 신규 테스트 18건(단위)+4건(e2e)의 껍데기 여부를 판정했다.

## 2. 작업내용

- **인수조건 18항목 전부 직접 재실행 → 전 항목 PASS** (AC-18은 조건부). 상세는 `sprints/20260710-touch-contracts/qa-report.md`.
  - 단위: PTR 스위트 60 tests exit 0, `grep -c "touch —"` = 16 (≥11). 커버리지 exit 0, 실측 90.07/100 → threshold 88/98 상향은 −2%p 내림 규칙 준수.
  - e2e golden: 16/16 pass, skip 0 (`--list` 4종 × 4프로젝트 확인). G4는 mobile-chrome 단독 6회 반복도 그린.
  - 회귀: `turbo run test --force` exit 0 (turbo 캐시 우회 실측). typecheck/lint exit 0. 전체 e2e는 3회 실행 — 3회차 202 passed/10 skipped exit 0.
- **경계면 교차검증 6건 전부 일치**: 소스 승계 분기(pull-to-refresh.ts:224-231)↔U9/U11, VV capture(stable-input.ts:126)↔addInitScript 스텁, SafeArea sentinel↔getComputedStyle 스텁, refresh-count readout testid 체인, getSceneYShift의 X 대칭성, 픽스처 이벤트 순서↔소스 주석.
- **껍데기 판정: 전부 load-bearing** — 감쇠 수식 역산값(240/7, 1200/17) 단언, 정확 상태열 toEqual, 호출 횟수 정확 1, onPull 미호출 시 명시 throw하는 헬퍼, G4의 refreshing 선확인(트리비얼 통과 차단).
- **코드 수정 없음** (QA 원칙 준수). 발견은 qa-report §4의 리스크 2건으로만 전달.

## 3. 주의사항

- **R-1 (스프린트 무관 기존 flake):** `e2e/specs/scroll-container.api.spec.ts:43` "마지막 인덱스(5) clamp"가 mobile-safari에서 단독 반복 5회 중 1회 실패. 로컬 retries 0이라 풀런이 간헐 red. B-23에 폴링 보강 항목 추가 권고 — 리더 판단 필요.
- **R-2 (모니터링):** 전체 e2e 2회차에서 mobile-chrome 브라우저 wedge(teardown 30s 초과 연쇄, 신규 PTR touch 스펙 파일에서 시작) 1회 관찰. 단독 반복·golden·3회차 풀런 모두 그린이라 환경성으로 판단하되, CI 재발 시 trace 확보 후 신규 스펙 조사.
- 라이브러리 소스 미변경 → changeset 불필요. `backlog.md` 2줄 수정은 planner 산출물.
