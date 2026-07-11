# Sprint 6 (adapter-tests-docs) QA 교차검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-adapter-tests-docs/qa-report.md, packages/react/src/components/*/__tests__/, packages/vue/src/components/*/__tests__/, README.md, README.ko.md, CONTRIBUTING.md, .github/ |

## 1. 개요

Sprint 6(B-09 어댑터 실질화 · B-14b README 문서 진입로 · B-15 커뮤니티 헬스)의 구현 결과를 구현자와 분리된 시선으로 교차검증했다. plan.md 인수조건 12건을 전부 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면 매핑을 소스 대조로 검증하며, 신규 테스트 12건의 껍데기 여부를 판정했다.

## 2. 작업내용

- AC-01~12 전부 직접 재실행 — 전부 exit 0. AC-01은 최초 실행이 turbo FULL TURBO 캐시였으므로 `turbo run test --force`로 캐시 무시 재실행해 판정.
- AC-02/04는 `vitest run --reporter=verbose` 로그를 스크래치패드에 저장 후 `grep -c '\[B-09\]'`로 카운트(react 8, vue 4) + 12건 전부 ✓ 통과 타이틀 육안 확인.
- B-09 신규 테스트 12건(A1~A12) 전수 소스 리뷰 — 전부 load-bearing 판정(수치 단언·짝 맞춤·사전 계약 단언으로 위양성 차단). 상세 근거는 qa-report §2.
- 경계면 소스 대조 — react optionsRef(`use-pull-to-refresh.ts:39-42` 등), StrictMode-안전 cleanup, core stable-input `remove()`, core virtual-keyboard vv resize+scroll/window 폴백, vue noop 가드(`use-scroll-container.ts:60-63`), README 섹션 위치(Features:30 ↔ Installation:58 사이 :43), CONTRIBUTING 커맨드 ↔ CLAUDE.md 일치, 이슈/PR 템플릿 스키마 전부 일치 확인.
- "기존 케이스 삭제 금지" 준수 검증 — 테스트 diff 삭제 라인은 import 병합 1건뿐.
- 산출: `docs/campaign/star-readiness/sprints/20260710-adapter-tests-docs/qa-report.md` (12/12 PASS, 수정 요청 0건).

## 3. 주의사항

- 브랜치 표기 불일치: plan.md는 `chore/quality-sprint-1`, 실제 작업 브랜치는 `sprint/20260710-adapter-tests-docs`. git 운영은 사용자 전담 — 머지 경로 확인 필요.
- vue stable-input 기존 smoke 케이스("onChange 콜백이 위임된다")가 `if (hiddenInput)` 조건부 단언 — B-22(껍데기 전수 정리) 시 우선 대상.
- `pnpm test/lint/typecheck`는 turbo 캐시 히트가 가능하므로 QA 재검증 시 `--force` 또는 패키지별 vitest 직접 실행을 권장.
