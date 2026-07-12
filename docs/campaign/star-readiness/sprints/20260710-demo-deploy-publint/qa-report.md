# qa-report — Sprint 9 (20260710-demo-deploy-publint)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | qa |
| 브랜치 | sprint/20260710-demo-deploy-publint |
| 판정 | **전 항목 PASS (11/11 AC + 교차검증 4항목)** — FAIL 0건 |

모든 AC는 리포 루트에서 직접 재실행해 exit code로 판정했다 (LLM 판정 아님).

## 인수조건 판정

### B-16

| ID | 판정 | exit | 비고 |
|----|------|------|------|
| AC-01 | [PASS] | 0 | `pnpm --filter @wvkit/vue-example build` 성공, dist/index.html 자산 경로 `/wvkit/vue/assets/index-YthJN_nO.js` 확인 |
| AC-02 | [PASS] | 0 | deploy-demo.yml에 `site/vue` + `examples/vue-example/dist` 존재. 육안 대조: Compose 스텝이 `mkdir -p site/vue` → `cp -R examples/vue-example/dist/. site/vue/`, 선행 `Build packages and demo`(pnpm build=turbo)가 vue-example 빌드를 포함함(AC-07 turbo 스코프에서 확인) — Build→Compose 순서 계약 충족 |
| AC-03 | [PASS] | 0 | react 샌드박스 npm install + vite build 성공 (152.2KB / gzip 49.3KB). **추가 검증**: 스크래치패드에서 node_modules·package-lock 없이 완전 프레시 install+build 재현 → exit 0 (StackBlitz fresh-install 시나리오 등가) |
| AC-04 | [PASS] | 0 | vue 샌드박스 동일 (70.9KB / gzip 27.9KB). 프레시 재현도 exit 0 |
| AC-05 | [PASS] | 0 | `pnpm -r exec pwd`에 sandboxes 미출현 — 워크스페이스 밖 확인 |
| AC-06 | [PASS] | 0 | README.md·README.ko.md 양쪽에 StackBlitz/CodeSandbox/Vue 데모 링크 존재. 링크 경로 4종이 실제 디렉토리 `examples/sandboxes/{react,vue}`와 문자열 일치 |

### B-21

| ID | 판정 | exit | 비고 |
|----|------|------|------|
| AC-07 | [PASS] | 0 | `pnpm build && pnpm lint:publint` — publint v0.3.21, 3패키지 모두 --strict GREEN (잔존 Suggestion 2건은 plan 범위 제외 그대로). RED 증빙은 dev-notes 소관(기록됨) |
| AC-08 | [PASS] | 0 | `pnpm lint:attw` 파이프 없이 실행 — 3패키지 × `.`/`./scroll-container` 모두 node16(CJS/ESM)·bundler 🟢. node10은 `(ignoring resolutions: 'node10')`으로 게이트에서 명시적 제외 확인 |
| AC-09 | [PASS] | 0 | ci.yml에 lint:publint·lint:attw + changeset 존재 |

### 공통 회귀 게이트

| ID | 판정 | exit | 비고 |
|----|------|------|------|
| AC-10 | [PASS] | 0 | frozen-lockfile("Lockfile is up to date") / biome lint 145 files / typecheck / build / test 전 패키지 / core coverage(전 스위트 통과, threshold GREEN — camera-control·ptr·stable-input 하한 모두 상회: Stmts 99.05%) |
| AC-11 | [PASS] | 0 | chromium 54 passed, 4 skipped(virtual-keyboard mobile-only) — vue base·exports 변경의 react e2e 회귀 없음 |

## 교차검증 (plan "qa 교차검증 입력" 4항목)

