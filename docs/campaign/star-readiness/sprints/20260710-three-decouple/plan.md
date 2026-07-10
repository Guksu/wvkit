# Sprint 4 — three 분리 (three-decouple)

| 항목 | 내용 |
|------|------|
| 백로그 | B-02(three 정적 로드 제거) + B-13(destroy 후 scrollTo/zoomTo 가드 + 껍데기 단언 강화) |
| 근거 | audit-code-ci.md P0(:18 CJS 무가드 require) · P1(:26 ESM 정적 import), audit-unit-tests.md P1(:33 destroy 후 누수 + 껍데기 단언) |
| 브랜치 | chore/quality-sprint-1 (git 변경 명령은 사용자 전담) |
| 작성 | planner (2026-07-10) |

## 목표

1. **B-02**: `require('@guksu/wvkit-core')` 하는 CJS 소비자(three 미설치)가 **크래시 없이** StableInput 등 non-three 컴포넌트를 쓸 수 있게 한다. 현재 `dist/index.cjs:3`의 `var THREE = require('three')` 무가드가 optional peer 설계와 정면 충돌(audit-code P0). ESM 배럴의 정적 `import * as THREE`(P1 :26)도 동일 수정으로 함께 해소한다.
2. **B-13**: destroy 이후 `scrollTo`/`zoomTo`가 `activeIndex`/`zoom` 상태를 갱신하고 `onIndexChange`/`onZoomChange`를 발화하는 누수를 `destroyed` 가드로 차단하고, 이를 **의도적으로 단언 회피**하던 껍데기 테스트(`scroll-container.test.ts` "subsequent scrollTo/zoomTo after destroy are silent" — `not.toThrow()` only)를 명시적 단언으로 강화해 회귀를 고정한다.

## 설계 결정 (B-02): subpath export 분리 채택

백로그가 허용한 두 안 중 **subpath export 분리**를 채택한다.

| 기준 | 동적 `import()` 지연 로드 | **subpath 분리 (채택)** |
|------|--------------------------|------------------------|
| `create*` 동기 팩토리 컨벤션(CLAUDE.md) | 위반 — 팩토리가 async가 되거나 pending 파사드 필요 | 유지 |
| 기존 단위/통합 테스트(동기 생성 직후 display 단언 등) | 대규모 await 재작성 | 무변경 (소스 상대경로 import) |
| CJS/ESM 양쪽 결정적 해결 | CJS는 lazy require 가능하나 ESM 동기 로드 불가 → 비대칭 | 배럴에서 three 참조 자체가 사라짐 — 양쪽 결정적 |
| 소비자 영향 | 없음(경로 유지) | **breaking**: `createScrollContainer`/`useScrollContainer` import 경로 변경 |

- 새 공개 경로: `@guksu/wvkit-core/scroll-container`, `@guksu/wvkit-react/scroll-container`, `@guksu/wvkit-vue/scroll-container`.
- 배럴(`.`)에는 ScrollContainer **타입만** type-only re-export로 잔존(런타임 비용 0, react/vue 배럴의 기존 type re-export 호환 유지). 값 export는 subpath로만.
- breaking이므로 CLAUDE.md 규칙(1.0 이전 breaking은 minor + CHANGELOG 명시)에 따라 3패키지 **minor** changeset 동봉.
- **리더 확인 요청**: CLAUDE.md 컴포넌트 스펙의 import 샘플(`import { createScrollContainer } from "@wvkit/core"` — 배럴 기준)이 바뀌는 공개 API 변경이므로, 구현 착수 전 리더/사용자가 이 방향(subpath, minor bump)을 승인해야 한다. 반려 시 동적 import 안으로 재기획.

## 태스크

### T-01 (B-02) — 검증 하네스 선작성 (TDD red)

**신규**: `scripts/verify-three-decouple.mjs` (scripts/ 디렉토리 신설). `pnpm build` 후 실행을 전제로 다음을 검사하고 하나라도 실패하면 exit 1 + 실패 항목 메시지:

1. **CJS 격리 스모크**: `packages/core/dist/` 전체를 node_modules 없는 임시 디렉토리(`os.tmpdir()` 하위)로 복사 후 자식 node 프로세스로,
   - `require('<tmp>/index.cjs')` **성공** + `typeof m.createStableInput === 'function'` + `m.createScrollContainer === undefined` (배럴에서 값 제거 확인)
   - `require('<tmp>/scroll-container.cjs')`는 three 미해석으로 **실패해야 정상** (경계가 subpath에 있음을 증명)
