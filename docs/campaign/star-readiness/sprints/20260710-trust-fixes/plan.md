# Sprint 3 — 신뢰 붕괴 수정 (trust-fixes)

| 항목 | 내용 |
|------|------|
| 백로그 | B-03(패키지명 불일치 일괄 정정) + B-11(WebviewHeadlessError 값 export) + B-12(three peer 범위 완화) |
| 근거 | audit-docs-dx.md P0-2·P1(배지)·P2(소스오브트루스), audit-code-ci.md P1(tsup external :30, 타입-only export :24, three peer :32) |
| 브랜치 | chore/quality-sprint-1 (git 변경 명령은 사용자 전담) |
| 작성 | planner (2026-07-10) |

## 목표

npm에서 wvkit을 발견한 사용자의 **첫 5분 신뢰**를 복구한다.

1. **B-03**: 문서·배지·CLAUDE.md·빌드 설정에 남은 구명칭 `@wvkit/*`을 실배포명 `@guksu/wvkit-*`로 통일 (사용자 확정). 문서 복붙 시 `npm error 404` 즉사 경로 제거 + 소스오브트루스(CLAUDE.md) 정정으로 재발 차단.
2. **B-11**: `WebviewHeadlessError`를 값으로 export해 소비자가 `err instanceof WebviewHeadlessError`로 라이브러리 에러를 식별할 수 있게 한다 (현재 `core/src/index.ts:1`이 `export type`이라 런타임 catch 불가).
3. **B-12**: `three` peer 범위를 caret(`^0.184.0` = 0.184.x 고정)에서 **실측 검증된 하한 범위**로 완화해, 최신 three를 쓰는 호스트 앱의 peer 경고를 제거한다.

## 태스크

### T-01 (B-03) — 패키지명 `@guksu/wvkit-*` 일괄 통일

구명칭 `@wvkit/{core,react,vue}` → 실배포명 `@guksu/wvkit-{core,react,vue}` 치환. **대상 4개 그룹**:

1. **문서 코드샘플 12파일** (audit-docs P0-2, 총 64개소):
   - `docs/components/{scroll-container,stable-input,virtual-keyboard,safe-area,scroll-lock,pull-to-refresh}/index.md` 및 `index.ko.md`
   - import 경로 3종 치환: `@wvkit/core`→`@guksu/wvkit-core`, `@wvkit/react`→`@guksu/wvkit-react`, `@wvkit/vue`→`@guksu/wvkit-vue`
2. **README 배지 라벨 2파일** (audit-docs P1): `README.md:5-7`, `README.ko.md:5-7`
   - `label=%40wvkit%2Fcore` → `label=%40guksu%2Fwvkit-core` (react/vue 동일 패턴). 링크 URL은 이미 실배포명 — 라벨만 수정.
3. **CLAUDE.md** (audit-docs P2 — 소스오브트루스 정정):
   - "패키지 네이밍" 섹션: 표의 npm 이름 3종 + blockquote 지시문("모든 곳에서 `@wvkit/*` 형태를 사용할 것")을 실배포명 기준으로 정정. 스코프 배경(구명칭 `@wvkit/*`는 npm 스코프 미확보로 `@guksu/wvkit-*`로 배포) 1줄 부기.
   - 컴포넌트 스펙 내 모든 import 샘플(`@wvkit/core`·`@wvkit/react`·`@wvkit/vue`)과 커맨드 예시(`pnpm --filter @wvkit/core build`) 치환.
4. **tsup external 오기 2파일** (audit-code P1):
   - `packages/react/tsup.config.ts:10`: `external: ['react', 'react-dom', '@wvkit/core']` → `'@guksu/wvkit-core'`
   - `packages/vue/tsup.config.ts:10`: `external: ['vue', '@wvkit/core']` → `'@guksu/wvkit-core'`

**완료 기준**: 아래 인수조건 AC-1~AC-4. 특히 치환 후 react/vue dist에서 core가 여전히 external(import 유지, 인라인 아님)임을 빌드 산출물로 확인.

**주의**: `e2e/playwright.config.ts:42`의 `pnpm --filter @wvkit/react-example`은 예제 패키지의 **실제 name 필드**(`examples/react-example/package.json:2`)와 일치하는 유효 참조이므로 **치환 금지** (예제 리네이밍은 범위 제외 참조). AC-1의 grep 범위에서 의도적으로 제외되어 있다.

