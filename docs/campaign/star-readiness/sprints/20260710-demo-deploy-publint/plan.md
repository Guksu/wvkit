# Sprint 9 — Vue 데모 배포 + 제로설치 링크 + 패키지 출하 게이트 (demo-deploy-publint)

| 항목 | 내용 |
|------|------|
| 슬러그 | 20260710-demo-deploy-publint |
| 백로그 | B-16 (M) + B-21 (S) |
| 근거 | B-16: audit-docs-dx.md P1(:25 — 데모 React 단독 배포·제로설치 링크 부재) / B-21: audit-docs-dx.md P2(:39 — publint·attw 자동 검증 부재) |
| 브랜치 | chore/quality-sprint-1 (git 변경 명령은 사용자 전담) |

## 사전 확인 완료 사실 (계획 근거 — planner가 2026-07-11에 실측)

1. **배포 구조**: deploy-demo.yml은 `site/`에 react 데모(루트) + docs(`site/docs/`)를 합성해 GitHub Pages로 배포. Vue 데모(`examples/vue-example`)는 빌드 스크립트·데모 6종이 이미 존재하나 **합성 스텝에 없음**(deploy-demo.yml:46-51). react는 `base: '/wvkit/'`, vue는 `base` 미설정(vite.config.ts 4-6행 — 플러그인만 존재).
2. **e2e 영향 없음**: e2e/playwright.config.ts는 react-example만 서빙(`BASE_URL=http://localhost:4173/wvkit/`, webServer 42행). vue base 변경은 e2e와 무관.
3. **StackBlitz 제약**: `examples/{react,vue}-example`은 `workspace:*` 의존이라 서브디렉토리 단독 임포트 시 npm 설치가 깨짐 → 제로설치 링크는 **published npm 패키지(`@guksu/wvkit-*@^0.3.1`)를 쓰는 독립 샌드박스**가 필요.
4. **워크스페이스 글롭**: pnpm-workspace.yaml은 `examples/*`(직계만). `examples/sandboxes/`에 package.json을 두지 않으면 그 하위 디렉토리는 워크스페이스 밖 → turbo/pnpm install/lockfile에 영향 없음.
5. **publint 실측 (RED 확인)**: `pnpm dlx publint` @ packages/core → Warning 1건: `exports["."].types`가 require 조건에서 ESM으로 해석됨(FalseESM). 기본 실행은 exit 0이므로 게이트로 쓰려면 **`--strict` 필수**(warning→error 승격 → 현재 exit 1). 부수 Suggestion 2건(engines.node, repository.url `git+` 접두)은 --strict에 영향 없음.
6. **attw 실측 (RED 확인)**: `pnpm dlx @arethetypeswrong/cli --pack .` @ packages/core → ① `node16 (from CJS)`: 👺 Masquerading as ESM (`.`·`./scroll-container` 모두) ② `node10`: 💀 서브패스 `./scroll-container` 해석 실패. 문제 발견 시 attw는 exit 1 (파이프로 가리지 말 것 — `| tail`은 exit code를 삼킨다).
7. **수정 재료는 이미 존재**: 3패키지 모두 tsup이 `dist/index.d.cts`·`dist/scroll-container.d.cts`를 생성 중(ls 확인) — exports 맵만 조건부 types로 분리하면 됨. 코드/빌드 설정 변경 불필요.
8. README.ko.md 존재(EN 변경 시 KO 미러 필수). docs 사이트 nav의 Demo 링크는 react 데모만 가리킴(docs/.vitepress/config.ts:30).

## 목표

1. **B-16**: Vue 데모를 GitHub Pages 서브패스 `https://guksu.github.io/wvkit/vue/`로 배포하고, README(EN/KO)에 StackBlitz/CodeSandbox 제로설치 링크 + Vue 데모 링크를 추가한다.
2. **B-21**: `publint --strict` + `attw --pack --profile node16`을 CI 게이트로 도입하고, 현재 RED인 FalseESM(3패키지)을 exports 맵 조건부 types 분리로 GREEN 전환한다(TDD: 게이트 먼저 → 수정 → 통과).

## 태스크

### T-01 (B-16) — Vue 데모 서브패스 빌드

| 파일 | 변경 |
|------|------|
| `examples/vue-example/vite.config.ts` | `defineConfig`에 `base: '/wvkit/vue/'` 추가 (react-example의 `base: '/wvkit/'` 패턴과 동일) |