2. **ESM 격리 스모크**: 같은 임시 디렉토리에서 `import(pathToFileURL('<tmp>/index.js'))` **성공** (청크 분리가 있어도 전이적으로 three 무참조임을 런타임으로 증명), `import('<tmp>/scroll-container.js')`는 three 미해석 실패.
3. **인리포 subpath 기능 확인** (three 해석 가능한 리포 안에서): `require('packages/core/dist/scroll-container.cjs')` 및 `import(...dist/scroll-container.js)` 모두 `typeof createScrollContainer === 'function'`.
4. **어댑터 external 보존**: `packages/react/dist/`·`packages/vue/dist/` 산출물에 문자열 `"three"`(모듈 지정자) 부재, `scroll-container.{js,cjs}`에 지정자 `@guksu/wvkit-core/scroll-container` 존재(코어 인라인 아님).

**red 확인**: 구현(T-02/T-03) 전 현재 dist에 대해 실행 → exit 1 이어야 한다(현 배럴이 three를 require — AC-1 전반부).

### T-02 (B-02) — core subpath 분리

- **신규** `packages/core/src/scroll-container.ts` (subpath 엔트리):
  ```ts
  export { createScrollContainer } from './components/scroll-container';
  export type {
    ScrollContainerDirection,
    ScrollContainerOptions,
    ScrollContainerInstance,
  } from './components/scroll-container';
  ```
- `packages/core/src/index.ts:10` — `export { createScrollContainer } ...` 값 export **제거**. 11-15행의 `export type { ScrollContainerDirection, ... }`는 유지(type-only는 dist에 런타임 흔적 없음 — verbatimModuleSyntax 활성).
- `packages/core/tsup.config.ts` — `entry: ['src/index.ts', 'src/scroll-container.ts']`. `external: ['three']` 유지(esbuild external은 서브패스 `three/examples/...`까지 포괄 — 현 빌드에서 기확인).
- `packages/core/package.json` `exports`에 추가:
  ```json
  "./scroll-container": {
    "types": "./dist/scroll-container.d.ts",
    "import": "./dist/scroll-container.js",
    "require": "./dist/scroll-container.cjs"
  }
  ```
- **신규 단위 테스트** `packages/core/src/__tests__/subpath-entry.test.ts` (public-api.test.ts와 동일 위치 규약):
  - TC-B02-1: `import { createScrollContainer } from '../scroll-container'` → `typeof === 'function'`
  - TC-B02-2: 배럴 `import * as barrel from '../index'` → `'createScrollContainer' in barrel === false` && `typeof barrel.createStableInput === 'function'`

### T-03 (B-02) — 소비자 경계면 이행 (어댑터·데모·문서·changeset)

- **react**: 신규 `packages/react/src/scroll-container.ts`(`export { useScrollContainer } from './components/scroll-container';`) / `packages/react/src/index.ts:6`의 값 export 제거(코어 배럴 기반 type re-export 블록은 유지) / `packages/react/src/components/scroll-container/use-scroll-container.ts:3-4`의 import를 `@guksu/wvkit-core/scroll-container`로 변경(타입 import는 코어 배럴·subpath 어느 쪽이든 가능 — subpath로 통일 권장) / `tsup.config.ts` `entry: ['src/index.ts', 'src/scroll-container.ts']` / `package.json` exports에 `./scroll-container` 추가 (external `'@guksu/wvkit-core'`는 esbuild가 서브패스까지 포괄하므로 항목 추가 불요 — AC-2의 스크립트 4번 검사로 실증).
- **vue**: react와 동일 4종 변경 (`packages/vue/src/{scroll-container.ts,index.ts}`, `packages/vue/src/components/scroll-container/use-scroll-container.ts:2`, `tsup.config.ts`, `package.json`).
- **데모**: `examples/react-example/src/ScrollContainerDemo.tsx:2` → `import { useScrollContainer } from '@guksu/wvkit-react/scroll-container'`. (vue-example은 ScrollContainer 미사용 — grep 기확인, 변경 없음.)
- **문서 4곳 import 샘플 갱신** (subpath 경로로): `docs/components/scroll-container/index.md`(:43/:73/:102) · `index.ko.md`(:43/:73/:102) · `README.md:188` · `README.ko.md:188` · CLAUDE.md ScrollContainer 스펙의 Core/React import 샘플.
- **changeset**: `.changeset/*.md` 1건 — `@guksu/wvkit-core`·`@guksu/wvkit-react`·`@guksu/wvkit-vue` 모두 **minor**, 본문에 breaking 명시("ScrollContainer는 `<pkg>/scroll-container` subpath로 이동 — three 미설치 CJS/ESM 소비자의 배럴 크래시 해소").

### T-04 (B-13) — destroy 후 scrollTo/zoomTo 가드 (TDD)

**테스트 먼저 강화 → red 확인 → 가드 구현 → green.**

