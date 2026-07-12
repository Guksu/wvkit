# dev-notes — Sprint 9 (20260710-demo-deploy-publint)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | implementer |
| 브랜치 | sprint/20260710-demo-deploy-publint |

## 변경 파일

### B-21 (publint + attw 게이트, exports 맵)

| 파일 | 변경 |
|------|------|
| `package.json` (루트) | devDeps `publint@^0.3.21`, `@arethetypeswrong/cli@^0.18.5` 추가. scripts `lint:publint`, `lint:attw` 추가 |
| `pnpm-lock.yaml` | `pnpm install`로 갱신 (`--frozen-lockfile` 통과 확인) |
| `packages/core/package.json` | exports `.`·`./scroll-container`를 import/require 조건별 객체로 분리 (require.types → `.d.cts`) |
| `packages/react/package.json` | 동일 |
| `packages/vue/package.json` | 동일 |
| `.github/workflows/ci.yml` | Build 스텝 뒤 `Package gate (publint + attw)` 스텝 추가 |
| `.changeset/20260710-demo-deploy-publint.md` | 3패키지 patch changeset |

### B-16 (Vue 데모 배포 + 제로설치 링크)

| 파일 | 변경 |
|------|------|
| `examples/vue-example/vite.config.ts` | `base: '/wvkit/vue/'` 추가 |
| `.github/workflows/deploy-demo.yml` | Compose 스텝에 `mkdir -p site/vue` + `cp -R examples/vue-example/dist/. site/vue/` 추가 |
| `examples/sandboxes/react/` (신규 5파일) | package.json / index.html / vite.config.ts / src/main.tsx / src/App.tsx — PTR + StableInput 데모, published `@guksu/wvkit-react@^0.3.1` |
| `examples/sandboxes/vue/` (신규 5파일) | package.json / index.html / vite.config.ts / src/main.ts / src/App.vue — 동일 구성, `@guksu/wvkit-vue@^0.3.1` |
| `README.md` | "Live Demo" 섹션 (Vue 데모 링크 + StackBlitz/CodeSandbox 4링크) |
| `README.ko.md` | 동일 KO 미러 ("라이브 데모") |
| `.gitignore` | `examples/sandboxes/*/package-lock.json` 추가 |
| `biome.json` | `**/*.vue` override 추가 — `noUnusedVariables`/`noUnusedImports` off (아래 트레이드오프 2) |

## AC별 결과 (2026-07-11 로컬 실행, 전부 exit code 실측)

| AC | 결과 | 비고 |
|----|------|------|
| AC-01 | PASS (0) | vue-example dist index.html에 `/wvkit/vue/assets/` 확인 |
| AC-02 | PASS (0) | |
| AC-03 | PASS (0) | npm install + vite build — 산출 152KB(gzip 49KB), three 코드 treeshake됨 |
| AC-04 | PASS (0) | 산출 71KB(gzip 28KB) |
| AC-05 | PASS (0) | `pnpm -r exec pwd`에 sandboxes 미출현 |
| AC-06 | PASS (0) | EN/KO 양쪽 |
| AC-07 | RED→GREEN | **RED 증빙**: T-05 이전 `pnpm lint:publint` exit 1 — `pkg.exports["."].types is interpreted as ESM when resolving with the "require" condition` (core에서 즉시 실패). T-05 이후 exit 0 |
| AC-08 | RED→GREEN | **RED 증빙**: T-05 이전 `pnpm lint:attw` exit 1 — `node16 (from CJS): 👺 Masquerading as ESM` (`.`·`./scroll-container` 모두, node10은 ignored 표시 확인). T-05 이후 exit 0 |
| AC-09 | PASS (0) | ci.yml 게이트 + changeset 존재 |
| AC-10 | PASS (0) | frozen-lockfile / lint / typecheck / build / test(전 패키지) / core coverage(16 files·265 tests, threshold 통과) 모두 exit 0 |
| AC-11 | PASS (0) | chromium 54 passed, 4 skipped |

## 생산자↔소비자 매핑 (plan의 경계면 표 + 실측 보정)

- vue-example `base:'/wvkit/vue/'` → dist 자산 URL `/wvkit/vue/assets/*` → deploy-demo.yml `site/vue/` 합성과 일치 (AC-01·AC-02 상호 검증됨).
- sandboxes package.json(published 의존) → README EN/KO의 StackBlitz/CodeSandbox 링크 경로와 디렉토리 문자열 일치 (`examples/sandboxes/{react,vue}`).
- packages/*/package.json exports(require.types=`.d.cts`) → `lint:publint`/`lint:attw` 스크립트 → ci.yml Build 이후 스텝. 6엔트리(core/react/vue × `.`·`./scroll-container`) 모두 동일 구조.
- changeset(3패키지 patch) → 다음 릴리즈(0.3.2)에서 published 패키지에 exports 수정 반영 → 샌드박스 `^0.3.1`이 자동 추종.

## 트레이드오프 / plan 대비 편차 (qa 필독)

1. **샌드박스에 `three@^0.184.0` dependency 추가 (plan 미기재 편차)** — published `@guksu/wvkit-core@0.3.1`은 `./scroll-container` 서브패스 분리 **이전** 산출물이라 `dist/index.js` 1행에서 `import * as THREE from 'three'`를 정적 임포트함(로컬 HEAD dist와 다름). three 없이는 vite build가 `"Scene" is not exported by __vite-optional-peer-dep` 오류로 실패(AC-03 최초 실행에서 exit 1 실측). 데모 콘텐츠는 계획대로 PTR+StableInput만이며 three 코드는 번들에서 treeshake됨. **0.3.2(서브패스 분리 포함) 배포 후 three dep 제거 가능 — 후속 백로그 후보.**
2. **biome.json `**/*.vue` override 추가** — biome 1.9는 SFC `<template>`의 변수 사용을 인식 못해 `<script setup>` 변수가 전부 noUnusedVariables 오탐(6건). `.vue` 한정으로 두 규칙만 off. 기존 vue-example App.vue는 script 없는 5줄짜리라 그동안 미노출.
3. **qa 교차검증 입력 3번 명령 보정** — `grep -r 'workspace:' examples/sandboxes/`는 npm install 후 node_modules 내부 서드파티 메타데이터에 걸림. `grep -r 'workspace:' examples/sandboxes/*/package.json`으로 실행할 것 (실측: 무결과 exit 1 확인).
4. publint Suggestion 2건(engines.node, repository.url `git+`)은 --strict 비대상 — plan의 범위 제외 그대로 잔존.
5. 샌드박스 `npm run build` 산출물(`examples/sandboxes/*/dist`, `node_modules`)은 기존 `.gitignore`의 `dist/`·`node_modules/`로 커버, `package-lock.json`만 신규 항목으로 추가.

## 실행한 검증 명령 요약

- RED: `pnpm lint:publint`(exit 1), `pnpm lint:attw`(exit 1) — T-05 이전
- GREEN: AC-01~AC-11 전부 exit 0 (위 표)
- 원격 검증 불가 항목(머지 후 수동 QA로 이관): GitHub Pages `/wvkit/vue/` 실서빙, StackBlitz/CodeSandbox 실부팅