**완료 기준:** AC-01 exit 0. react 데모·docs의 기존 base는 변경하지 않는다.

### T-02 (B-16) — deploy-demo.yml 합성 스텝에 Vue 서브패스 추가

| 파일 | 변경 |
|------|------|
| `.github/workflows/deploy-demo.yml` | "Compose site" 스텝에 `mkdir -p site/vue` + `cp -R examples/vue-example/dist/. site/vue/` 추가 (`site/docs/` 합성과 동일 패턴, `/docs`·루트와 경로 충돌 없음). vue-example 빌드는 기존 `pnpm build`(turbo)가 이미 수행하므로 별도 빌드 스텝 불필요 |

**완료 기준:** AC-02 exit 0. 배포 URL 계약: 루트=React 데모, `/docs/`=문서, `/vue/`=Vue 데모 (기존 진입로 불변).

### T-03 (B-16) — 제로설치 샌드박스 2종 (워크스페이스 밖, published 패키지 사용)

**신규 디렉토리 (각 4~5파일, `examples/sandboxes/`에는 package.json을 두지 않는다 — 사전 확인 4):**

```
examples/sandboxes/react/   package.json, index.html, vite.config.ts, src/main.tsx, src/App.tsx
examples/sandboxes/vue/     package.json, index.html, vite.config.ts, src/main.ts, src/App.vue
```

