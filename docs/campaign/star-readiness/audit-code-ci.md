# 감사 보고서 — 코어 코드 품질 · 빌드/CI · 릴리즈 (star-readiness)

> 대상: `@guksu/wvkit-{core,react,vue}` v0.3.1 · 감사일 2026-07-10

**요약 (5줄)**
- `pnpm build` / `pnpm typecheck` / `biome lint` 모두 통과. gzip 예산 양호(core ESM 35.98KB, react 5.79KB, vue 5.10KB), three는 external 처리 확인.
- destroy 패턴·SSR 가드·리스너/RAF/Observer 해제·옵션 불변성(ref/setup 고정)은 6개 컴포넌트 전반에서 견고. React/Vue 어댑터의 stale-closure 회피도 일관.
- **P0 1건**: CJS 번들이 `three`를 무조건 `require` → three 없이 StableInput 등만 쓰는 CJS 소비자가 런타임 크래시(optional peer 설계와 모순).
- **P1 5건**: `WebviewHeadlessError` 타입-only export(런타임 catch 불가), ESM 배럴 정적 three import, CI에 e2e 부재, tsup external 패키지명 오기, three peer 범위 과도하게 협소.
- **P2 6건**: 무효 biome 억제 주석, 마운트 후 non-callback prop 미반영, 불필요 react-dom peer 등 정리 항목.

발견: **P0 × 1 · P1 × 5 · P2 × 6**

---

## P0

- [P0] CJS 진입점이 `three`를 무조건 로드해 three 없는 소비자를 크래시시킴 — `packages/core/dist/index.cjs:3` (`var THREE = require('three');` 최상단 무가드), 원인 소스 `packages/core/src/components/scroll-container/scroll-container.ts:1-2`. 배럴(`src/index.ts`)이 `createScrollContainer`를 재노출하므로, `require('@guksu/wvkit-core')`로 `createStableInput` 하나만 쓰려는 CJS/WebView 번들러도 `three`를 즉시 require → `three`가 `peerDependenciesMeta.optional:true`인 설계("런타임 의존성 최소화")와 정면 충돌. ESM은 `sideEffects:false`로 소비자 번들러가 트리셰이크할 여지가 있으나 CJS는 확정적으로 깨짐. / 제안: `createScrollContainer` 내부에서 `three`/`CSS3DRenderer`를 동적 `import()`로 지연 로드하거나, ScrollContainer를 별도 subpath export(`@guksu/wvkit-core/scroll-container`)로 분리해 배럴에서 정적 참조 제거. / 규모: L

---

## P1

- [P1] `WebviewHeadlessError`가 타입 전용으로 export됨 — `packages/core/src/index.ts:1` (`export type { WebviewHeadlessError }`). 코어는 이 클래스를 런타임에 `throw`(scroll-container.ts, pull-to-refresh.ts)하지만 소비자는 값이 아닌 타입만 받으므로 `err instanceof WebviewHeadlessError` / 클래스 기반 catch가 불가능. 문서·컨벤션이 "설명적 에러 throw"를 표방하는데 소비자가 이를 식별할 수단이 없음. / 제안: `export { WebviewHeadlessError } from './errors';` 값 export로 변경(타입은 자동 동반). react/vue 배럴에서도 재노출 검토. / 규모: S

- [P1] ESM 배럴이 `three`를 정적 import — `packages/core/src/components/scroll-container/scroll-container.ts:1-2`가 `import * as THREE from 'three'`를 최상단에서 수행하고 `dist/index.js:1`에 그대로 노출. P0의 ESM 측면으로, three 미설치 소비자가 안전하려면 전적으로 소비자 번들러의 트리셰이킹에 의존(naive/비-번들 환경에선 실패). P0와 동일한 지연-로드/subpath 분리로 함께 해소. / 제안: P0와 통합 수정. / 규모: M

- [P1] CI에 Playwright e2e 잡 부재 — `.github/workflows/ci.yml`은 lint→typecheck→build→test(단위)만 수행. 저장소에 PTR/StableInput/ScrollLock/SafeArea/VirtualKeyboard e2e 스위트(89db06a)가 있고 로드맵도 "e2e 포함 완료"로 표기하나, PR/푸시에서 제스처·viewport 회귀를 게이트하지 않음. WebKit/Mobile Safari 특화 버그가 머지될 위험. / 제안: `playwright install chromium webkit` + `pnpm test:e2e`를 별도 잡(또는 매트릭스)으로 추가, 캐시 포함. / 규모: M

- [P1] react/vue tsup `external`에 잘못된(구) 패키지명 — `packages/react/tsup.config.ts:9`, `packages/vue/tsup.config.ts:9`가 `external: [..., '@wvkit/core']`를 지정하지만 실제 의존성명은 `@guksu/wvkit-core`. 현재는 tsup이 `dependencies`를 자동 external 처리해 결과적으로 번들에서 빠지지만(react dist에 three 0건, core는 import로 유지 확인), external 목록 자체는 무효한 죽은 문자열이라 리네이밍/설정 변경 시 코어가 소비자 번들에 잘못 인라인될 리스크. / 제안: `'@wvkit/core'` → `'@guksu/wvkit-core'`로 정정. / 규모: S

