# QA Report — Sprint "trust-fixes" (B-03 + B-11 + B-12)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 입력 | plan.md, dev-notes.md, 변경 코드 (브랜치 chore/quality-sprint-1) |
| 판정 방식 | 인수조건 전 항목 직접 재실행 (exit code) + 경계면 소스 대조 + 신규 테스트 껍데기 판정 |

## 총평

**16/16 PASS + 최종 게이트 PASS. FAIL 0건.** 모든 인수조건을 QA가 리포 루트에서 직접 재실행해 exit code로 판정했다 (구현자 자기보고 미신뢰). dev-notes의 주장(테스트 수 core 228/react 26/vue 25, lockfile diff 0)과 실측이 일치했다.

## 인수조건 판정

### T-01 (B-03) — 패키지명 통일

| # | 항목 | 판정 | 근거 (직접 실행) |
|---|------|------|------------------|
| AC-1 | 대상 범위 구명칭 `@wvkit/` 잔존 0 | **PASS** | `grep -rn '@wvkit/' docs/components README.md README.ko.md CLAUDE.md packages/{react,vue}/tsup.config.ts` → 매치 없음 (grep exit 1 = 조건 충족) |
| AC-2 | 배지 라벨 실배포명 (EN+KO ×3) | **PASS** | `label=%40guksu%2Fwvkit-{core,react,vue}` 6조합 전부 존재 → exit 0 |
| AC-3 | 전체 빌드 green | **PASS** | `pnpm build` → exit 0 (5 tasks successful) |
| AC-4 | core external 유지 (인라인 회귀 없음) | **PASS** | react/vue `dist/index.js`에 `from '@guksu/wvkit-core'` import 문 존재. dist 내 `createScrollContainer` 매치는 import+호출부 2건뿐, `OrthographicCamera` 등 core 구현체 인라인 0건. CJS도 `require('@guksu/wvkit-core')` 확인 |

추가 교차검증 (경계면 매핑):
- CLAUDE.md 소스오브트루스: 네이밍 표·blockquote 지시문이 `@guksu/wvkit-*`로 정정됨 + 스코프 배경 부기(49행, 슬래시 없는 표기로 AC-1과 충돌 없음). `packages/*/package.json` name 필드(`@guksu/wvkit-{core,react,vue}`)와 일치. CLAUDE.md는 gitignore 대상(`git check-ignore` 확인)이라 diff에 안 보임 — 파일 내용으로 검증 완료.
- 치환 금지 항목 준수: `e2e/playwright.config.ts`의 `@wvkit/react-example`(예제 실제 name 필드와 일치) 미변경, `docs/worklog/*`·`docs/qa/*`·CHANGELOG 역사 기록 미변경 (git status에 해당 파일 수정 없음).

### T-02 (B-11) — WebviewHeadlessError 값 export

| # | 항목 | 판정 | 근거 (직접 실행) |
|---|------|------|------------------|
| TC-5 | core 배럴 값 import | **PASS** | verbose 출력에 `✓ … exports WebviewHeadlessError as a value` |
| TC-6 | 인스턴스 시맨틱 (instanceof ×2, name, message) | **PASS** | `✓ … instance carries name and message` |
| TC-7 | 팩토리 throw를 배럴 클래스로 instanceof catch | **PASS** | `✓ … factory throw is catchable via instanceof` |
| TC-8 | react 배럴 재노출 | **PASS** | react test exit 0 + `✓ … re-exports WebviewHeadlessError` |
| TC-9 | vue 배럴 재노출 | **PASS** | vue test exit 0 + `✓ … re-exports WebviewHeadlessError` |
| AC-10 | dist ESM 런타임 도달 | **PASS** | `import('./packages/core/dist/index.js')` → `typeof m.WebviewHeadlessError === 'function'` → exit 0 |
| AC-11 | dist CJS 런타임 도달 | **PASS** | `require('./packages/core/dist/index.cjs')` 동일 → exit 0 |