| # | 판정 | 내용 |
|---|------|------|
| 1 | [PASS] | AC-01~AC-11 순서대로 전부 직접 재실행, exit code 위 표에 기록 |
| 2 | [PASS] | exports 6엔트리(core/react/vue × `.`/`./scroll-container`) JSON 덤프로 대조 — **6엔트리 모두 완전 동일 구조**(import.types=`.d.ts`/require.types=`.d.cts`), 최상위 main/module/types 폴백 3패키지 동일 유지 |
| 3 | [PASS] | `grep -r 'workspace:' examples/sandboxes/*/package.json` → 무결과 exit 1 (dev-notes 편차 3의 보정 명령 사용 — node_modules 오탐 회피). package-lock의 wvkit 패키지 resolved가 `registry.npmjs.org/...-0.3.1.tgz`임도 확인 (published만 사용) |
| 4 | [PASS] | 이번 스프린트는 신규 단위 테스트 없음(인프라/설정 스프린트) — 껍데기 테스트 판정 대상 부재. 게이트 자체(publint --strict·attw)가 load-bearing임은 dev-notes의 RED 증빙(T-05 이전 양쪽 exit 1)으로 성립 |

## 경계면 교차검증 (생산자↔소비자, 소스 대조)

| 경계면 | 판정 | 근거 |
|--------|------|------|
| vue-example base → Pages 합성 | [PASS] | vite.config.ts `base: '/wvkit/vue/'` ↔ dist 자산 URL `/wvkit/vue/assets/*` ↔ deploy-demo.yml `site/vue/` 3자 일치 |
| 샌드박스 → published API | [PASS] | 소비자 shape을 **설치된 published 0.3.1의 d.ts와 직접 대조**: react `usePullToRefresh` 반환 `{containerRef, state, distance, progress, trigger, setEnabled}` = App.tsx 구조분해와 일치, `useStableInput` 반환 spread ⊇ `StableInputDisplay` props(`containerRef, className, style`), vue `useStableInput().containerRef`(Ref) = App.vue 템플릿 ref 일치 |
| 샌드박스 three dep (plan 편차 1) | [PASS] | published 0.3.1 dist가 three를 정적 임포트하므로 dependency 필요 — 타당한 편차. 번들 152KB로 three 미포함(treeshake) 확인. 0.3.2 배포 후 제거는 후속 백로그 후보로 dev-notes에 기록됨 |
| exports 맵 → 게이트 → ci.yml | [PASS] | ci.yml에서 `Package gate (publint + attw)` 스텝이 Build 스텝 직후 배치 — dist 검사 계약 충족 |
| changeset → 0.3.2 → 샌드박스 `^0.3.1` | [PASS] | .changeset/20260710-demo-deploy-publint.md에 3패키지 patch 선언 확인 |

## 컨벤션 점검

- **named export**: App.tsx는 `export function App()`(named), main.tsx·main.ts는 엔트리, App.vue SFC default는 Vue 관례, vite.config default export는 biome 기존 override 허용 — 위반 없음.
- **인라인 스타일**: 샌드박스 App의 `style={{opacity, transform}}`은 데모 앱 코드(라이브러리 패키지 아님)이며 기존 examples/react-example에 동일 패턴 다수 존재 — 라이브러리 컨벤션 비대상.
- **biome `**/*.vue` override (plan 편차 2)**: biome 1.9의 SFC template 미인식 오탐 회피 목적, `.vue` 한정 2규칙만 off — 블라스트 반경 최소. `pnpm lint` GREEN.
- **.gitignore**: `examples/sandboxes/*/package-lock.json` 추가 확인. dist/node_modules는 기존 패턴 커버.

## 미해결 / 이관 항목 (FAIL 아님 — 로컬 검증 불가)

1. **머지 후 수동 QA**: GitHub Pages `https://guksu.github.io/wvkit/vue/` 실서빙 + StackBlitz/CodeSandbox 4링크 실부팅 (README 링크는 main 경로라 머지 전 404 정상 — plan 명시).
2. **후속 백로그 후보**: 0.3.2 publish 후 샌드박스 `three` dependency 제거 (dev-notes 편차 1).
