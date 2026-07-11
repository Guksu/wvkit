# Sprint 9 계획 수립 — demo-deploy-publint (B-16 + B-21)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-demo-deploy-publint/plan.md |

## 1. 개요

star-readiness 백로그의 B-16(Vue 데모 서브패스 배포 + StackBlitz/CodeSandbox 제로설치 링크)과 B-21(CI에 publint + @arethetypeswrong/cli 게이트)을 Sprint 9로 계획했다. 근거는 audit-docs-dx.md P1(:25)·P2(:39). 인수조건은 전부 명령 + 기대 exit code로 기계 검증 가능하게 작성했다.

## 2. 작업내용

- 계획 산출: `docs/campaign/star-readiness/sprints/20260710-demo-deploy-publint/plan.md` — 태스크 6건(T-01~T-06), 인수조건 11건(AC-01~AC-11), 경계면 매핑 5행, 범위 제외 7건.
- 사전 실측(계획의 RED 근거 확보):
  - `pnpm dlx publint` @ packages/core → FalseESM warning 1건, 기본 exit 0 → 게이트는 `--strict` 필수로 명세.
  - `pnpm dlx @arethetypeswrong/cli --pack .` @ packages/core → node16(from CJS) Masquerading as ESM(2엔트리) + node10 서브패스 해석 실패 → `--profile node16` 게이트로 node10만 명시적 배제.
  - 3패키지 dist에 `.d.cts`가 이미 존재함을 확인 → 수정은 exports 맵 조건부 types 분리만으로 충분(빌드 설정 불변).
- 핵심 설계 결정:
  - 제로설치 링크는 기존 examples(`workspace:*` 의존)가 아닌 **published 패키지를 쓰는 독립 샌드박스** `examples/sandboxes/{react,vue}`로 — pnpm 워크스페이스 글롭(`examples/*` 직계) 밖에 배치해 turbo/lockfile 무영향.
  - 샌드박스 데모는 three peer가 불필요한 PullToRefresh + StableInput으로 한정.
  - Vue 데모는 `base: '/wvkit/vue/'` + deploy-demo.yml 합성 스텝 `site/vue/`로 기존 진입로(루트 React 데모, /docs) 불변 배포.
  - publint/attw는 루트 devDeps + 루트 스크립트(디렉토리 인자)로 실행해 `pnpm -r exec`의 bin PATH 의존을 회피.

## 3. 주의사항

- AC-07/AC-08은 TDD 순서 계약: T-06(게이트 스크립트) 먼저 추가해 RED(exit 1) 기록 → T-05(exports 수정) 후 GREEN. attw exit code 확인 시 파이프(`| tail`)가 exit code를 삼키므로 금지.
- exports 맵 수정은 3패키지 patch changeset 필수. 샌드박스는 `^0.3.1` 범위라 patch 릴리즈 후 자동 추종.
- 원격 검증(Pages `/wvkit/vue/`, StackBlitz 실부팅)은 main 머지 후에만 가능 — 머지 후 수동 QA로 이관(plan.md 범위 제외 참조).
- README 링크는 main 경로를 가리키므로 머지 전 404가 정상.
