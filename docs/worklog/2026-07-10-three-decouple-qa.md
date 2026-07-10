# Sprint 4 three-decouple QA 교차검증 (B-02 + B-13)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-three-decouple/qa-report.md, scripts/verify-three-decouple.mjs, packages/{core,react,vue}/src/scroll-container.ts, packages/core/src/components/scroll-container/ |

## 1. 개요

Sprint 4(three-decouple)의 구현 결과를 구현자와 분리된 시선으로 검증했다. plan.md 인수조건 AC-1a~AC-14 전 항목을 리포 루트에서 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면 매핑을 소스 대조로 교차검증하고, 신규 테스트(TC-B02-1/2, TC-B13-1/2/3)의 껍데기 여부를 판정했다.

## 2. 작업내용

- 인수조건 16항목 전부 직접 재실행 → **전 항목 PASS, FAIL 0건**. 상세는 `docs/campaign/star-readiness/sprints/20260710-three-decouple/qa-report.md`.
  - green 게이트: AC-1b(verify 스크립트 12건 ok), AC-2~12, AC-13b, AC-14 전부 기대 exit code 재현. 추가로 `pnpm lint` exit 0.
  - red 게이트(AC-1a/AC-13a): 구현 후 재실행 불가 — `git diff HEAD`로 사전 상태(배럴 값 export 존재, `destroyed` 가드 부재, 껍데기 테스트 `not.toThrow()` only)를 확인하는 사후 논리 검증으로 갈음.
- 경계면 교차검증 5개 경계 전부 정합: core subpath 엔트리↔react/vue use-scroll-container 값·타입 import 경로 일치, 배럴 three 무참조(격리 CJS/ESM 스모크 실증), 데모의 값(subpath)·타입(배럴) 분리 import가 배럴 타입 잔존 계약을 실증, exports 맵↔tsup entry 3패키지 일치, destroyed 가드↔어댑터 언마운트 계약.
- 테스트 의미 판정: TC-B02·TC-B13 모두 load-bearing(콜백 횟수·상태 불변·DOM 불변 명시 단언 — 가드 제거 시 즉시 red). verify 스크립트는 exit code 3분류로 오탐 방지 설계 확인.

## 3. 주의사항

- **AC-14 자기참조**: plan.md의 AC 명령 문자열이 grep 패턴에 자기 매치(plan.md:114). 캠페인 산출물 제외 판정이 타당하나, 향후 planner는 grep형 AC에 `--exclude-dir=campaign`을 명시할 것.
- **red 게이트 QA 독립 재현 한계**: TDD red를 QA가 기계 재현하려면 테스트 커밋/구현 커밋 분리가 필요 — 커밋은 사용자 전담이므로 이번엔 diff 검증으로 갈음.
- **B-21(publint/attw) 상향**: 신규 `./scroll-container` exports 서브패스가 3패키지에 생겼으므로 패키지 메타 검증 우선순위 상향 필요 (dev-notes 제안에 qa 동의).
- breaking(minor bump) 릴리즈 — changeset 본문 BREAKING 명시 확인 완료. 커밋·푸시는 사용자 전담.