- **의존성은 npm published 버전만**: `@guksu/wvkit-react@^0.3.1`(react 샌드박스) / `@guksu/wvkit-vue@^0.3.1`(vue 샌드박스) + react/react-dom 또는 vue + vite + 해당 플러그인. `workspace:*` 금지(StackBlitz 서브디렉토리 임포트가 깨지는 원인 — 사전 확인 3). `private: true`.
- **데모 콘텐츠**: three peer가 필요 없는 컴포넌트로 한정 — `PullToRefresh` + `StableInput` 최소 데모 1화면 (ScrollContainer는 three 설치가 필요해 제로설치 취지에 어긋남 → 제외).
- **코드 컨벤션**: named export 규칙은 앱 엔트리 특성상 App 컴포넌트에 한해 기존 examples/* 관례를 따른다. `vite.config.ts` default export는 biome 기존 override(`**/vite.config.ts`)가 이미 허용.
- `.gitignore`에 `examples/sandboxes/*/package-lock.json` 추가 (npm 로컬 검증 부산물 미커밋 — StackBlitz는 매회 fresh install이라 lockfile 불필요).

**완료 기준:** AC-03, AC-04, AC-05 exit 0.

### T-04 (B-16) — README(EN/KO) 데모·제로설치 링크

| 파일 | 변경 |
|------|------|
| `README.md` | ① 기존 Demo 배지 근처(또는 Demo 섹션)에 Vue 데모 링크 `https://guksu.github.io/wvkit/vue/` 추가 ② "Try it online" 항목: StackBlitz `https://stackblitz.com/github/Guksu/wvkit/tree/main/examples/sandboxes/react`(react) / `.../sandboxes/vue`(vue), CodeSandbox `https://codesandbox.io/p/sandbox/github/Guksu/wvkit/tree/main/examples/sandboxes/react`(react) / `.../vue`(vue) |
| `README.ko.md` | 동일 내용 KO 미러 |

- 링크는 main 브랜치 경로를 가리키므로 **머지 전에는 404가 정상** — 원격 실동작 확인은 머지 후 수동 QA(주의사항 참조).

**완료 기준:** AC-06 exit 0.

### T-05 (B-21) — exports 맵 조건부 types 분리 (RED→GREEN의 GREEN 절반)

| 파일 | 변경 |
|------|------|
| `packages/core/package.json` | `exports`의 `.`·`./scroll-container` 각각을 조건별 객체로 분리 (아래 형태) |
| `packages/react/package.json` | 동일 (`.`·`./scroll-container`) |
| `packages/vue/package.json` | 동일 (`.`·`./scroll-container`) |
| `.changeset/*.md` | 3패키지 patch changeset — "fix exports map: split CJS types to .d.cts (attw FalseESM)" |

```json
".": {
  "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
},
"./scroll-container": {
  "import": { "types": "./dist/scroll-container.d.ts", "default": "./dist/scroll-container.js" },
  "require": { "types": "./dist/scroll-container.d.cts", "default": "./dist/scroll-container.cjs" }
}
```

- `.d.cts`는 이미 tsup이 생성 중(사전 확인 7) — tsup.config·소스 변경 없음. 최상위 `main`/`module`/`types` 필드는 node10/레거시 툴 폴백용으로 유지.
- node10에서 서브패스 `./scroll-container` 해석 실패는 **수정하지 않는다**(물리 프록시 파일 필요 — 과잉). 대신 attw를 `--profile node16`으로 실행해 node10 전용 문제를 게이트에서 제외한다(범위 제외 참조).

**완료 기준:** AC-07, AC-08이 이 태스크 이후 exit 0으로 전환. AC-10(기존 스위트 회귀 없음) 유지.

### T-06 (B-21) — publint + attw 도입 및 CI 게이트

| 파일 | 변경 |
|------|------|
| `package.json` (루트) | devDependencies 추가: `publint`(실측 v0.3.21 기준 ^0.3.x), `@arethetypeswrong/cli`(최신 안정 ^0.x). scripts 추가: `"lint:publint": "publint --strict packages/core && publint --strict packages/react && publint --strict packages/vue"`, `"lint:attw": "attw --pack packages/core --profile node16 && attw --pack packages/react --profile node16 && attw --pack packages/vue --profile node16"` — 루트에서 디렉토리 인자로 실행(루트 bin 사용, `pnpm -r exec`의 PATH 의존 회피) |
| `pnpm-lock.yaml` | `pnpm install`로 갱신 — 이후 `--frozen-lockfile` 통과 필수 |
| `.github/workflows/ci.yml` | `ci` 잡의 `Build` 스텝 뒤(Test 앞 또는 뒤 무방, dist 필요하므로 Build 이후 필수)에 스텝 추가: `- name: Package gate (publint + attw)` / `run: pnpm lint:publint && pnpm lint:attw` |

- publint·attw 모두 dist를 검사하므로 **Build 이후** 실행이 계약. attw `--pack`은 로컬 `npm pack`만 수행(레지스트리 불필요).
- **TDD 순서**: T-06의 스크립트를 먼저 추가해 AC-07/AC-08의 RED(exit 1)를 기록 → T-05 적용 → GREEN(exit 0) 확인.

**완료 기준:** AC-07~AC-09 exit 0.

## 인수조건 (전부 리포 루트 기준, 명령 exit code로 판정)

### B-16

| ID | 명령 | 기대 |
|----|------|------|
| AC-01 | `pnpm --filter @wvkit/vue-example build && grep -q '/wvkit/vue/assets/' examples/vue-example/dist/index.html` | exit 0 (빌드 산출물의 자산 경로가 서브패스를 가리킴) |
| AC-02 | `grep -q 'site/vue' .github/workflows/deploy-demo.yml && grep -q 'examples/vue-example/dist' .github/workflows/deploy-demo.yml` | exit 0 |
| AC-03 | `cd examples/sandboxes/react && npm install --no-audit --no-fund && npm run build` | exit 0 (published 패키지만으로 독립 빌드 — 네트워크 필요) |
| AC-04 | `cd examples/sandboxes/vue && npm install --no-audit --no-fund && npm run build` | exit 0 |
| AC-05 | `pnpm -r exec pwd \| grep -q sandboxes; test $? -eq 1` | exit 0 (샌드박스가 pnpm 워크스페이스에 편입되지 않음) |
| AC-06 | `for f in README.md README.ko.md; do grep -q 'stackblitz.com/github/Guksu/wvkit/tree/main/examples/sandboxes' $f && grep -q 'codesandbox.io' $f && grep -q 'guksu.github.io/wvkit/vue/' $f || exit 1; done` | exit 0 |

### B-21

| ID | 명령 | 기대 |
|----|------|------|
| AC-07 | `pnpm build && pnpm lint:publint` | **T-05 이전 exit 1**(FalseESM warning → --strict로 error) / **T-05 이후 exit 0** |
| AC-08 | `pnpm lint:attw` | **T-05 이전 exit 1**(node16-from-CJS Masquerading as ESM) / **T-05 이후 exit 0**. 주의: exit code 확인 시 파이프(`\| tail` 등) 금지 |
| AC-09 | `grep -q 'lint:publint' .github/workflows/ci.yml && grep -q 'lint:attw' .github/workflows/ci.yml && ls .changeset/*.md \| grep -qv README` | exit 0 (CI 게이트 + 3패키지 patch changeset 존재) |

### 공통 회귀 게이트

| ID | 명령 | 기대 |
|----|------|------|
| AC-10 | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm --filter @guksu/wvkit-core exec vitest run --coverage` | exit 0 (lockfile 정합 + 기존 게이트 전부 그린 — 커버리지 threshold 포함) |
| AC-11 | `pnpm test:e2e:chromium` | exit 0 (vue base·exports 변경이 react 데모 기반 e2e를 깨지 않음) |

## 경계면 매핑 (생산자 ↔ 소비자)

| 생산자 | 산출 | 소비자 | 계약 |
|--------|------|--------|------|
| T-01 vue-example 빌드 (`base: '/wvkit/vue/'`) | `examples/vue-example/dist` | T-02 deploy-demo.yml 합성 스텝 → GitHub Pages `/wvkit/vue/` | 자산 URL이 `/wvkit/vue/assets/*` — 합성 경로 `site/vue/`와 일치해야 함 (AC-01·AC-02) |
| T-03 샌드박스 (npm published 의존) | `examples/sandboxes/{react,vue}` | T-04 README의 StackBlitz/CodeSandbox 링크 → 외부 방문자 | 링크 경로 = 디렉토리 경로 문자열 일치. `workspace:*` 금지 계약 (AC-03~AC-06) |
| npm 레지스트리 `@guksu/wvkit-*@^0.3.1` | 설치 가능한 패키지 | T-03 샌드박스 | T-05의 exports 수정은 patch 릴리즈 후에야 샌드박스에 반영 — `^` 범위라 자동 추종 |
| T-05 exports 맵 (packages/*/package.json) | `import`/`require` 조건별 types | node16 CJS/ESM 소비자 + T-06 게이트 | require 조건의 types는 반드시 `.d.cts` (AC-07·AC-08) |
| T-06 루트 scripts (`lint:publint`/`lint:attw`) | 패키지 출하 게이트 | `.github/workflows/ci.yml` ci 잡 | 반드시 Build 스텝 이후 실행(dist 검사) (AC-09) |

