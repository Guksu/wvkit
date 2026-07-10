# Sprint 1 테스트 게이트 — QA 교차검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-test-gate/qa-report.md, .github/workflows/ci.yml, packages/core/vitest.config.ts, packages/core/src/components/stable-input/__tests__/stable-input.test.ts, package.json |

## 1. 개요

Sprint 1 "테스트 게이트"(B-01 CI e2e 잡 / B-07 한글 IME Enter 가드 단위 테스트 / B-20 커버리지 threshold)의 구현 결과를 생성자·검증자 분리 원칙에 따라 교차검증했다. plan.md의 인수조건 AC-01~AC-06을 기계 검증(종료 코드)으로 재실행하고, IME 테스트의 의미(load-bearing 여부)를 소스 가드와 대조했으며, lint 사전 실패 주장을 변경 파일 목록과 대조했다.

## 2. 작업내용

- **AC-01** — grep 4건 + python yaml 2건 직접 실행, 전부 exit 0. e2e 잡 8스텝 계약을 `ci.yml:43-76`과 라인 단위 대조 → 전부 일치(checkout·action-setup·setup-node node20/cache·install frozen·playwright install --with-deps chromium webkit·build·test:e2e·upload-artifact if !cancelled 2경로). ci/e2e 병렬(needs 없음) 확인.
- **AC-02** — 리더 지시대로 재실행 생략, implementer의 exit 0(186 passed/10 skipped) 승계.
- **AC-03** — `vitest run stable-input` exit 0 (21 tests). 신규 3케이스가 전부 hiddenInput에 dispatch(가드 리스너 경로 일치)되고 자기검증 단언(`ev.isComposing`/`keyCode`)과 `onSubmit` 0/0/1 단언을 갖춤을 소스와 대조 → 껍데기 아님 확인. plan line 127 grep 하위검증은 기본 리포터에서 0/verbose에서 3 실측 — AC 명령 표현 문제(구현 결함 아님).
- **AC-04** — `vitest run --coverage` exit 0. 3파일 실측(56.52/94.73, 82.1/88.46, 90/78.57) 전부 설정 하한(55/90, 80/85, 85/75) 위. glob 키 ↔ 실제 파일명 매칭, 설정값 ↔ plan 표 일치 확인.
- **AC-05** — CLI threshold 오버라이드 독립 재실행은 세션 권한 정책으로 거부됨. implementer worklog의 음성 검증 기록(55→99 시 exit 1 후 원복) + `vitest.config.ts:14` 현재값 55/90 원복 상태 직접 확인으로 판정.
- **AC-06** — `pnpm test` exit 0(241), `pnpm typecheck` exit 0. `pnpm lint` exit 1이나 red 13건 전부 이번 변경 4파일 밖(e2e/examples/react 기존 코드) — 변경 3파일 개별 biome lint는 exit 0(클린). 사전 존재로 분류.
- **경계면** — Coverage gate 필터명 `@guksu/wvkit-core` ↔ package.json name 일치. `test:coverage` 스크립트 정의 확인. core 소스 무변경 → 어댑터 불변식 준수.
- 판정: **PASS 6 / FAIL 0**. 상세는 qa-report.md.

## 3. 주의사항

- **AC-03 grep 하위검증 명령**은 vitest 기본 리포터에서 통과 테스트 타이틀을 출력하지 않아 count=0. planner에게 `--reporter=verbose` 병기로 정정 요청 권장(구현 아닌 plan 결함).
- **AC-06 lint 사전 red 13건**은 이번 스프린트 범위 밖. 백로그 신규 항목(기존 e2e/examples/react lint 정리)으로 분리하고, AC-06 lint 조건을 "변경 파일 한정 클린"으로 정정 권장.
- **AC-05 기계 재검증 불가** — 세션 권한 정책이 CLI threshold 오버라이드를 거부. 기록+config 원복 상태로 판정했으며, 게이트 메커니즘 자체는 AC-04(하한 위 통과)로 정상 확인됨. 재검증 필요 시 config 임시 수정 권한이 있는 주체가 수행.
- 코드는 직접 수정하지 않음. git 변경 명령 미사용.
