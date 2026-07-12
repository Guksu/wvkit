# Sprint 11 — 어댑터·설정 정리 (adapter-config-cleanup)

> 대상 백로그: **B-25**(어댑터·설정 정리 — non-callback prop 미반영 문서화(특히 `panels`) / react-dom peer 제거 / biome 무효 억제 정리 / deploy-demo `paths:` 필터 / ScrollLock scrollY 주석 명확화 / StableInput 옵션 검증)
> 근거: `audit-code-ci.md` P2 ×6 (38·40·42·44·46·48행의 6개 항목)
> 작성일: 2026-07-11 · 규모: M · 브랜치: `chore/quality-sprint-1`

## 목표

audit-code-ci P2 6건을 닫아 어댑터 DX 함정·불필요한 설치 제약·CI 잡 낭비·컨벤션 불일치를 제거한다. 이 스프린트가 끝나면:

1. "마운트 후 non-callback 옵션(특히 `panels`)은 반영되지 않는다"는 어댑터 계약이 **문서(README EN/KO + docs 사이트 EN/KO + 훅 JSDoc)에 명시**되고, **단위 테스트로 핀 고정**된다(문서화한 동작이 조용히 바뀌면 테스트가 깨짐).
2. `@guksu/wvkit-react`가 `react-dom` peer 없이 설치된다(소스는 이미 react-dom 무참조 — 감사 확인).
3. `biome lint packages` 출력에 "suppression has no effect" 계열 경고가 0건임이 보장된다(현재 잔존 억제 주석 2곳의 유효성 검증 포함).
4. `deploy-demo.yml`이 데모/문서와 무관한 push(워크로그·캠페인 문서 등)에는 실행되지 않고, 수동 재배포 수단(`workflow_dispatch`)을 갖는다.
5. ScrollLock의 `scrollY` 저장/복원이 "position:fixed 전략이 아닌 overflow:hidden 전략의 안전망"임이 주석으로 명확해지고, 복원 호출이 테스트로 핀 고정된다.
6. StableInput이 ScrollContainer/PTR과 동일하게 `validateOptions` + `WebviewHeadlessError` 컨벤션을 따르고, `destroy`에서 `isFocused`를 초기화한다.

**동작 변경은 T-06(StableInput 검증 throw 추가)뿐이다.** 나머지는 문서·주석·설정·package.json 정리이며 기존 테스트는 삭제·완화하지 않는다.

### 사전 확인 결과 (2026-07-11 planner 실측 — 감사 시점과 달라진 것)

- 감사가 지적한 무효 억제 3곳(`use-scroll-container.ts:41`, `use-pull-to-refresh.ts:48`, `use-scroll-lock.ts:14`) 중 현재 잔존 억제 주석은 **2곳**: `packages/react/src/components/virtual-keyboard/use-virtual-keyboard.ts:14`, `packages/react/src/components/scroll-lock/use-scroll-lock.ts:14`. 그리고 `pnpm exec biome lint packages`는 현재 **경고 0으로 통과**(exit 0). → T-03은 "정리"가 아니라 **검증 + 회귀 가드**로 축소될 수 있음. 구현자는 두 억제를 임시 제거해 진짜 diagnostic이 발생하는지(= 억제가 load-bearing인지) 확인하고, 무효로 판명된 것만 삭제한다. 이미 해소된 것으로 판명되면 워크로그에 근거를 기록하고 AC만 확인한다.
- react/vue tsup `external` 오기는 B-03(Sprint 3)에서 이미 정정됨 — 본 스프린트 범위 아님.
- `WebviewHeadlessError`는 B-11(Sprint 3)로 값 export 됨(`packages/core/src/index.ts:1`) — T-06 테스트에서 `import { WebviewHeadlessError } from '../../../index'`(또는 `../../../errors`)로 instanceof 단언 가능.

---

## 태스크

### T-01 — non-callback prop 미반영 문서화 + 어댑터 핀 테스트