- **테스트 강화**: `packages/core/src/components/scroll-container/__tests__/scroll-container.test.ts`의 기존 껍데기 테스트("subsequent scrollTo/zoomTo after destroy are silent", 현재 `not.toThrow()` 2건 + "implementation-defined" 주석)를 다음 3건의 명시적 단언으로 **교체**(기존 non-throw 단언은 TC-B13-1/2에 포함시켜 유지):
  - TC-B13-1: destroy 후 `sc.scrollTo(1)` → throw 없음 **그리고** `onIndexChange` 미발화(`toHaveBeenCalledTimes(0)`) **그리고** `sc.getActiveIndex() === 0`(불변) **그리고** 전 패널 `style.display === ''` 유지(재변형 없음)
  - TC-B13-2: destroy 후 `sc.zoomTo(2)` → throw 없음 **그리고** `onZoomChange` 미발화 **그리고** `sc.getZoom() === 1`(불변)
  - TC-B13-3: 가드가 정상 경로를 깨지 않음 — destroy **전** `scrollTo(1, { animated: false })` → `onIndexChange` 1회·`getActiveIndex()===1`, 이어서 destroy 후 `scrollTo(2)` → 호출 수 누적 **1회 유지**
- **red 근거**: 현 구현은 destroy 후에도 `activeIndex` 갱신 + `onIndexChange`/`onZoomChange` 발화 (`scroll-container.ts:220-243`에 `destroyed` 가드 부재) → TC-B13-1/2가 실패해야 한다.
- **구현**: `packages/core/src/components/scroll-container/scroll-container.ts`
  - `scrollTo`(:220) 첫 줄에 `if (destroyed) return;`
  - `zoomTo`(:235) 첫 줄에 `if (destroyed) return;`
  - `getActiveIndex`/`getZoom`은 읽기 전용이므로 가드 불요(마지막 상태 반환 유지). destroy 멱등 가드(:250)는 기존 그대로.

## 인수조건 (기계 검증 — 리포 루트 `/Users/kimjongmin/dev/wvkit`에서 실행)

TDD 게이트: AC-1a와 AC-13a(red)가 구현 **전** 확인되어야 하며, 나머지는 구현 **후** 전부 만족해야 완료.