### T-02 (B-11) — `WebviewHeadlessError` 값 export (TDD)

**테스트 먼저 작성 → red 확인 → 구현 → green.**

**신규 테스트** (인수조건 TC-5~TC-9의 구현체):

- `packages/core/src/__tests__/public-api.test.ts` (신규 디렉토리 — core vitest 기본 include가 수용):
  - TC-5: 배럴(`../index`)에서 `WebviewHeadlessError`를 값으로 import → `typeof WebviewHeadlessError === 'function'`
  - TC-6: `new WebviewHeadlessError('boom')` → `instanceof WebviewHeadlessError` && `instanceof Error` && `name === 'WebviewHeadlessError'` && `message === 'boom'`
  - TC-7: 배럴 import한 팩토리의 throw를 배럴 import한 클래스로 식별 — `expect(() => createPullToRefresh(el, { onRefresh: () => {}, threshold: 0 })).toThrowError(WebviewHeadlessError)` (`pull-to-refresh.ts:374`의 `threshold <= 0` 가드 경유)
- `packages/react/src/__tests__/public-api.test.ts`: TC-8 — `@guksu/wvkit-react` 배럴 재노출 값 import → `typeof === 'function'` && `new … instanceof Error`
- `packages/vue/src/__tests__/public-api.test.ts`: TC-9 — vue 배럴 동일 단언

**구현** (테스트 red 확인 후):

- `packages/core/src/index.ts:1`: `export type { WebviewHeadlessError } from './errors';` → `export { WebviewHeadlessError } from './errors';` (값 export 시 타입은 자동 동반)
- `packages/react/src/index.ts`: `export { WebviewHeadlessError } from '@guksu/wvkit-core';` 추가
- `packages/vue/src/index.ts`: `export { WebviewHeadlessError } from '@guksu/wvkit-core';` 추가

**완료 기준**: TC-5~TC-9 green + dist 스모크 AC-10·AC-11 (ESM/CJS 양쪽에서 값 도달 — d.ts만 바뀌고 런타임 미노출되는 회귀 방지).

### T-03 (B-12) — three peer 하한 범위 실측 후 완화

**절차 (실측 → 결정 → 반영)**:

1. **사용 API 표면** (참고): `three` 값 사용은 `scroll-container.ts:1-2`뿐 — `OrthographicCamera`, `Scene`, `CSS3DObject`/`CSS3DRenderer`(`three/examples/jsm/renderers/CSS3DRenderer.js`). `camera-control.ts:1`은 type-only.
2. **하한 후보 매트릭스 실측**: 후보 `0.160.0`(감사 제안)부터. core의 devDependencies `three`·`@types/three`를 후보 버전으로 임시 교체(`pnpm --filter @guksu/wvkit-core add -D three@0.160.0 @types/three@0.160.0`) 후:
   - `pnpm --filter @guksu/wvkit-core typecheck && pnpm --filter @guksu/wvkit-core build && pnpm --filter @guksu/wvkit-core test` → 전부 exit 0이면 하한 성립
   - 실패 시 `0.170.0` → `0.180.0` 순으로 상향하며 통과하는 최저 후보를 하한으로 채택
   - 각 시도의 (버전, 명령, exit code)를 `docs/campaign/star-readiness/sprints/20260710-trust-fixes/three-floor-matrix.md`에 기록
3. **원복**: devDependencies를 현행(`three@^0.184.0`, `@types/three@^0.184.0`)으로 되돌리고 (git 명령 아닌 package.json 편집 + `pnpm install`) 현행 버전에서도 green 재확인.
4. **반영**: `packages/core/package.json` `peerDependencies.three`: `"^0.184.0"` → `">=<채택 하한>"` (예: `">=0.160.0"`). `peerDependenciesMeta.three.optional: true`는 유지. devDependencies는 최신 유지(개발·타입체크 기준).

**완료 기준**: AC-12~AC-15. 매트릭스 파일이 하한 채택 근거(실측 exit code)를 담을 것.

**주의**: pnpm add/install은 `pnpm-lock.yaml`을 수정한다 — 최종 상태에서 lockfile이 원복(현행 devDep) + 실측 기록만 남는지 QA가 `git diff --stat`(읽기)로 확인. 네트워크 필요.

### T-04 — changeset 작성 (릴리즈 흐름 연결)