**배경(audit-code P2, :40):** react/vue 어댑터는 옵션을 마운트/`setup` 시점에 고정한다(의도된 설계). 콜백은 ref로 최신화되지만 `panels`/`direction`/`threshold`/`minZoom`/`maxZoom` 등 non-callback 옵션은 변경 시 조용히 무시된다. 특히 `panels` 교체는 실사용 시나리오라 DX 함정. 백로그 결정: **재초기화 구현이 아니라 문서화**를 택한다(재초기화는 범위 제외 참조).

**문서 변경 파일 4 + JSDoc 2:**

| 파일 | 변경 |
|---|---|
| `README.md` | API Reference 서두(또는 React/Vue 사용법 직후)에 **Reactivity note** 블록 추가. 필수 포함 문장(marker, 정확히 이 어구 포함): `Non-callback options (e.g. `panels`, `direction`, `minZoom`) are captured once at mount` + 우회법: React는 `key`로 재마운트, Vue는 `:key`/`v-if` 재마운트 안내 |
| `README.ko.md` | 동일 블록 KO. 필수 marker: `콜백이 아닌 옵션(`panels`, `direction`, `minZoom` 등)은 마운트 시점에 1회 고정` |
| `docs/components/scroll-container/index.md` | React/Vue 어댑터 섹션에 caveat 블록(VitePress `::: warning` 권장). EN marker 동일 포함 |
| `docs/ko/components/scroll-container/index.md` | 동일 caveat KO. KO marker 동일 포함 |
| `packages/react/src/components/scroll-container/use-scroll-container.ts` | 훅 JSDoc "규칙" 목록에 항목 추가 — non-callback 옵션은 마운트 시 1회 고정, `panels` 교체가 필요하면 `key`로 **재마운트**(문자열 "재마운트" 포함) |
| `packages/vue/src/components/scroll-container/use-scroll-container.ts` | 기존 "options는 setup 시점에 고정" 항목을 확장 — `panels` 명시 + `:key` **재마운트** 안내(문자열 "재마운트" 포함) |

**핀 테스트 (문서화한 계약을 테스트로 고정 — 인스턴스 재생성이 없음을 관측 가능한 부수효과로 단언):**

- `packages/react/src/components/scroll-container/__tests__/use-scroll-container.test.tsx`에 추가 (기존 `makePanels` 헬퍼·B-09 rerender 패턴 재사용):
  - `it('[B-25] R1: rerender로 panels/minZoom을 교체해도 인스턴스는 재생성되지 않는다', ...)` — render 후 `containerDiv.firstElementChild`(CSS3DRenderer.domElement) 참조 capture → 새 배열 `makePanels(5)` + 다른 `minZoom`으로 rerender → (a) `containerDiv.firstElementChild`가 **동일 참조**(재생성 시 renderer DOM이 교체되므로) (b) `activeIndex` 불변 (c) throw 없음.
- `packages/vue/src/components/scroll-container/__tests__/use-scroll-container.test.ts`에 추가 (기존 mount 패턴 재사용):
  - `it('[B-25] V1: 마운트 후 options 객체의 panels를 교체해도 인스턴스는 재생성되지 않는다', ...)` — mount 후 renderer DOM 참조 capture → options 객체의 `panels`를 교체(props 갱신 또는 옵션 객체 mutate) → `await nextTick()` → renderer DOM **동일 참조** + `activeIndex.value` 불변.

### T-02 — `react-dom` peer 제거

**배경(audit-code P2, :42):** `packages/react/package.json`의 `peerDependencies.react-dom: ">=18.0.0"`은 소스가 react-dom을 직접 참조하지 않는데도(감사에서 0건 확인, planner 재확인 0건) 소비자 설치 제약만 늘린다.

**변경:**
- `packages/react/package.json` — `peerDependencies`에서 `react-dom` 항목 삭제. `react: ">=18.0.0"` peer는 유지. **devDependencies의 `react-dom`은 유지**(`@testing-library/react`가 요구).
- `pnpm install` 실행으로 `pnpm-lock.yaml` 재생성(락파일 갱신은 파일 변경일 뿐 git 명령 아님 — 커밋은 사용자 전담).