| # | 명령 | 기대 |
|---|------|------|
| AC-1a (red) | T-02/T-03 이전: `pnpm build && node scripts/verify-three-decouple.mjs` | exit **1** (현 배럴 three 로드 검출) |
| AC-1b (green) | 구현 후: `pnpm build && node scripts/verify-three-decouple.mjs` | exit **0** (T-01의 검사 1~4 전부 통과) |
| AC-2 | `grep -E "require\((\"|')three" packages/core/dist/index.cjs` | exit **1** (무매치) |
| AC-3 | `grep -E "from\s*(\"|')three|import\((\"|')three" packages/core/dist/index.js` | exit **1** (무매치) |
| AC-4 | `node -e "const m=require('./packages/core/dist/scroll-container.cjs');process.exit(typeof m.createScrollContainer==='function'?0:1)"` | exit **0** |
| AC-5 | `pnpm typecheck` | exit **0** |
| AC-6 | `pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/__tests__/subpath-entry.test.ts \| grep -E "TC-B02-(1\|2)"` (테스트 타이틀에 TC ID 포함 규약) | exit **0** + 2건 통과 표기 |
| AC-7 | `pnpm --filter @guksu/wvkit-core build && pnpm --filter @guksu/wvkit-react build && pnpm --filter @guksu/wvkit-vue build && pnpm --filter @guksu/wvkit-react test && pnpm --filter @guksu/wvkit-vue test` | exit **0** (어댑터 테스트는 코어 dist의 exports 서브패스를 경유 — 코어 재빌드 선행 필수) |
| AC-8 | `pnpm test` (전 패키지 단위) | exit **0** |
| AC-9 | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` | exit **0** (기존 threshold — camera-control 81/92, ptr 80/85, stable-input 90/85 — 유지) |
| AC-10 | `pnpm --filter @wvkit/react-example build` (예제 name 필드는 구명칭 그대로 — Sprint 3 결정) | exit **0** |
| AC-11 | `pnpm test:e2e:chromium` | exit **0** (scroll-container smoke/gesture/api/lifecycle 포함 — 데모 subpath 이행 검증) |
| AC-12 | `ls .changeset/*.md \| grep -v README && grep -l "@guksu/wvkit-core" .changeset/*.md` | exit **0** (minor changeset 존재) |
| AC-13a (red) | 가드 구현 전: `pnpm --filter @guksu/wvkit-core exec vitest run src/components/scroll-container/__tests__/scroll-container.test.ts` | exit **1** (TC-B13-1/2 실패) |
| AC-13b (green) | 구현 후: `pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/components/scroll-container/__tests__/scroll-container.test.ts \| grep -E "TC-B13-(1\|2\|3)"` | exit **0** + 3건 통과 표기 (non-TTY 통과 타이틀은 --reporter=verbose 필수 — Sprint 1 교훈) |
| AC-14 | `grep -c "wvkit-core/scroll-container\|wvkit-react/scroll-container\|wvkit-vue/scroll-container" docs/components/scroll-container/index.md docs/components/scroll-container/index.ko.md README.md README.ko.md CLAUDE.md` 각 파일 ≥1 **그리고** `grep -rn "import { createScrollContainer } from '@guksu/wvkit-core';" docs README.md README.ko.md CLAUDE.md` | 전자 exit **0** / 후자 exit **1** (배럴 경로 샘플 잔존 0) |

## 경계면 매핑 (생산자 ↔ 소비자)

| 생산자 | 계약 | 소비자 | qa 교차검증 포인트 |
|--------|------|--------|--------------------|
| `packages/core/src/scroll-container.ts` (신규 엔트리) | `@guksu/wvkit-core/scroll-container` — `createScrollContainer` 값 + 타입 3종 | react/vue `use-scroll-container.ts`, 문서 Core 샘플 | AC-4/AC-6, 스크립트 검사 3 |
| `packages/core/src/index.ts` (배럴) | three 무참조 — 값은 non-three 5종 + `WebviewHeadlessError`, ScrollContainer는 **타입만** | three 미설치 CJS/ESM 소비자, react/vue 배럴의 type re-export | AC-1b(격리 스모크)/AC-2/AC-3, TC-B02-2 |
| `packages/react/src/scroll-container.ts` · `packages/vue/src/scroll-container.ts` | `@guksu/wvkit-{react,vue}/scroll-container` — `useScrollContainer` | `examples/react-example/src/ScrollContainerDemo.tsx`, 문서 React/Vue 샘플 | AC-7/AC-10/AC-14, 스크립트 검사 4(코어 인라인 방지) |
| 데모(react-example) | e2e 픽스처가 구동하는 UI 불변 (`e2e/fixtures/scroll-container.ts` — import 무관, 페이지 경유) | `e2e/specs/scroll-container.*.spec.ts` 4종 | AC-11 |
| `scroll-container.ts` `destroyed` 가드 | destroy 후 `scrollTo`/`zoomTo` 완전 no-op (상태·콜백·DOM 불변) | react/vue 어댑터 언마운트 후 명령형 메서드 호출(어댑터는 "마운트 전 noop" 계약과 대칭) | AC-13b (TC-B13-1~3) |

## 범위 제외

- publint / @arethetypeswrong/cli 검증 스텝 — **B-21** (신규 exports 서브패스가 생겼으므로 B-21 우선순위 상향을 리더에게 제안).
- 어댑터 rerender/StrictMode 테스트 실질화 — **B-09**. destroy 실효 단언 일반화(어댑터 언마운트) — **B-22**.
- CameraControl 트윈·ResizeObserver 잔여 커버 — **B-17**.
- 문서 사이트 실물화(VitePress) — **B-04**. 이번 문서 수정은 import 경로 문자열 치환에 한정.
- vue-example에 ScrollContainer 데모 추가, `direction: 'both'` 정식 지원, three peer 하한 재조정(B-12에서 `>=0.160.0` 기적용).
- 예제 패키지 리네이밍(`@wvkit/react-example` name 필드 유지 — Sprint 3 결정 승계).

## 리스크·주의

1. **breaking 승인 선행**: 설계 결정 절의 리더 확인(subpath + minor bump) 없이는 T-02 착수 금지.
2. **빌드 순서 의존**: 어댑터 단위 테스트·데모 빌드는 코어 dist exports 서브패스를 경유하므로 코어 빌드 선행(AC-7 명령 순서 준수). CI 순서는 turbo 의존 그래프가 보장하는지 implementer가 확인.
3. **tsup ESM 청크 분할**: 다중 엔트리 시 esm은 공용 청크(errors 등)가 생길 수 있음 — 문자열 grep(AC-2/3)만으로는 전이 참조를 놓칠 수 있어 격리 런타임 스모크(스크립트 검사 1~2)가 정본 판정.
4. **d.ts 배럴 잔존 타입**: 배럴의 type-only re-export가 `dist/index.d.ts`에서 scroll-container 타입 파일을 참조하는 것은 정상(런타임 무관). attw 검증은 B-21로 이연.
5. **coverage threshold**: 이번 변경은 threshold 3파일(camera-control/ptr/stable-input)을 건드리지 않음. `scroll-container.ts` 가드 2줄은 TC-B13이 즉시 커버.