PR-기반 Changesets 흐름(d69ff57~)에 맞춰 `.changeset/*.md` 1건 추가:

- `@guksu/wvkit-core`: **minor** — `WebviewHeadlessError` 값 export(신규 public API) + three peer 범위 완화
- `@guksu/wvkit-react`: **minor** — `WebviewHeadlessError` 재노출 + tsup external 정정
- `@guksu/wvkit-vue`: **minor** — `WebviewHeadlessError` 재노출 + tsup external 정정

문서(docs/·README·CLAUDE.md) 변경은 changeset 불요. **완료 기준**: AC-16.

## 인수조건 (기계 검증 — 명령 + 기대 exit code)

모든 명령은 리포 루트(`/Users/kimjongmin/dev/wvkit`)에서 실행. vitest grep 검증은 non-TTY에서 통과 타이틀이 생략되므로 반드시 `--reporter=verbose` (Sprint 1 교훈).

### T-01 (B-03)

| # | 검증 | 명령 | 기대 |
|---|------|------|------|
| AC-1 | 대상 범위에 구명칭 잔존 0 | `grep -rn '@wvkit/' docs/components README.md README.ko.md CLAUDE.md packages/react/tsup.config.ts packages/vue/tsup.config.ts; test $? -eq 1` | exit 0 |
| AC-2 | 배지 라벨 실배포명 (EN+KO ×3패키지) | `for f in README.md README.ko.md; do for p in core react vue; do grep -q "label=%40guksu%2Fwvkit-$p" $f || exit 1; done; done` | exit 0 |
| AC-3 | 전체 빌드 green | `pnpm build` | exit 0 |
| AC-4 | 치환 후에도 core가 어댑터 번들에서 external 유지(인라인 회귀 방지) | `grep -q '@guksu/wvkit-core' packages/react/dist/index.js && grep -q '@guksu/wvkit-core' packages/vue/dist/index.js` | exit 0 |

### T-02 (B-11) — 인수조건 = 테스트 케이스

| # | 검증 | 명령 | 기대 |
|---|------|------|------|
| TC-5 | core 배럴 값 import (`typeof === 'function'`) | `pnpm --filter @guksu/wvkit-core test -- --reporter=verbose 2>&1 \| grep -F "exports WebviewHeadlessError as a value"` | exit 0 |
| TC-6 | 인스턴스 시맨틱(instanceof Error, name, message) | 위 verbose 출력에서 `grep -F "instance carries name and message"` | exit 0 |
| TC-7 | 팩토리 throw를 배럴 클래스로 instanceof catch | 위 verbose 출력에서 `grep -F "factory throw is catchable via instanceof"` | exit 0 |
| TC-8 | react 배럴 재노출 | `pnpm --filter @guksu/wvkit-react test -- --reporter=verbose 2>&1 \| grep -F "re-exports WebviewHeadlessError"` | exit 0 |
| TC-9 | vue 배럴 재노출 | `pnpm --filter @guksu/wvkit-vue test -- --reporter=verbose 2>&1 \| grep -F "re-exports WebviewHeadlessError"` | exit 0 |
| AC-10 | dist ESM 런타임 도달 | `pnpm --filter @guksu/wvkit-core build && node --input-type=module -e "import('./packages/core/dist/index.js').then(m => process.exit(typeof m.WebviewHeadlessError === 'function' ? 0 : 1))"` | exit 0 |
| AC-11 | dist CJS 런타임 도달 | `node -e "const m = require('./packages/core/dist/index.cjs'); process.exit(typeof m.WebviewHeadlessError === 'function' ? 0 : 1)"` | exit 0 |

> AC-10/11 주의: `dist/index.{js,cjs}`는 `three`를 정적 로드(B-02, Sprint 4 예정)하므로 리포 루트에서(three devDep 설치 상태) 실행해야 한다. 실패 시 three 미해결인지 export 미노출인지 에러 메시지로 구분할 것. 테스트 타이틀 문자열(TC-5~9)은 grep 대상이므로 구현 시 변경 금지.

### T-03 (B-12)