### T-03 — biome 억제 주석 유효성 검증 + 회귀 가드

**배경(audit-code P2, :38) + 사전 확인:** 현재 `pnpm exec biome lint packages`는 경고 0으로 통과한다. 잔존 억제 2곳이 실제로 diagnostic을 막고 있는지("has no effect"가 아닌지) 확인한다.

**절차(구현자):**
1. `packages/react/src/components/scroll-lock/use-scroll-lock.ts:14`, `packages/react/src/components/virtual-keyboard/use-virtual-keyboard.ts:14`의 `biome-ignore lint/correctness/useExhaustiveDependencies` 주석을 각각 임시 제거 → `pnpm exec biome lint packages`에서 해당 파일에 `useExhaustiveDependencies` diagnostic이 발생하면 **유효한 억제**이므로 복원, 발생하지 않으면 **무효 억제**이므로 삭제 확정.
2. 결과(각 억제의 유효/무효 판정과 근거)를 워크로그에 기록.

**소스 변경:** 무효로 판정된 억제 주석 삭제만. 유효하면 변경 0.

### T-04 — deploy-demo `paths:` 필터 + `workflow_dispatch`

**배경(audit-code P2, :46):** `.github/workflows/deploy-demo.yml`이 모든 main push에서 실행되어 데모와 무관한 변경(워크로그, 캠페인 문서, CI 설정 등)에도 Pages를 재배포한다.

**변경 — `.github/workflows/deploy-demo.yml`:**

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'packages/**'
      - 'examples/**'
      - 'docs/.vitepress/**'
      - 'docs/components/**'
      - 'docs/ko/**'
      - 'docs/index.md'
      - 'docs/package.json'
      - 'pnpm-lock.yaml'
      - '.github/workflows/deploy-demo.yml'
  workflow_dispatch:
