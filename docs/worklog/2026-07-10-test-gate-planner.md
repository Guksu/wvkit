# Sprint 1 "테스트 게이트" 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-test-gate/plan.md |

## 1. 개요

star-readiness 품질 캠페인 Sprint 1(테스트 게이트)의 구현 계획을 작성했다. 대상은 백로그 B-01(CI e2e 잡), B-07(한글 IME Enter 가드 단위 테스트), B-20(커버리지 threshold) 3건으로, "CI가 e2e·커버리지를 지키게 만드는" 후속 스프린트 전제를 세우는 것이 목표다. 리더 지시에 따라 ci.yml·playwright.config·vitest.config 실물을 읽고 계획에 반영했으며, 인수조건을 기계 검증 가능한 명령+종료상태로 정의했다.

## 2. 작업내용

- `sprints/20260710-test-gate/plan.md` 생성 — 목표 / 태스크(T-01~T-03) / 인수조건(AC-01~AC-06) / 경계면 매핑 / 범위 제외 섹션.
- T-01(B-01): 기존 단일 `ci` 잡과 **병렬인 신규 `e2e` 잡** 설계. 브라우저는 `chromium webkit` 2종만 설치해 4 프로젝트(mobile-safari=webkit, mobile-chrome=chromium 엔진 재사용) 전부 커버. `pnpm build` 선행(react-example가 `@wvkit/*` dist 소비) → `pnpm test:e2e`(webServer가 `:4173` preview 기동) → 실패 시 `e2e/test-results/**`·`e2e/playwright-report/**` 아티팩트 업로드.
- T-02(B-07): `stable-input.ts:119` 가드(`isComposing || keyCode===229`) 대상 3케이스(isComposing/keyCode 미발화 + 정상 Enter 1회 발화) 단위 테스트 추가. happy-dom이 `isComposing`을 생성자에서 안 채울 수 있어 `Object.defineProperty` 주입 힌트 명시.
- T-03(B-20): **per-file glob threshold**(전역 아님) 결정 — 3파일 전부 core 소속이라 core vitest.config만 수정. 실측(camera-control branch 56.5% 등)보다 1~5%p 낮게 설정(55/80/85 branch, 90/85/75 func)해 즉시 통과. threshold는 `--coverage`일 때만 평가되므로 `ci` 잡에 `vitest run --coverage` 게이트 스텝 추가를 강제 메커니즘으로 명시.

## 3. 주의사항

- **B-20 강제 메커니즘 주의:** 현재 `pnpm test`는 커버리지 미수집 → threshold를 설정만 하면 무평가. 반드시 CI에 `--coverage` 경로를 별도 추가해야 게이트가 실효. AC-05(음성 검증: threshold를 99로 올려 exit 비0 확인 후 원복)로 실효성 확인 요구.
- **branch protection required check** 지정은 리포지토리 설정 영역(코드 밖) — 계획엔 명시하되 구현 산출물엔 미포함. 리더/사용자가 GitHub 설정에서 별도 처리 필요.
- CLAUDE.md와 어긋나는 요구 없었음. 실배포명(`@guksu/wvkit-*`) vs 문서상 `@wvkit/*` 불일치는 B-03(Sprint 3) 범위라 이번 계획에선 기존 스크립트 필터명(`@wvkit/react-example` 등 워크스페이스 내부명)을 그대로 사용.
- 스프린트 3건 = 한도 내, 분할 불필요.