| # | 검증 | 명령 | 기대 |
|---|------|------|------|
| AC-12 | 하한 실측 기록 존재 + 채택 하한에서 typecheck/build/test exit 0 기록 포함 | `test -f docs/campaign/star-readiness/sprints/20260710-trust-fixes/three-floor-matrix.md && grep -q 'exit 0' docs/campaign/star-readiness/sprints/20260710-trust-fixes/three-floor-matrix.md` | exit 0 |
| AC-13 | peer가 caret이 아닌 하한 범위 형식 | `node -e "const r = require('./packages/core/package.json').peerDependencies.three; process.exit(/^>=\d+\.\d+\.\d+$/.test(r) ? 0 : 1)"` | exit 0 |
| AC-14 | 현행 three(0.184)에서 core green 유지 | `pnpm --filter @guksu/wvkit-core typecheck && pnpm --filter @guksu/wvkit-core test && pnpm --filter @guksu/wvkit-core build` | exit 0 |
| AC-15 | devDep 원복 확인(개발 기준은 최신 유지) | `node -e "const d = require('./packages/core/package.json').devDependencies; process.exit(d.three === '^0.184.0' && d['@types/three'] === '^0.184.0' ? 0 : 1)"` | exit 0 |

### T-04

| # | 검증 | 명령 | 기대 |
|---|------|------|------|
| AC-16 | 3패키지 minor changeset 존재 | `f=$(grep -rl 'wvkit-core' .changeset --include='*.md' \| grep -v README); test -n "$f" && grep -q 'wvkit-react' $f && grep -q 'wvkit-vue' $f && grep -q 'minor' $f` | exit 0 |

**최종 게이트**: `pnpm lint && pnpm typecheck && pnpm build && pnpm test` 전부 exit 0 (기존 스위트 무회귀 — 커버리지 threshold는 `--coverage` 실행 시에만 평가되며, 본 스프린트는 테스트 추가만 하므로 하한 하락 없음).

## 경계면 매핑 (생산자 ↔ 소비자)

| 경계면 | 생산자 | 소비자 | qa 교차검증 포인트 |
|--------|--------|--------|--------------------|
| 설치 커맨드/import 경로 | docs/components 12파일, README ×2 | 신규 사용자(복붙 설치) | 문서 내 모든 패키지 참조가 `npm view @guksu/wvkit-core` 등으로 실존 확인 가능한 이름인가 (AC-1) |
| 네이밍 소스오브트루스 | CLAUDE.md 패키지 네이밍 섹션 | 이후 모든 에이전트·문서 편집 | CLAUDE.md 지시문과 packages/*/package.json name 필드 일치 (재발 차단) |
| 번들 경계 (external) | packages/{react,vue}/tsup.config.ts | react/vue dist → 소비자 번들러 | dist에 core 코드 인라인 없음, `@guksu/wvkit-core` import 문 유지 (AC-4) |
| 에러 클래스 | core 배럴 (`src/index.ts`) → dist ESM/CJS | react/vue 배럴 재노출 → 앱의 `try/catch + instanceof` | 세 배럴 모두에서 값 import 가능 + core 내부 throw 인스턴스와 배럴 export가 동일 클래스 (TC-7) |
| peer 해석 | core package.json `peerDependencies.three` | 호스트 앱 패키지 매니저(peer 경고/충돌) | 하한 실측 매트릭스와 채택 범위의 정합 (AC-12·13), 현행 최신에서 무회귀 (AC-14) |

## 범위 제외

- **B-02** (three 정적 로드 제거 — CJS 크래시): Sprint 4. AC-10/11 스모크는 리포 내 환경 전제로만 통과하며 이 한계를 인지한 채 진행.
- **예제 패키지 리네이밍** (`@wvkit/react-example`·`@wvkit/vue-example`, `examples/*/package.json:2`): private 미배포 워크스페이스명. `e2e/playwright.config.ts:42`의 `--filter` 참조와 결합되어 있어 함께 바꿔야 하므로 이번 범위에서 제외 — 필요 시 B-25(어댑터·설정 정리)에 편입 제안.
- **역사 기록**: `docs/worklog/*`, `docs/qa/*`, `examples/*/CHANGELOG.md`의 `@wvkit/*` 언급은 당시 사실의 기록이므로 치환하지 않음.
- **react-dom peer 제거** (audit-code P2): B-25.
- **README 문서 링크/GIF** (B-14), **VitePress 실물화** (B-04): 별도 스프린트.
- **`WebviewHeadlessError` 서브클래스/에러 코드 체계 도입**: 값 export만 수행, API 확장은 하지 않음.
