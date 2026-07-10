# QA 리포트 — Sprint 1 테스트 게이트

검증: 2026-07-10 · qa · 대상 커밋: 작업트리(main, 미커밋 변경 4파일)

## 판정 요약

| AC | 항목 | 판정 |
|---|---|---|
| AC-01 | 워크플로 구조 (grep 4 + yaml 2) | PASS |
| AC-02 | e2e 실행 (implementer 확인, 재실행 생략) | PASS (승계) |
| AC-03 | IME 가드 테스트 (exit + 의미 단언) | PASS (grep 하위검증은 주의) |
| AC-04 | threshold 존재·통과 | PASS |
| AC-05 | 게이트 실효성 (음성 검증) | PASS (기록 근거) |
| AC-06 | 회귀 없음 (test·typecheck·lint) | PASS (lint는 사전존재 분류) |

**PASS 6 / FAIL 0.** 구현 결함 FAIL 없음. AC 명령 표현 문제 1건(AC-03 grep)과 사전존재 lint red 1건은 백로그 신규 항목으로 분리 권장.

---

## 항목별 판정

### AC-01 — 워크플로 구조 [PASS]
직접 실행한 6개 명령 전부 exit 0:
- `grep -q "playwright install"` → 0
- `grep -Eq "chromium[[:space:]]+webkit|..."` → 0
- `grep -q "test:e2e"` → 0
- `grep -q "upload-artifact"` → 0
- `python3 ... 'e2e' in d['jobs']` → 0 (e2e 잡 정의됨, YAML 유효)
- `python3 ... print('OK')` → `OK`, exit 0

**e2e 잡 8스텝 계약 라인 단위 대조** (`.github/workflows/ci.yml:43-76`):
1. `actions/checkout@v4` (47) ✓
2. `pnpm/action-setup@v4` (49) ✓
3. `actions/setup-node@v4` node 20 / cache pnpm (51-54) ✓
4. `pnpm install --frozen-lockfile` (56-57) ✓
5. `pnpm exec playwright install --with-deps chromium webkit` (59-60) ✓
6. `pnpm build` (62-63) ✓
7. `pnpm test:e2e` (65-66) ✓
8. `actions/upload-artifact@v4` `if: ${{ !cancelled() }}` (68-76), path 2종: `e2e/test-results/**` + `e2e/playwright-report/**` ✓

8스텝 전부 계약 일치. 아티팩트는 단일 `upload-artifact` 액션에 path 2글롭으로 통합됐으나(계획의 "2종" 요구 충족), AC 기준 `grep upload-artifact`도 통과. `needs:` 없음 확인(ci/e2e 병렬). `@guksu/wvkit-core` Coverage gate 스텝(40-41)도 `ci` 잡에 존재.

### AC-02 — e2e 실행 [PASS (승계)]
리더 지시대로 재실행 생략. implementer가 `pnpm build` 후 `pnpm test:e2e` → exit 0 (186 passed / 10 skipped, mobile-only VK skip) 기록. 이 스프린트는 스펙 무추가 → 기존 스펙이 새 CI 경로로 통과함을 확인하는 것이 완료 기준이며 스텝 계약(AC-01)이 이를 실행함.

### AC-03 — IME 가드 테스트 [PASS]
- `pnpm --filter @guksu/wvkit-core exec vitest run stable-input` → **exit 0** (21 tests: 기존 18 + 신규 3).
- **의미 단언 3개 소스 대조** (`__tests__/stable-input.test.ts:107-155` ↔ 가드 `stable-input.ts:119`):
  - `isComposing:true` 케이스(107): `Object.defineProperty(ev,'isComposing',{value:true})` + 자기검증 `expect(ev.isComposing).toBe(true)` + `hiddenInput.dispatchEvent(ev)` + `toHaveBeenCalledTimes(0)`. **hiddenInput에 dispatch → 가드 리스너 경로 정확히 통과.**
  - `keyCode:229` 케이스(123): `keyCode` 주입 + 자기검증 `expect(ev.keyCode).toBe(229)` + `expect(ev.isComposing).toBe(false)` + `toHaveBeenCalledTimes(0)`.
  - 정상 Enter(140): `isComposing:false`·`keyCode!=229` 자기검증 + `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith('한글')`. 가드가 정상 입력을 막지 않음까지 고정.
  - 세 케이스 모두 `onSubmit` 스파이를 0/0/1로 단언 — 껍데기 아님. 가드의 두 분기(`isComposing`, `keyCode===229`)와 통과 경로를 각각 커버.