```

- `docs/**` 전체가 아니라 **사이트 빌드에 들어가는 하위 경로만** 나열한다 — `docs/worklog/**`, `docs/campaign/**`, `docs/reports/**`, `docs/qa/**`, `docs/templates/**`, `docs/loops/**`는 main 푸시가 잦지만 배포 산출물과 무관.
- `workflow_dispatch`를 함께 추가한다 — paths 필터로 스킵된 뒤 수동 재배포할 수단이 없으면 운영 함정이 됨.
- release.yml은 건드리지 않는다(감사 제안은 deploy-demo 측 필터만).

### T-05 — ScrollLock scrollY 주석 명확화 + 안전망 동작 핀 테스트

**배경(audit-code P2, :48):** `packages/core/src/components/scroll-lock/scroll-lock.ts:36`(저장)·`:60`(`window.scrollTo(0, scrollY)`)은 body를 `position:fixed`로 만들지 않는 현 전략(overflow:hidden + touchmove preventDefault)에서는 대부분 무동작이다. 백로그 결정: **전략 변경 없이 주석 명확화**.

**변경 — `scroll-lock.ts` (동작 변경 없음, 주석만):**
- `:36` 부근과 `:60` 부근에 의도 주석 추가. 필수 포함(marker): 문자열 `안전망` — 예: "overflow:hidden 전략에서는 스크롤 위치가 대부분 유지되므로 이 복원은 무동작에 가깝다. 일부 브라우저(주소창 축소/키보드 등)에서 위치가 틀어지는 경우를 위한 안전망이며, position:fixed 전략(저장/복원이 필수인)으로 오해하지 말 것."

**핀 테스트 — `packages/core/src/components/scroll-lock/__tests__/scroll-lock.test.ts`에 추가:**
- `it('[B-25] L1: unlock은 lock 시점의 scrollY로 window.scrollTo를 호출한다(안전망)', ...)` — `Object.defineProperty(window, 'scrollY', { value: 120, configurable: true })` → `vi.spyOn(window, 'scrollTo')` → `lock()` → scrollY를 0으로 재정의(위치가 바뀐 상황 모사) → `unlock()` → `expect(scrollToSpy).toHaveBeenCalledWith(0, 120)`. (주석이 약속하는 "lock 시점 값 복원"을 고정 — 주석·코드가 함께 표류하는 것을 방지)

### T-06 — StableInput 옵션 검증 + destroy `isFocused` 초기화

**배경(audit-code P2, :44):** `stable-input.ts`는 ScrollContainer(`scroll-container.ts:308 validateOptions`)·PTR(`pull-to-refresh.ts:369`)과 달리 `WebviewHeadlessError` 기반 옵션 검증이 없고, `destroy`(:156-161)가 `isFocused`를 초기화하지 않는다.

**변경 — `packages/core/src/components/stable-input/stable-input.ts`:**
- `validateOptions(options, container)` 함수 추가(ScrollContainer/PTR 스타일·주석 톤 답습), **SSR 가드(`typeof window === 'undefined'`) 통과 직후** 호출 — `HTMLElement` 전역이 SSR에 없으므로 가드 앞에 두지 말 것(SSR noop 계약 유지).
  - `container`가 `HTMLElement` 인스턴스가 아니면 `throw new WebviewHeadlessError('StableInput: container must be an HTMLElement')`
  - `options.scrollAnchor`가 정의됐고 `'top' | 'bottom' | 'none'`이 아니면 `throw new WebviewHeadlessError("StableInput: scrollAnchor must be 'top', 'bottom', or 'none' (got ...)")`
  - 그 외 옵션(type/placeholder/inputMode/autocomplete)은 문자열 형식이라 런타임 검증 실익 없음 — **의도적 생략을 validateOptions 주석에 명시**(감사 제안의 "의도적 생략 주석화" 이행)
- `destroy()`에 `isFocused = false;` 추가(리스너 해제·DOM 제거 뒤 상태도 초기 상태로 — destroy 패턴 컨벤션 정합).

**테스트 — `packages/core/src/components/stable-input/__tests__/stable-input.test.ts`에 추가:**
- `it('[B-25] S1: 잘못된 scrollAnchor는 WebviewHeadlessError를 던진다', ...)` — `createStableInput(el, { scrollAnchor: 'middle' as never })` → `expect(...).toThrow(WebviewHeadlessError)` + 메시지 `/scrollAnchor/` 매치. 유효값 3종(`'top'|'bottom'|'none'`)은 throw 없음(신규 분기 커버리지 확보).
- `it('[B-25] S2: container가 HTMLElement가 아니면 WebviewHeadlessError를 던진다', ...)` — `createStableInput(null as never, {})` → `toThrow(WebviewHeadlessError)`.
- **커버리지 주의:** `packages/core/vitest.config.ts`의 stable-input threshold(branch 85/func 75)가 활성 — 신규 validateOptions의 모든 분기(유효/무효 양쪽)를 케이스로 커버해 하한 미달을 방지한다.

**semver 주의:** 기존에 조용히 지나가던 잘못된 입력이 throw로 바뀌는 동작 변경 → core changeset은 **minor**(1.0 이전 breaking-ish 허용 관례, CHANGELOG에 명시).

### T-07 — changeset + 전역 게이트

- `.changeset/`에 2건 추가: `@guksu/wvkit-core` **minor**(StableInput 옵션 검증 throw + destroy 상태 초기화 + ScrollLock 주석), `@guksu/wvkit-react` **patch**(react-dom peer 제거 — 설치 제약 완화).
- 전역 게이트 4종(AC-19~22) 통과 확인. T-06 소스 변경 후 `pnpm build`로 dist 재생성이 필요할 수 있음(어댑터 테스트가 core dist가 아닌 src를 참조하는지와 무관하게 게이트는 build 포함).

---

## 인수조건 (기계 검증 — 모든 명령은 리포 루트 `/Users/kimjongmin/dev/wvkit`에서 실행)

> Sprint 1 교훈 적용: vitest 타이틀 grep은 반드시 `--reporter=verbose`. `pnpm --filter`에는 실제 name 필드(`@guksu/wvkit-*`) 사용.

### T-01

| # | 명령 | 기대 |
|---|---|---|
| AC-01 | `pnpm --filter @guksu/wvkit-react test -- --reporter=verbose 2>&1 \| grep -F "[B-25] R1"` | exit 0 (+ 전체 실행 exit 0) |
| AC-02 | `pnpm --filter @guksu/wvkit-vue test -- --reporter=verbose 2>&1 \| grep -F "[B-25] V1"` | exit 0 (+ 전체 실행 exit 0) |
| AC-03 | `grep -q "captured once at mount" README.md && grep -q "captured once at mount" docs/components/scroll-container/index.md` | exit 0 |
| AC-04 | `grep -q "마운트 시점에 1회 고정" README.ko.md && grep -q "마운트 시점에 1회 고정" docs/ko/components/scroll-container/index.md` | exit 0 |
| AC-05 | `grep -q "재마운트" packages/react/src/components/scroll-container/use-scroll-container.ts && grep -q "재마운트" packages/vue/src/components/scroll-container/use-scroll-container.ts` | exit 0 |

### T-02

| # | 명령 | 기대 |
|---|---|---|
| AC-06 | `node -e "const p=require('./packages/react/package.json'); process.exit('react-dom' in (p.peerDependencies\|\|{}) ? 1 : 0)"` | exit 0 |
| AC-07 | `pnpm install --frozen-lockfile` | exit 0 (락파일 갱신 완료 상태) |
| AC-08 | `pnpm --filter @guksu/wvkit-react build && pnpm --filter @guksu/wvkit-react test` | exit 0 |

### T-03

| # | 명령 | 기대 |
|---|---|---|
| AC-09 | `pnpm exec biome lint packages 2>&1 \| grep -iq "suppress"` | **exit 1** (suppression 경고 0건) |
| AC-10 | `pnpm exec biome lint packages` | exit 0 |

### T-04

| # | 명령 | 기대 |
|---|---|---|
| AC-11 | `grep -q "paths:" .github/workflows/deploy-demo.yml && grep -q -- "- 'packages/\*\*'" .github/workflows/deploy-demo.yml && grep -q -- "- 'examples/\*\*'" .github/workflows/deploy-demo.yml && grep -q "docs/.vitepress" .github/workflows/deploy-demo.yml` | exit 0 |
| AC-12 | `grep -q "workflow_dispatch" .github/workflows/deploy-demo.yml && grep -vq "docs/worklog" .github/workflows/deploy-demo.yml` | exit 0 |

### T-05

| # | 명령 | 기대 |
|---|---|---|
| AC-13 | `pnpm --filter @guksu/wvkit-core test -- --reporter=verbose 2>&1 \| grep -F "[B-25] L1"` | exit 0 (+ 전체 실행 exit 0) |
| AC-14 | `grep -q "안전망" packages/core/src/components/scroll-lock/scroll-lock.ts` | exit 0 |

### T-06

| # | 명령 | 기대 |
|---|---|---|
| AC-15 | `pnpm --filter @guksu/wvkit-core test -- --reporter=verbose 2>&1 \| grep -F "[B-25] S1"` | exit 0 |
| AC-16 | `pnpm --filter @guksu/wvkit-core test -- --reporter=verbose 2>&1 \| grep -F "[B-25] S2"` | exit 0 |
| AC-17 | `grep -A 8 "function destroy" packages/core/src/components/stable-input/stable-input.ts \| grep -q "isFocused = false"` | exit 0 |

### T-07 + 전역 게이트

| # | 명령 | 기대 |
|---|---|---|
| AC-18 | `[ "$(ls .changeset/*.md \| grep -vc 'README')" -ge 2 ]` | exit 0 (core minor + react patch) |
| AC-19 | `pnpm lint` | exit 0 |
| AC-20 | `pnpm typecheck` | exit 0 |
| AC-21 | `pnpm build` | exit 0 |
| AC-22 | `pnpm test` | exit 0 (커버리지 threshold 게이트 포함 — stable-input branch 85/func 75 유지) |

---

## 경계면 매핑 (생산자 ↔ 소비자 — qa 교차검증 입력)

| 생산자 | 산출 | 소비자 | 검증 포인트 |
|---|---|---|---|
| core `stable-input.ts` validateOptions (T-06) | 잘못된 옵션 시 `WebviewHeadlessError` throw | react `useStableInput` / vue `useStableInput` (effect/onMounted 내부에서 create 호출) | 어댑터 경유 시 throw가 effect 내부에서 발생 — 기존 어댑터 테스트(**정상 옵션 사용**)가 깨지지 않아야 함. 어댑터에 잘못된 옵션을 넣는 신규 테스트는 범위 외(core 단위에서 검증) |
| core `WebviewHeadlessError` 값 export (B-11 기존) | instanceof 가능한 클래스 | T-06 테스트의 `toThrow(WebviewHeadlessError)` | import 경로가 배럴(`packages/core/src/index.ts`) 또는 `errors.ts` — 타입 전용 import로 회귀하면 테스트가 컴파일 단계에서 실패 |
| react/vue `use-scroll-container.ts` JSDoc + README/docs 문서 (T-01) | "non-callback 옵션 1회 고정" 계약 | 라이브러리 소비자·데모 작성자 | 문서 marker(AC-03~05)와 핀 테스트(AC-01~02)가 **같은 계약**을 서술하는지 — 어느 한쪽만 바뀌면 불일치 |
| `packages/react/package.json` (T-02) | peer 축소 | npm 소비자·pnpm 워크스페이스 해석 | `pnpm install --frozen-lockfile` + react 패키지 build/test green (devDep react-dom은 테스트용으로 잔존) |
| `.github/workflows/deploy-demo.yml` (T-04) | paths 필터 + dispatch | GitHub Actions (main push) | 필터 목록이 데모 compose 단계 입력(examples/react-example/dist, docs/.vitepress/dist, examples/vue-example/dist)의 **모든 소스 경로**를 포함하는지 — 누락 시 배포 스킵 사고 |
| core `scroll-lock.ts` 주석 (T-05) | 안전망 의도 서술 | 다음 유지보수자 | 주석이 서술하는 동작(lock 시점 scrollY 복원)과 L1 테스트 단언 일치 |

## 범위 제외

- **`panels` 변경 시 자동 재초기화 구현** — 감사가 제시한 두 대안(재초기화 or 문서화) 중 백로그가 문서화를 채택. 재초기화는 destroy/재생성 비용·상태 보존 정책 설계가 필요한 별도 항목(필요 시 신규 백로그로).
- **ScrollLock position:fixed 전략 전환** — 주석 명확화만(백로그 문구 그대로). 전략 전환은 iOS 주소창/safe-area 회귀 리스크가 커 별도 스파이크 필요.
- **scroll-container 외 4개 컴포넌트 docs 페이지·훅 JSDoc에 동일 caveat 일괄 추가** — README 공통 노트가 전 컴포넌트를 커버하므로 docs 사이트 개별 페이지 반영은 후속(문서 diff 최소화). 단 README 노트는 특정 컴포넌트가 아닌 **어댑터 공통 규칙**으로 서술할 것.
- **StableInput의 type/placeholder 등 문자열 옵션 런타임 검증** — 실익 없음, 의도적 생략을 주석으로만 남김(T-06).
- **release.yml 트리거 조정** — 감사 제안은 deploy-demo 측 필터. release는 changeset 흐름(d69ff57)과 결합되어 있어 건드리지 않음.
- **B-26 잔여 lint 정리** — Sprint 1에서 완료된 별도 항목.
