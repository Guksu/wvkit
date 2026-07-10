# Sprint trust-fixes QA 검증 (B-03 + B-11 + B-12)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-trust-fixes/{plan.md,dev-notes.md,qa-report.md,three-floor-matrix.md}, packages/{core,react,vue}/src/index.ts, packages/{core,react,vue}/src/__tests__/public-api.test.ts, .changeset/20260710-trust-fixes.md |

## 1. 개요

Sprint "trust-fixes"(패키지명 `@guksu/wvkit-*` 통일, `WebviewHeadlessError` 값 export, three peer `>=0.160.0` 완화, changeset)의 구현 결과를 구현자와 분리된 시선으로 검증했다. plan.md의 인수조건 AC-1~AC-16 전 항목과 최종 게이트를 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면을 소스 대조했으며, 신규 테스트 5건(TC-5~9)의 껍데기 여부를 판정했다.

## 2. 작업내용

- 인수조건 16항목 전부 직접 재실행 → **16/16 PASS, FAIL 0건**. 상세는 `docs/campaign/star-readiness/sprints/20260710-trust-fixes/qa-report.md`.
  - T-01: AC-1(구명칭 잔존 0) / AC-2(배지 라벨) / AC-3(`pnpm build` exit 0) / AC-4(react·vue dist에서 core external 유지, 인라인 0건 — ESM import·CJS require 실물 확인)
  - T-02: TC-5~9 (`--reporter=verbose` grep, Sprint 1 교훈 적용) + AC-10/11 (dist ESM/CJS 런타임 값 도달 스모크)
  - T-03: AC-12(three-floor-matrix.md 실측 기록) / AC-13(`>=0.160.0` 형식) / AC-14(현행 0.184 green) / AC-15(devDep `^0.184.0` 원복)
  - T-04: AC-16 (3패키지 minor changeset)
  - 최종 게이트: `pnpm lint && pnpm typecheck && pnpm build && pnpm test` → exit 0 (core 228 / react 26 / vue 25 passed)
- 경계면 소스 대조: core 배럴 값 export ↔ react/vue 배럴 재노출 ↔ dist 런타임 노출 일치. CLAUDE.md 네이밍 지시문 = packages/*/package.json name 필드 일치 (CLAUDE.md는 gitignored — 파일 내용으로 검증). `pnpm-lock.yaml` 최종 diff 0 확인.
- 껍데기 테스트 판정: TC-5~9 전부 load-bearing. 특히 TC-7은 배럴 클래스와 core 내부 throw(`pull-to-refresh.ts:375`)의 클래스 동일성 단언으로 중복 번들 회귀를 잡는다.
- 치환 금지 항목 준수 확인: `e2e/playwright.config.ts`의 `@wvkit/react-example`, worklog/qa/CHANGELOG 역사 기록 미변경.

## 3. 주의사항

- AC-10/11 dist 스모크는 리포 내 three devDep 설치 상태에서만 유효 — B-02(three 정적 로드 제거)는 Sprint 4 범위로 이연 상태.
- react/vue TC-8/9는 패키지명이 아닌 `../index`(배럴 소스)를 import — 검증 목적은 충족하는 동등 구현으로 판정 (qa-report 관찰 1).
- git status에 남은 무관 변경(backlog.md, stable-input 테스트, vitest.config, camera-control.gestures.test.ts 등)은 이전 스프린트 미커밋 산출물 — 본 스프린트 인수 판정에 미포함. 커밋 시 스프린트별 분리 커밋 권장.
- CLAUDE.md는 gitignore 대상이라 diff에 나타나지 않음 — 이후 검증자도 파일 내용으로 확인할 것.
