# Sprint 1 — 테스트 게이트 구현 (implementer)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 관련 경로 | `.github/workflows/ci.yml`, `package.json`, `packages/core/vitest.config.ts`, `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` |

## 1. 개요

star-readiness 캠페인 Sprint 1의 목표는 CI가 e2e와 커버리지를 PR 게이트로 강제하게 만드는 것이다. 계획서(`docs/campaign/star-readiness/sprints/20260710-test-gate/plan.md`)의 T-01(CI e2e 잡) · T-02(한글 IME Enter 가드 단위 테스트) · T-03(커버리지 threshold)을 TDD로 구현하고 인수조건 AC-01~AC-06으로 기계 검증했다. Sprint 2 이후(핵심 수식 단위검증, three 분리)의 회귀 가드 전제를 세우는 작업이다.

## 2. 작업내용

- **T-02 (IME 가드 테스트)** — `packages/core/src/components/stable-input/__tests__/stable-input.test.ts`: 기존 "Enter 키 입력 시 onSubmit" 테스트 옆에 3케이스 추가. (1) `isComposing:true` Enter → onSubmit 미호출, (2) `keyCode:229`(isComposing 미채움 구형 WebView) Enter → 미호출, (3) 조합 종료 후 정상 Enter → 정확히 1회 호출. happy-dom의 KeyboardEvent가 `isComposing`/`keyCode`를 반영하지 않아 `Object.defineProperty`로 주입하고, `expect(ev.isComposing/keyCode)` 선행 단언으로 이벤트에 값이 실렸는지 자기검증. 소스(`stable-input.ts`)는 변경하지 않음(가드 기 구현 → Green 정상).
- **T-03 (커버리지 threshold)** — `packages/core/vitest.config.ts`에 `coverage.thresholds` glob per-file 하한 3개 추가: `**/camera-control.ts`(branches 55/functions 90), `**/pull-to-refresh.ts`(80/85), `**/stable-input.ts`(85/75). 실측 스냅샷보다 약간 낮게 잡아 즉시 통과하되 회귀 시 red. 루트 `package.json`에 `test:coverage`(`turbo run test -- --coverage`) 스크립트 추가.
- **T-01 (CI e2e 잡 + Coverage gate)** — `.github/workflows/ci.yml`: 기존 `ci` 잡에 "Coverage gate" 스텝(`pnpm --filter @guksu/wvkit-core exec vitest run --coverage`) 추가. 신규 `e2e` 잡을 병렬(needs 없음)로 추가: checkout → pnpm setup → node20/cache pnpm → install → `playwright install --with-deps chromium webkit` → `pnpm build` → `pnpm test:e2e` → `upload-artifact`(`if: !cancelled()`, `test-results/**` + `playwright-report/**`).
- **검증** — AC-01(grep 4건 + python yaml 2건) exit 0, AC-02(e2e) 186 passed/10 skipped exit 0, AC-03(stable-input 21 tests) exit 0, AC-04(coverage) exit 0, AC-05(음성: branch 99로 exit 1 확인 후 원복), AC-06 typecheck·test exit 0.

## 3. 주의사항

- **패키지명 불일치**: 계획서 AC는 `@wvkit/core` 필터를 쓰지만 실제 패키지명은 `@guksu/wvkit-core`(v0.3.1 리네임). ci.yml Coverage gate 스텝과 모든 로컬 검증은 실제 이름으로 작성/실행했다. 후속 계획서 AC 명령도 실제 이름으로 정정 필요.
- **`pnpm lint`가 이미 red (사전 존재)**: AC-06은 lint→exit 0을 기대하지만 현재 main에 13개 lint 오류가 있다(e2e/, examples/, packages/react/, packages/vue/의 기존 코드 — noDefaultExport, noNonNullAssertion, noLabelWithoutControl, useExhaustiveDependencies 등). 이번 스프린트 변경 4개 파일은 개별 lint 클린이며 오류를 유발하지 않았다. 계획 "범위 제외"(기존 리팩토링)에 해당해 손대지 않았다. 별도 백로그(lint 정리)로 분리 권장.
- **AC-05 config 원복 완료**: camera-control threshold를 55→99로 임시 변경해 게이트 실효성(exit 1)을 확인한 뒤 원상복구했다. 현재 값은 55/90.
- **AC-03 grep 하위검증은 리포터 의존**: `grep -c "isComposing|229|IME|조합"`는 vitest 기본 리포터에서 0(통과 테스트 타이틀 미출력), `--reporter=verbose`에서 3. 의미 단언과 exit 0은 충족. 게이트 명령 유지 시 verbose 병기 필요.
- **pyyaml**: AC-01 python yaml 검증에 pyyaml이 필요해 로컬에 설치했다(`pip3 install pyyaml --break-system-packages`). CI에는 영향 없음(파이썬 검증은 로컬 AC 확인용).
- git 커밋/푸시는 하지 않았다(사용자 전담).

## 4. 추가 작업 — B-26 (사전 lint red 정리, 리더 편입)

Sprint 1 CI 게이트의 lint 스텝이 `pnpm lint`와 동일해, 사전 존재하던 lint red 13건이 이 브랜치 PR을 즉시 red로 만드는 블로커였다. 리더 승인으로 편입해 `pnpm lint` exit 0으로 만들었다.

- **라이브러리 소스 코드 수정 우선**: `use-scroll-container.ts`·`use-pull-to-refresh.ts`의 무효 `biome-ignore` 2건 제거(effect가 ref만 읽어 규칙 미발화 → suppression no-op, 동작 무변경). scroll-lock·virtual-keyboard의 biome-ignore 2건은 실제 유효(prop 직접 참조)라 유지 — 리더가 언급한 "3건"은 biome 실측 2건으로 정정.
- **e2e 코드 수정**: `safe-area.spec.ts` 미사용 `browserName` 제거, `fixtures/pull-to-refresh.ts` 반환 타입 `void`→`undefined`(noConfusingVoidType).
- **examples 코드 수정**: `ScrollContainerDemo.tsx`의 죽은 `eslint-disable`를 동작하는 `biome-ignore`로 교체(flagged 라인 바로 위 배치).
- **biome.json override(프레임워크 요구·품질 무관 영역)**: playwright.config.ts에 noDefaultExport off(config는 default export 필수), e2e/**에 noNonNullAssertion·noEmptyPattern off(테스트 정형 + Playwright fixture가 `{}` 강제 — `_fixtures` 시도가 런타임 에러로 실패해 확인), examples/**에 a11y/noLabelWithoutControl off(데모 앱). 전역 규칙 비활성화 없음, 경로+규칙 단위만.
- **검증**: `pnpm lint`/`typecheck`/`test`/`test:e2e` 전부 exit 0 (13 errors+2 warnings → 0). e2e 186 passed/10 skipped 회귀 없음.
