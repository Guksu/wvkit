# Sprint 9 구현 — Vue 데모 배포 + 제로설치 샌드박스 + publint/attw 출하 게이트

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | implementer |
| 관련 경로 | packages/*/package.json, .github/workflows/{ci,deploy-demo}.yml, examples/sandboxes/, examples/vue-example/vite.config.ts, README.md, README.ko.md, biome.json, .changeset/20260710-demo-deploy-publint.md |

## 1. 개요

star-readiness 캠페인 Sprint 9 (B-16 + B-21). Vue 데모를 GitHub Pages 서브패스(`/wvkit/vue/`)로 배포 라인에 편입하고, published npm 패키지 기반 제로설치 샌드박스(StackBlitz/CodeSandbox) 2종과 README 링크를 추가했다. 동시에 `publint --strict` + `attw --pack --profile node16`을 CI 출하 게이트로 도입하고, RED였던 FalseESM(require 조건의 types가 `.d.ts`로 해석)을 exports 맵 조건부 분리로 GREEN 전환했다.

## 2. 작업내용

- TDD 순서 준수: 게이트 스크립트 먼저 추가해 RED 실측(publint exit 1: FalseESM error / attw exit 1: node16-from-CJS Masquerading as ESM) → exports 수정 → GREEN(exit 0).
- `packages/{core,react,vue}/package.json`: exports `.`·`./scroll-container`를 `import`/`require` 조건별 객체로 분리, require.types=`.d.cts` (tsup이 이미 생성 중 — 빌드 설정 변경 없음). 3패키지 patch changeset 작성.
- 루트 `package.json`: `lint:publint`/`lint:attw` 스크립트 + publint·@arethetypeswrong/cli devDeps. `.github/workflows/ci.yml`: Build 스텝 뒤 `Package gate (publint + attw)` 스텝.
- `examples/vue-example/vite.config.ts`: `base: '/wvkit/vue/'`. `deploy-demo.yml`: `site/vue/` 합성 추가 (루트=React, `/docs/`=문서, `/vue/`=Vue — 기존 진입로 불변).
- `examples/sandboxes/{react,vue}/`: 워크스페이스 밖 독립 샌드박스(각 5파일, published `@guksu/wvkit-*@^0.3.1`, PTR+StableInput 데모). README EN/KO에 Live Demo + Try it online(StackBlitz/CodeSandbox 4링크) 섹션.
- AC-01~AC-11 전부 exit 0 (상세: sprints/20260710-demo-deploy-publint/dev-notes.md).

## 3. 주의사항

- **published 0.3.1은 `./scroll-container` 분리 이전 산출물**이라 index.js가 three를 정적 임포트 → 샌드박스에 `three` dep을 추가해야 빌드됨(plan 편차, dev-notes 트레이드오프 1). 0.3.2 배포 후 제거 가능 — 후속 백로그 후보.
- biome에 `**/*.vue` override(noUnusedVariables/noUnusedImports off) 추가 — SFC template 사용을 biome이 못 보는 오탐 회피. Vue 스크립트의 미사용 변수는 이제 lint로 안 잡히므로 리뷰에서 확인 필요.
- 원격 검증(Pages `/wvkit/vue/` 실서빙, StackBlitz/CodeSandbox 실부팅)은 main 머지 후 수동 QA 항목.
- README의 샌드박스 링크는 main 브랜치 경로라 머지 전 404가 정상.