- [P1] `three` peer 범위가 과도하게 협소 — `packages/core/package.json` `peerDependencies.three: "^0.184.0"`. three는 pre-1.0이라 caret이 0.184.x로만 고정(>=0.184.0 <0.185.0). three는 minor(0.185, 0.186…)를 자주 릴리스하므로 최신 호스트는 peer 경고 발생. CSS3DRenderer/OrthographicCamera API는 안정적이므로 하한 지정이 적합. / 제안: `">=0.160.0"` 등 하한 범위로 완화(실측 최소 버전 확인 후). `@types/three` devDep도 동반 조정. / 규모: S

---

## P2

- [P2] 무효 `biome-ignore` 억제 주석 — `packages/react/src/components/{scroll-container/use-scroll-container.ts:41, pull-to-refresh/use-pull-to-refresh.ts:48, scroll-lock/use-scroll-lock.ts:14}`에서 `useExhaustiveDependencies` 억제가 "suppression has no effect" 경고 발생(해당 룰이 활성 세트에 없음). 경고는 CI를 깨지 않으나 노이즈. / 제안: 억제 주석 제거 또는 biome 설정에서 해당 룰 활성화. / 규모: S

- [P2] 마운트 후 non-callback prop 변경이 인스턴스에 반영 안 됨 — react/vue 어댑터 모두 옵션을 마운트/`setup` 시점에 고정(의도된 설계). 콜백은 ref로 최신화되나 `panels`/`direction`/`threshold`/`minZoom`/`maxZoom` 등은 변경 시 무시됨. 특히 `panels` 교체는 실사용 시나리오라 조용한 DX 함정. / 제안: `panels` 아이덴티티 변경 시 재초기화하거나 README/JSDoc에 명시적 경고 추가. / 규모: M

- [P2] `react-dom`이 불필요하게 peer로 선언 — `packages/react/package.json` `peerDependencies.react-dom`. 어댑터/`StableInputDisplay`는 `react`만 사용(react-dom 직접 참조 없음). 소비자 설치 제약만 늘림. / 제안: react-dom peer 제거(또는 실제 필요성 확인). / 규모: S

- [P2] StableInput 옵션 검증·에러 처리 부재 — `packages/core/src/components/stable-input/stable-input.ts`는 `WebviewHeadlessError`를 쓰지 않고(ScrollContainer/PTR는 validateOptions로 사용) `destroy` 시 `isFocused` 미초기화. 기능상 무해하나 컨벤션("모든 비동기/리스너 가드, 설명적 에러") 일관성 저하. / 제안: 최소한의 옵션 sanity check 추가 또는 의도적 생략을 주석화. / 규모: S

- [P2] release·deploy-demo가 매 main 푸시마다 동시 실행 — `.github/workflows/{release,deploy-demo}.yml` 둘 다 `push: branches:[main]` 트리거. 데모와 무관한 변경(코어 리팩터 등)에도 Pages 재배포. concurrency 그룹은 각기 있으나 잡 낭비. / 제안: deploy-demo에 `paths:` 필터(examples/**, packages/**) 추가. / 규모: S

- [P2] ScrollLock의 scrollY 복원이 사실상 무동작 — `packages/core/src/components/scroll-lock/scroll-lock.ts:36,60`에서 `scrollY`를 저장하고 unlock에서 `window.scrollTo(0, scrollY)` 호출하나, body를 `position:fixed`로 만들지 않고 `overflow:hidden`만 적용하므로 대부분 환경에서 스크롤 위치가 유지되어 복원이 불필요(무해하나 오해 소지). / 제안: 의도 확인 후 주석 명확화 또는 position-fixed 전략 채택 여부 결정. / 규모: S

---

## 통과 확인 항목 (회귀 감시용)

- `pnpm build`: exit 0. 번들 — core ESM 35.98KB / CJS 36.69KB, react ESM 5.79KB, vue ESM 5.10KB. three는 core dist에서 external 유지, react dist엔 three 참조 0건.
- `pnpm typecheck`: exit 0 (tsconfig.base strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess + verbatimModuleSyntax 전부 활성).
- `biome lint packages`: 오류 0, 경고 2(위 P2 억제 주석).
- destroy 완전성: ScrollContainer(control/resizeObserver/scene.clear/DOM detach/pointer capture release m-5), PTR(rafId/listeners/overscroll 복원/promise null), SafeArea/VK(리스너 배열 일괄 해제) 모두 확인. 멱등 가드 존재.
- 버전 일관성: 3패키지 모두 0.3.1, 내부 의존은 `workspace:*` — 정상.
- default export 스캔: 0건(named-only 컨벤션 준수).