껍데기 테스트 판정 — **load-bearing 확인**:
- `packages/core/src/__tests__/public-api.test.ts`: 단순 존재 확인이 아님. TC-6은 `instanceof WebviewHeadlessError` + `instanceof Error` + `name`/`message` 값 단언, TC-7은 **배럴 import 클래스와 core 내부 throw 인스턴스(`pull-to-refresh.ts:375`, `threshold <= 0` 가드)의 클래스 동일성**을 검증 — 이중 클래스 인스턴스(중복 번들) 회귀를 잡는 실질 단언.
- react/vue `public-api.test.ts`: `typeof === 'function'` + `new … instanceof Error` — 재노출이 type-only로 퇴행하면 즉시 red가 되는 단언. dev-notes의 Red→Green 기록(구현 전 core 2 failed / react·vue 각 1 failed)과 정합.
- 소스 대조: `core/src/index.ts:1` `export { WebviewHeadlessError } from './errors'` (값 export), react/vue `src/index.ts`에 `export { WebviewHeadlessError } from '@guksu/wvkit-core'` — dist ESM에도 런타임 re-export 문 실재.

### T-03 (B-12) — three peer 완화

| # | 항목 | 판정 | 근거 (직접 실행) |
|---|------|------|------------------|
| AC-12 | 하한 실측 매트릭스 존재 + exit 0 기록 | **PASS** | `three-floor-matrix.md` 존재, 0.160.0에서 typecheck/build/test 각 exit 0 기록 + 원복 재확인 표 포함 |
| AC-13 | peer가 `>=x.y.z` 형식 | **PASS** | `peerDependencies.three === ">=0.160.0"` → 정규식 매치 exit 0 |
| AC-14 | 현행 three(0.184)에서 core green | **PASS** | typecheck && test(228 passed) && build → exit 0 |
| AC-15 | devDep 원복 (`^0.184.0` ×2) | **PASS** | `three`·`@types/three` 모두 `^0.184.0` → exit 0 |

추가 교차검증: `git diff --stat -- pnpm-lock.yaml` → 빈 출력 (dev-notes 주장대로 lockfile 최종 diff 0). `peerDependenciesMeta.three.optional` 유지 여부는 AC-13 실행 시 package.json에서 함께 확인.

### T-04 — changeset

| # | 항목 | 판정 | 근거 |
|---|------|------|------|
| AC-16 | 3패키지 minor changeset | **PASS** | `.changeset/20260710-trust-fixes.md` — core/react/vue 3패키지 모두 `minor`, 변경 요약(값 export + peer 완화 + external 정정) 포함 → exit 0 |

### 최종 게이트

| 명령 | 결과 |
|------|------|
| `pnpm lint && pnpm typecheck && pnpm build && pnpm test` | **PASS** — exit 0 (lint 125files clean, typecheck 6 tasks, build 5 tasks, test core 228 / react 26 / vue 25 전부 passed) |

## 관찰 (FAIL 아님 — 리더 참고)

1. **react/vue TC-8/9의 import 지점**: plan 표기는 "`@guksu/wvkit-react` 배럴"이나 실제 테스트는 `../index`(배럴 소스)를 import. 재노출 문 자체는 `@guksu/wvkit-core`(workspace dist)를 경유하므로 검증 목적(재노출 존재+런타임 값)은 충족 — 동등 구현으로 판정.
2. **AC-10/11 한계 인지**: dist 스모크는 three devDep 설치 상태(리포 내) 전제로만 통과 — plan 범위 제외(B-02, Sprint 4)에 명시된 그대로.
3. git status의 무관 변경(backlog.md, stable-input 테스트, vitest.config, camera-control.gestures 등)은 이전 스프린트 미커밋 산출물로 dev-notes 기재와 일치 — 본 스프린트 판정에 미포함.

## 결론

**전 항목 PASS — 스프린트 인수 가능.** 수정 요청 없음.