**주의(구현 결함 아님):** plan AC-03 line 127의 grep 하위검증 `grep -c "isComposing\|229\|IME\|조합"`은 vitest **기본 리포터에서 0을 반환**(non-TTY에서 통과 테스트 타이틀 미출력) — 실측 확인함. `--reporter=verbose` 시 3. 테스트 자체는 존재·통과·의미 단언 충족이므로 실질 인수는 만족. → **planner에게 AC 명령을 `--reporter=verbose` 병기로 정정 요청 권장**(implementer 트레이드오프 #3과 동일 결론).

### AC-04 — threshold 존재·통과 [PASS]
- `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` → **exit 0**.
- 실측 vs 설정 (전부 하한 위):
  | 파일 | branch 실측/설정 | func 실측/설정 |
  |---|---|---|
  | camera-control.ts | 56.52 / 55 | 94.73 / 90 |
  | pull-to-refresh.ts | 82.1 / 80 | 88.46 / 85 |
  | stable-input.ts | 90 / 85 | 78.57 / 75 |
- `grep -q "thresholds"` → 0, 3파일 grep → 0.
- **glob 키 ↔ 실제 파일명 매칭 확인**: `**/camera-control.ts`·`**/pull-to-refresh.ts`·`**/stable-input.ts` 전부 실제 소스 경로에 매칭(coverage 테이블에 3파일 등장 = 글롭 매칭 성립, 미매칭 시 vitest v2가 에러). 테스트 파일 `stable-input.test.ts`는 `stable-input.ts` 글롭에 비매칭(정상).
- **설정값 ↔ plan 표 일치**: 55/90·80/85·85/75 정확히 일치.

### AC-05 — 게이트 실효성 (음성 검증) [PASS]
- **독립 재실행 시도(CLI threshold 오버라이드)는 이 세션 권한 정책으로 거부됨** → 기계 재검증 불가.
- 대신 기록·상태 근거로 판정: implementer worklog(`docs/worklog/2026-07-10-test-gate-implementer.md:18,24`)에 camera-control branch `55→99` 임시 상향 시 `vitest run --coverage` **exit 1**(`Coverage for branches (56.52%) does not meet "**/camera-control.ts" threshold (99%)`) 확인 후 원복 기록.
- **config 원복 상태 직접 확인**: `vitest.config.ts:14`가 현재 `{ branches: 55, functions: 90 }` — 원상복구됨.
- 게이트 메커니즘(`coverage.thresholds` glob per-file → 미달 시 vitest exit 비0)은 vitest v2 계약이며 AC-04 exit 0(하한 위)·implementer 음성 exit 1이 양방향을 입증.

### AC-06 — 회귀 없음 [PASS]
- `pnpm test` → **exit 0** (core 192 / react 25 / vue 24 = 241; 신규 IME 3케이스 포함).
- `pnpm typecheck` → **exit 0** (vitest.config 타입 오류 없음).
- `pnpm lint` → **exit 1** — 그러나 **lint red 13건 전부 이번 변경 밖**:
  - lint 오류 파일: `e2e/fixtures/pull-to-refresh.ts`, `e2e/playwright.config.ts`, `e2e/specs/{safe-area,scroll-container.api,stable-input,virtual-keyboard}.spec.ts`, `examples/react-example/src/{ScrollContainerDemo.tsx,ui.tsx}`, `packages/react/src/components/{pull-to-refresh/use-pull-to-refresh,scroll-container/use-scroll-container}.ts`.
  - 이번 변경 4파일(`.github/workflows/ci.yml`, `package.json`, `stable-input.test.ts`, `vitest.config.ts`)은 **어디에도 없음**. 변경 3파일 개별 `biome lint` → **exit 0(클린)**(ci.yml은 biome 대상 아님).
  - → 사전 존재 red. FAIL 아님. **"사전 존재 — 백로그 신규 항목(기존 e2e/examples/react lint 정리)" 제안**. AC-06의 lint→exit 0 전제는 현재 main 상태와 불일치하므로 planner가 AC를 "변경 파일 한정 lint 클린"으로 정정 권장.

---

## 경계면 교차검증

- **Coverage gate 필터명 ↔ 패키지명**: `ci.yml:41` `@guksu/wvkit-core` ↔ `packages/core/package.json:2` `@guksu/wvkit-core` **일치**. (계획서 원문 `@wvkit/core`는 v0.3.1 리네임 전 이름 — implementer가 실제 이름으로 정정 반영, 올바름.)
- **`test:coverage` 스크립트**: `package.json:10` `"turbo run test -- --coverage"` 정의됨. CI 게이트는 core 직접 필터 경로를 쓰므로 이 스크립트는 로컬 편의용(dev-notes 명시와 일치). 각 패키지 `test` 스크립트가 `vitest run`이라 `--coverage` 패스스루 유효.
- **IME 가드 생산자↔소비자**: 테스트(소비자)가 `stable-input.ts:114-123` keydown 핸들러(생산자)의 `isComposing`/`keyCode===229` 두 분기를 정확한 dispatch 대상(hiddenInput)으로 구동 — shape 불일치 없음.
- **불변식**: core 소스 로직 무변경 확인(git diff에 `stable-input.ts` 등 소스 없음, 테스트·설정·워크플로만) → react/vue 어댑터 재빌드 불필요, 계획 불변식 준수.

## B-26 재검증 (사전 lint red 정리 편입)

검증: 2026-07-10 · qa 증분 재호출 · 변경 6파일(biome.json, react 훅 2, e2e fixture, e2e spec, examples demo)

**판정: PASS.** 4개 검증 항목 전부 통과, 회귀 없음.

### 1. 기계 검증 [PASS]
- `pnpm lint` → **exit 0** (`Checked 121 files, No fixes applied`) — 직전 13 red 전부 해소.
- `pnpm typecheck` → **exit 0**.
- `pnpm test` → **exit 0** (core 192 / react 25 / vue 24 = 241, 무회귀).
- → AC-06 lint 조건이 이제 정상 충족됨(이전 리포트의 "사전 존재 red" 미해결 항목 #2 해소).

### 2. biome.json override 경로+규칙 스코프 [PASS]
`biome.json` diff·전문 확인:
- **전역 규칙(21-34행) 무변경**: `noDefaultExport:error`·`useConst:error`·`noUnusedVariables/Imports:error`·`recommended:true` 그대로. 전역 완화 없음.
- override 1(37-49): `**/{tsup,vitest,vite,playwright}.config.ts` → `style.noDefaultExport:off`. config 파일명 한정 + 단일 규칙. playwright.config.ts만 추가됨.
- override 2(51-62): `**/__tests__/**`·`*.test.ts(x)`·`e2e/**` → `noNonNullAssertion:off` + `noEmptyPattern:off`. 테스트·e2e 디렉토리 한정 + 2개 규칙만.
- override 3(64-72): `examples/**` → `a11y.noLabelWithoutControl:off`. examples 한정 + 단일 규칙.
- **packages/** 소스 완화 없음 확인**: 세 override의 include 글롭 어느 것도 `packages/**` 제품 소스를 대상으로 하지 않음(config 파일명·e2e/·examples/ 디렉토리로만 한정). 전역 완화 숨김 없음.

### 3. react 훅 2개 biome-ignore 제거 = 동작 무변경 [PASS]
`use-pull-to-refresh.ts:45-46`·`use-scroll-container.ts:38-39` diff: **주석만 변경**(무효 `biome-ignore useExhaustiveDependencies` 지시자 → 일반 설명 주석). `useEffect(() => {...}, [])` 본문·빈 배열 dep 무변경(diff에 코드 라인 없음, context만). effect가 `optionsRef.current`(ref)만 읽어 reactive dep 없음 → 빈 배열 정확, suppression 불필요. 동작 보존.

### 4. e2e fixture void→undefined 소비자 정합 [PASS]
`e2e/fixtures/pull-to-refresh.ts:69` 반환타입 `Promise<PullHandle | void>` → `Promise<PullHandle | undefined>`.
- 소비자 3곳(`pull-to-refresh.gesture.spec.ts:15,30,42`): 15·30은 반환 폐기(무관), 42는 `const handle = await ...` → `if (!handle) throw`(43) 좁히기 → `handle.release()`(50).
- `void`는 유니온에서 멤버 접근·좁히기가 부정확하나 `undefined`는 정확히 narrow → 소비자 정합이 오히려 **개선**. `pnpm typecheck` exit 0이 정합 입증. (biome `noConfusingVoidType` red 해소가 변경 동기.)

**추가 확인(범위 밖 정리분):** `safe-area.spec.ts:28` 미사용 `browserName` 파라미터 제거 — 본문은 `testInfo.project.name`만 사용, 동작 무변경. `ScrollContainerDemo.tsx:76-77` eslint-disable→biome-ignore(유효 suppression), `useMemo(...,[])` 로직 무변경.

---

## 미해결 / 리더 판단 필요

1. **AC-03 grep 하위검증 명령 부정확** (구현 아닌 plan 결함): planner에게 `--reporter=verbose` 병기로 정정 요청 권장.
2. ~~**AC-06 lint 사전 red 13건**~~ → **해소됨(B-26 편입)**: `pnpm lint` 이제 exit 0. AC-06 lint 조건 정상 충족(위 "B-26 재검증 §1" 참조).
3. **AC-05 기계 재검증 불가**: 세션 권한 정책이 CLI threshold 오버라이드를 거부 → 기록+config원복 상태로 판정. 게이트 메커니즘 자체는 AC-04(하한 위 통과)로 정상 확인됨.
