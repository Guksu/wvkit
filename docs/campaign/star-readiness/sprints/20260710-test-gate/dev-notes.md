# dev-notes — Sprint 1 테스트 게이트 (implementer)

작성: 2026-07-10 · implementer

## 변경 파일 목록

| 파일 | 태스크 | 변경 내용 |
|---|---|---|
| `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` | T-02 | IME Enter 가드 회귀 테스트 3케이스 추가 (isComposing:true / keyCode:229 / 정상 Enter). 소스 미변경. |
| `packages/core/vitest.config.ts` | T-03 | `coverage.thresholds`에 glob per-file 하한 3개 추가 (camera-control / pull-to-refresh / stable-input). |
| `package.json` (루트) | T-03 | `test:coverage` 스크립트 추가 (`turbo run test -- --coverage`). |
| `.github/workflows/ci.yml` | T-01, T-03 | `ci` 잡에 "Coverage gate" 스텝 추가 + 신규 `e2e` 잡(병렬, needs 없음) 추가. |

소스 로직(`stable-input.ts` 등) 무변경 → react/vue 어댑터 재빌드·API 변경 불필요(계획 불변식 준수).

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 산출물 | 생산자 | 소비자 | 계약 / 검증 포인트 |
|---|---|---|---|
| `e2e` 잡 (`ci.yml`) | T-01 | GitHub Actions PR 게이트 | `pnpm test:e2e` → `playwright.config.ts` webServer(`:4173/wvkit/`) 4 프로젝트. 브라우저는 chromium+webkit 2종 설치로 4 프로젝트 커버. |
| `Coverage gate` 스텝 (`ci.yml`) | T-01/T-03 | core `vitest.config.ts` thresholds | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage`. threshold는 `--coverage`일 때만 평가됨 → 별도 스텝으로 강제. |
| IME 가드 테스트 | T-02 | `stable-input.ts:114-123` keydown 핸들러 | `kev.isComposing || kev.keyCode === 229` → `onSubmit` 미발화. 이벤트에 값이 실제로 실렸는지 `expect(ev.isComposing/keyCode)` 선행 자기검증 포함. |
| glob per-file thresholds | T-03 | `Coverage gate` 스텝 | camera-control 55/90, pull-to-refresh 80/85, stable-input 85/75 (branch/func). |
| `test:coverage` 스크립트 | T-03 | (로컬 편의) | `turbo run test -- --coverage`. CI 게이트는 core만 직접 필터로 돌림. |

## 실행한 검증 명령과 결과 (AC별)

> 주의: 계획서 AC 명령은 `@wvkit/core` 필터를 쓰지만 실제 패키지명은 **`@guksu/wvkit-core`** (v0.3.1 리네임). 아래는 실제 패키지명으로 실행.

- **AC-01** (워크플로 구조):
  - `grep playwright install` → exit 0
  - `grep -E "chromium\s+webkit|webkit\s+chromium"` → exit 0
  - `grep test:e2e` → exit 0
  - `grep upload-artifact` → exit 0
  - `python3 -c "... 'e2e' in d['jobs']"` → exit 0 (pyyaml 설치 필요 — `pip3 install pyyaml --break-system-packages`)
  - `python3 -c "... print('OK')"` → `OK`, exit 0
- **AC-02** (e2e 실행): `pnpm build` 후 `pnpm test:e2e` → **exit 0**, 186 passed / 10 skipped (mobile-only VK 등 skip).
- **AC-03** (IME 가드):
  - `pnpm --filter @guksu/wvkit-core exec vitest run stable-input` → **exit 0** (21 tests, 기존 18 + 신규 3).
  - 3개 의미 단언 존재: isComposing:true→`toHaveBeenCalledTimes(0)`, keyCode:229→`(0)`, 정상 Enter→`(1)` + `toHaveBeenCalledWith('한글')`.
  - ⚠ `grep -c "isComposing|229|IME|조합"`: **기본 리포터에서는 0** (passing 테스트 타이틀을 non-TTY에서 출력하지 않음). `--reporter=verbose`로는 **3**. 아래 트레이드오프 참조.
- **AC-04** (threshold 존재·통과):
  - `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` → **exit 0**.
  - 실측 vs 설정: camera-control branch 56.52/func 94.73 (>55/90), pull-to-refresh 82.1/88.46 (>80/85), stable-input branch **90**(신규 테스트로 상승)/func 78.57 (>85/75). 전부 하한 위.
  - `grep thresholds` exit 0, 3파일 grep exit 0.
- **AC-05** (게이트 실효성 — 음성):
  - camera-control branch 임시 `55→99` → `vitest run --coverage` **exit 1** (`ERROR: Coverage for branches (56.52%) does not meet "**/camera-control.ts" threshold (99%)`).
  - 원복 후 재실행 → **exit 0**. (config는 원상복구됨.)
- **AC-06** (회귀 없음):
  - `pnpm test` → **exit 0** (core 192 / react 25 / vue 24 = 241).
  - `pnpm typecheck` → **exit 0**.
  - `pnpm lint` → **exit 1** ⚠ — 그러나 13개 오류 전부 **이번 스프린트가 건드리지 않은 기존 파일**(e2e/, examples/, packages/react/, packages/vue/). 내 4개 변경 파일은 `biome lint`로 개별 검사 시 **exit 0**(클린). main에 이미 존재하던 red. 아래 참조.

## 트레이드오프 / 리더 확인 필요 사항

1. **패키지명 불일치**: 계획서 AC·본문이 `@wvkit/core`를 쓰나 실제는 `@guksu/wvkit-core`(v0.3.1에서 `@guksu/*` 스코프로 리네임). ci.yml Coverage gate와 모든 검증을 실제 이름으로 작성/실행함. e2e webServer가 참조하는 `@wvkit/react-example`는 실제로도 그 이름이라 무변경.
2. **AC-06 `pnpm lint` 사전 실패(pre-existing)**: 13개 오류 + 2 warning이 e2e·examples·react·vue의 기존 코드에 존재(noDefaultExport, noNonNullAssertion, noLabelWithoutControl, useExhaustiveDependencies, suppressions/unused 등). 이번 스프린트 변경분과 무관하며, 계획 "범위 제외"(기존 코드 리팩토링)에 해당해 손대지 않음. AC-06의 lint→exit 0 전제가 현재 main 상태와 맞지 않음. **별도 백로그로 분리 권장.**
3. **AC-03 grep 리포터 의존성**: `grep -c` 하위 검증은 vitest 기본 리포터가 통과 테스트 타이틀을 출력하지 않아 0을 반환. 의미 단언(코드 내 3개)과 exit 0은 충족. 게이트 명령을 유지하려면 `--reporter=verbose` 병기 필요(그 경우 count=3). 소스/테스트가 아닌 AC 명령 표현의 문제.

---

## 추가 작업 — B-26 (사전 lint red 13건 + 무효 biome-ignore 정리)

리더 판단으로 Sprint 1에 편입(근거: ci.yml lint 스텝 = `pnpm lint`라 이 상태면 브랜치 PR이 방금 추가한 게이트에서 red로 시작 → 그린 게이트의 블로커).

### 변경 파일 (B-26)

| 파일 | 조치 | 근거 |
|---|---|---|
| `packages/react/src/components/scroll-container/use-scroll-container.ts` | 무효 `biome-ignore`(L41) 제거 → 일반 설명 주석으로 대체 | effect가 `optionsRef.current`(ref)만 읽어 reactive dep이 없음 → biome이 useExhaustiveDependencies를 애초에 안 잡음. suppression이 no-op. **라이브러리 소스 코드 수정 우선(rule 2)**, 동작 변경 없음. |
| `packages/react/src/components/pull-to-refresh/use-pull-to-refresh.ts` | 무효 `biome-ignore`(L48) 제거 → 일반 설명 주석 | 위와 동일 패턴(ref-only effect). |
| `e2e/specs/safe-area.spec.ts` | 미사용 구조분해 `browserName` 제거(L28) | 실제 unused var — 코드 수정(rule a). |
| `e2e/fixtures/pull-to-refresh.ts` | 반환 타입 `Promise<PullHandle \| void>` → `\| undefined`(L69) | noConfusingVoidType. 함수는 실제로 `undefined`(bare return) 또는 `PullHandle` 반환 → undefined가 정확. 코드 수정(rule a). |
| `examples/react-example/src/ScrollContainerDemo.tsx` | 죽은 `eslint-disable`(biome 무시) → 동작하는 `biome-ignore`로 교체 + useMemo 1줄로 정리 | 데모의 의도적 빈 deps(언어 전환 시 패널 재빌드 안 함). biome-ignore는 flagged 라인(useMemo) 바로 위에 있어야 함. |
| `biome.json` | override 3건 추가/확장 | 아래. |

### biome.json override 근거 (프레임워크 요구·품질 무관 영역 — rule 1b/1c)

- config override에 `**/playwright.config.ts` 추가 → `noDefaultExport` off. **Playwright config는 default export 필수**(프레임워크 요구, rule 1b). 기존에 tsup/vitest/vite config가 같은 이유로 이미 override됨 — 일관.
- test override include에 `e2e/**` 추가 → `noNonNullAssertion` off. e2e 스펙의 `expect(x).not.toBeNull()` 직후 `x!`는 테스트 정형 패턴. 기존 `**/*.test.ts` 결정과 동일 취지(테스트 코드는 non-null assertion 허용). **`.spec.ts`가 override에 없어 누락됐던 것**을 정합.
- 같은 test override에 `noEmptyPattern` off 추가 → **Playwright fixture API가 첫 인자에 객체 구조분해 패턴(`{}`)을 강제**(`_fixtures`로 바꾸면 "First argument must use the object destructuring pattern" 런타임 에러 — 실제로 검증함). 프레임워크 요구(rule 1b).
- examples override 신설(`examples/**`) → `a11y/noLabelWithoutControl` off. `ControlItem`의 `<label>`은 caller가 넘긴 폼 컨트롤(children)을 감싸므로 런타임엔 연결되나 biome이 정적으로 확인 불가. **데모 앱(라이브러리 소스 아님, rule 1c)** — 경로 override가 적절.

전역 규칙 비활성화는 하지 않음(rule 1). 모든 override는 경로+규칙 단위.

### 무효 biome-ignore 건수 정정

리더는 "3건"으로 전달했으나, biome이 `suppressions/unused`로 실제 리포트한 것은 **2건**(use-scroll-container:41, use-pull-to-refresh:48). packages/react에 useExhaustiveDependencies용 biome-ignore가 총 4개 있는데, scroll-lock:14 / virtual-keyboard:14는 effect가 `options.*`(prop)를 직접 읽어 규칙이 실제 발화 → suppression이 **유효**하므로 유지. 죽은 2건만 제거함.

### B-26 검증 결과 (exit code)

- `pnpm lint` → **exit 0** (기존 13 errors + 2 warnings → 0/0. `suppressions/unused` grep count 0).
- `pnpm typecheck` → **exit 0**.
- `pnpm test` → **exit 0** (core 192 / react 25 / vue 24).
- `pnpm test:e2e` → **exit 0** (186 passed / 10 skipped — e2e 파일 변경분 회귀 없음 재확인). 중간에 `_fixtures` 시도가 Playwright 런타임 제약으로 실패 → `{}` 유지 + biome override로 전환(위 근거).