## 범위 제외

- **node10 서브패스 해석**: attw `node10`에서 `./scroll-container` 해석 실패는 물리 프록시 파일/typesVersions가 필요해 제외 — `--profile node16` 게이트로 명시적 배제. 필요 시 별도 백로그로.
- **publint Suggestion 2건**(engines.node 부재, repository.url `git+` 접두): --strict에 걸리지 않음. engines.node는 semver 상 breaking 가능성이 있어 이번 스프린트에서 다루지 않음.
- **docs 사이트 nav에 Vue 데모 링크 추가**(docs/.vitepress/config.ts): B-16 본질이 아니고 docs 스프린트 산출물 블라스트 반경 최소화를 위해 제외. 후속 소규모 작업으로.
- **examples/{react,vue}-example의 StackBlitz화**: `workspace:*` 구조상 불가(사전 확인 3) — 기존 데모 앱은 손대지 않는다.
- **README 히어로 GIF**: B-14a(보류) 소관.
- **deploy-demo.yml `paths:` 필터**: B-25 소관.
- **원격 배포 URL(`/wvkit/vue/`)·StackBlitz 실부팅 검증**: main 머지 + Pages 배포 후에만 가능 — 머지 후 수동 QA 항목 (qa에게 이관).

## qa 교차검증 입력

1. AC-01~AC-11을 순서대로 실행하고 exit code를 기록할 것 (AC-07·AC-08은 GREEN 상태만 확인하면 됨 — RED 증빙은 implementer의 dev-notes 몫).
2. exports 맵 3패키지 6엔트리(`.`/`./scroll-container` × core/react/vue)가 모두 동일한 조건부 구조인지 육안 대조.
3. 샌드박스 package.json에 `workspace:` 문자열이 없는지: `grep -r 'workspace:' examples/sandboxes/` → 무결과(exit 1) 확인.
4. vitest 검증 시 non-TTY 리포터 함정 주의(Sprint 1 교훈): grep 기반 확인은 `--reporter=verbose`.
