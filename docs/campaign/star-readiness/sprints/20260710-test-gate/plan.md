# Sprint 1 — 테스트 게이트

> 대상 백로그: **B-01**(CI e2e 잡) · **B-07**(한글 IME Enter 가드 단위 테스트) · **B-20**(커버리지 threshold)
> 근거: `audit-e2e.md` P0 / `audit-unit-tests.md` P0(3번째) · P2(커버리지)
> 작성일: 2026-07-10 · 규모: M + S + S (스프린트 1건 = 백로그 3건, 한도 내)

## 목표

CI가 e2e와 커버리지를 **PR 게이트로 강제**하게 만든다. 이 스프린트가 끝나면:

1. 모든 PR에서 Playwright(chromium+webkit 엔진, 4 프로젝트)가 자동 실행되고 실패 시 trace/report가 아티팩트로 남는다.
2. 한글 IME 조합 중 Enter가 `onSubmit`을 조기 발화하지 않는 회귀가 단위 테스트로 고정된다.
3. 핵심 3파일의 branch/func 커버리지가 실측 하한 아래로 떨어지면 CI가 빨간불이 된다.

이 세 가지는 Sprint 2 이후(핵심 동작 단위검증, three 분리 등)의 **회귀 가드 전제**다.

---

## 태스크

### T-01 (B-01) — CI에 e2e 잡 추가

**파일:** `.github/workflows/ci.yml` (기존 `ci` 잡과 병렬인 신규 `e2e` 잡 추가)

**현재 구조 (반영 근거):**
- `ci.yml`은 단일 `ci` 잡뿐: checkout → `pnpm/action-setup@v4`(버전 미핀, 루트 `packageManager: pnpm@9.15.0`에 위임) → `setup-node@v4`(node 20, `cache: pnpm`) → `pnpm install --frozen-lockfile` → lint → typecheck → build → test. 어디에도 playwright 호출 없음.
- `e2e/playwright.config.ts`: `webServer.command`가 `pnpm --filter @wvkit/react-example build && pnpm --filter @wvkit/react-example preview --port 4173 --strictPort`. `reuseExistingServer: !process.env.CI`(CI에선 항상 새로 기동), `timeout: 180_000`, `forbidOnly`/`retries:2`/`reporter:'github'`가 CI 전제. `outputDir: './test-results'`(= `e2e/test-results`). 프로젝트 4종(chromium, webkit, mobile-safari=webkit 엔진, mobile-chrome=chromium 엔진) → **브라우저는 chromium+webkit 2종 설치로 4 프로젝트 전부 커버**.
- react-example는 `@wvkit/*` 워크스페이스 패키지를 소비 → vite 빌드 전에 코어/어댑터 dist가 있어야 안전. 따라서 e2e 잡도 `pnpm build`를 선행한다(기존 `ci` 잡과 동일 패턴). webServer가 example 자체 빌드는 담당하므로 example 빌드는 중복 지정하지 않는다.

**신규 `e2e` 잡 스텝 (완료 기준):**
1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`
3. `actions/setup-node@v4` (`node-version: 20`, `cache: pnpm`)
4. `pnpm install --frozen-lockfile`
5. `pnpm exec playwright install --with-deps chromium webkit` — 브라우저 바이너리 + ubuntu 시스템 라이브러리
6. `pnpm build` — 워크스페이스 패키지 dist 생성(webServer의 example 빌드가 참조)
7. `pnpm test:e2e` — `playwright test --config=e2e/playwright.config.ts` (webServer가 preview 서버를 `:4173`에 기동)
8. 실패/취소 아닐 때 아티팩트 업로드 (`actions/upload-artifact@v4`, `if: ${{ !cancelled() }}`):
   - `e2e/test-results/**` (trace/screenshot/video — `trace: retain-on-failure`)
   - `e2e/playwright-report/**` (HTML 리포트)

**PR 게이트 승격:** `ci.yml`은 이미 `on.pull_request.branches: [main]` 트리거를 가지므로 잡 추가만으로 PR에서 실행된다. 필수 체크 지정(branch protection의 required status checks에 `e2e` 추가)은 리포지토리 설정 영역으로 코드 변경 범위 밖 — 계획에는 명시하되 구현 산출물에는 포함하지 않는다.

**주의:** `e2e`를 `ci` 잡과 **별도 잡**(병렬)으로 둔다. 이유: e2e는 브라우저 설치·빌드·preview 기동으로 느리고, lint/typecheck 실패를 e2e 소요와 분리해 피드백을 빠르게 유지. `needs:` 의존은 걸지 않는다(둘 다 독립적으로 install/build 수행).

---

### T-02 (B-07) — 한글 IME 조합 중 Enter 가드 단위 테스트

**대상 코드(변경 없음, 테스트만 추가):** `packages/core/src/components/stable-input/stable-input.ts:114-123`
```ts
addListener(hiddenInput, 'keydown', (e) => {
  const kev = e as KeyboardEvent;
  if (kev.isComposing || kev.keyCode === 229) return;   // ← 검증 대상
  if (kev.key === 'Enter') options.onSubmit?.(hiddenInput.value);
});
```

**테스트 파일:** `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` (기존 파일에 케이스 추가 — 97-105행의 "Enter 키 입력 시 onSubmit 호출" 테스트 옆에 배치)

**완료 기준:** 아래 3개 `it` 블록이 추가되고 통과.
- `isComposing: true`인 Enter → `onSubmit` **미호출**
- `keyCode: 229`인 Enter(`isComposing` 미채움 구형 WebView 재현) → `onSubmit` **미호출**
- 조합 종료 후 일반 Enter(`isComposing:false`, `keyCode` 정상) → `onSubmit` **1회 호출** (기존 회귀 방지 + 가드가 정상 입력을 막지 않음 확인)

**구현 힌트(planner 관찰):** `happy-dom`의 `KeyboardEvent` 생성자는 `isComposing`을 옵션으로 반영하지 않을 수 있음 → 기존 테스트가 쓰는 `Object.defineProperty(ev, 'isComposing', { value: true })` 또는 `keyCode`도 마찬가지로 `defineProperty`로 주입해야 할 수 있음. 구현팀이 실제 이벤트 shape를 확인해 주입 방식을 택한다. 값이 실제로 실린 이벤트인지 `expect(ev.isComposing).toBe(true)` 선행 단언으로 자기검증 권장.

---

### T-03 (B-20) — 커버리지 threshold 도입 (핵심 3파일)

**파일:** `packages/core/vitest.config.ts` (react/vue 설정은 **미변경**)

**per-file(전역 아님) 결정 근거:**
- 대상 3파일 `camera-control.ts` / `pull-to-refresh.ts` / `stable-input.ts`는 전부 **core 패키지**에 있음 → react/vue vitest.config는 손대지 않는다.
- 전역 aggregate 하한은 한 파일의 하락을 다른 고커버 파일(matrix-utils/utils/scroll-lock/safe-area 100%)이 상쇄해 **가려버린다**. `perFile: true` 전역 하한은 반대로 pure-function 파일까지 동일 문턱에 묶여, 문턱을 낮추면 무의미해지고 높이면 즉시 깨진다.
- **glob-키 per-file threshold**로 회귀 위험이 높은 3개 핫스팟만 정확히 잠근다. vitest v2 `coverage.thresholds`는 glob 키에 파일별 임계값 객체를 매핑 지원.

**설정 형태 (완료 기준):**
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    '**/camera-control.ts':  { branches: 55, functions: 90 },
    '**/pull-to-refresh.ts': { branches: 80, functions: 85 },
    '**/stable-input.ts':    { branches: 85, functions: 75 },
  },
}
```

**threshold 값 산정 (audit 실측 스냅샷보다 약간 낮게 → 즉시 통과):**

| 파일 | 실측 branch | 설정 branch | 실측 func | 설정 func |
|---|---|---|---|---|
| camera-control.ts | 56.5% | **55** | 94.7% | **90** |
| pull-to-refresh.ts | 82.1% | **80** | 88.5% | **85** |
| stable-input.ts | 87.2% | **85** | 78.6% | **75** |

lines/statements는 이번 스프린트에서 잠그지 않는다(branch/func가 회귀 신호로 충분, 후속 스프린트에서 상향).

**강제 메커니즘 (중요 — threshold는 `--coverage`일 때만 평가됨):**
- 현재 `pnpm test`(turbo) → 각 패키지 `vitest run` (커버리지 **미수집**) → threshold를 설정해도 **평가되지 않음**.
- 따라서 CI가 커버리지를 수집하며 돌리는 경로가 필요. 구현: 루트 `package.json`에 `"test:coverage": "turbo run test -- --coverage"` 추가하고, `ci.yml`의 기존 `ci` 잡에 **"Coverage gate" 스텝**을 추가 — `pnpm --filter @wvkit/core exec vitest run --coverage` (core만 대상, 3파일 threshold 평가). 기존 "Test" 스텝(`pnpm test`)은 그대로 두어 전체 패키지 통과를 유지.
- 이 배치 근거: coverage 게이트를 e2e 잡이 아닌 `ci` 잡에 두어야 lint/typecheck/build/test와 같은 빠른 피드백 그룹에 묶인다.

---

## 인수조건 (기계 검증 — 명령 + 기대 종료 상태)

> 모든 명령은 리포지토리 루트 `/Users/kimjongmin/dev/wvkit`에서 실행. 종료 코드 0 = 통과, 비0 = 실패.

**AC-01 (B-01 · 워크플로 구조):**
- `grep -q "playwright install" .github/workflows/ci.yml` → **exit 0** (브라우저 설치 스텝 존재)
- `grep -Eq "chromium[[:space:]]+webkit|webkit[[:space:]]+chromium" .github/workflows/ci.yml` → **exit 0** (두 엔진만 설치)
- `grep -q "test:e2e" .github/workflows/ci.yml` → **exit 0** (e2e 실행 스텝 존재)
- `grep -q "upload-artifact" .github/workflows/ci.yml` → **exit 0** (아티팩트 업로드 존재)
- `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/ci.yml')); sys.exit(0 if 'e2e' in d['jobs'] else 1)"` → **exit 0** (`e2e` 잡 정의됨, YAML 유효)
- `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"` → 파싱 예외 없이 `OK` 출력

**AC-02 (B-01 · e2e 실행):**
- `pnpm exec playwright install chromium webkit` 후 `pnpm test:e2e` → **exit 0** (로컬/CI에서 32개 스펙 그린; 이 스프린트는 스펙을 추가하지 않으므로 기존 스펙이 새 CI 경로로도 통과함을 확인하는 것이 완료 기준).
  - 로컬 검증 시 preview 서버 `:4173` 기동에 의존 — `reuseExistingServer` 동작 주의.

**AC-03 (B-07 · IME 가드):**
- `pnpm --filter @wvkit/core exec vitest run stable-input` → **exit 0**
- `pnpm --filter @wvkit/core exec vitest run stable-input 2>&1 | grep -c "isComposing\|229\|IME\|조합"` → **1 이상** (신규 케이스가 리포트에 등장)
- 의미 단언: `isComposing:true` 및 `keyCode:229` 케이스에서 `onSubmit` 스파이 `toHaveBeenCalledTimes(0)`, 정상 Enter에서 `toHaveBeenCalledTimes(1)` — 테스트 코드에 3개 단언 모두 존재.

**AC-04 (B-20 · threshold 존재·통과):**
- `pnpm --filter @wvkit/core exec vitest run --coverage` → **exit 0** (실측이 설정 하한 위이므로 즉시 통과)
- `node -e "const c=require('./packages/core/vitest.config.ts'); process.exit(0)"` 대신 grep 검증: `grep -q "thresholds" packages/core/vitest.config.ts` → **exit 0**, 그리고 `grep -q "camera-control.ts" packages/core/vitest.config.ts && grep -q "pull-to-refresh.ts" packages/core/vitest.config.ts && grep -q "stable-input.ts" packages/core/vitest.config.ts` → **exit 0**

**AC-05 (B-20 · 게이트 실효성 — 음성 검증):**
- 임시로 `camera-control.ts` branch threshold를 `55` → `99`로 올린 상태에서 `pnpm --filter @wvkit/core exec vitest run --coverage` → **exit 비0** (threshold가 실제로 CI를 깨뜨림을 확인). 확인 후 원복. 구현팀이 수동/일시 검증으로 수행하고 결과를 worklog에 기록.

**AC-06 (회귀 없음 — 전체):**
- `pnpm test` → **exit 0** (237/237 유지, 신규 IME 케이스 포함 240 근처)
- `pnpm typecheck` → **exit 0** (vitest.config 타입 오류 없음)
- `pnpm lint` → **exit 0** (Biome; ci.yml YAML은 lint 대상 아님)

---

## 경계면 매핑 (생산자 ↔ 소비자)

| 산출물 | 생산자 | 소비자 | 계약 |
|---|---|---|---|
| `.github/workflows/ci.yml` `e2e` 잡 | T-01 | GitHub Actions / PR 게이트 | webServer(`:4173/wvkit/`)·`test:e2e` 스크립트·playwright.config 프로젝트 4종 |
| `test:e2e` 스크립트 | 기존 `package.json` | T-01 CI 잡 | `playwright test --config=e2e/playwright.config.ts` |
| react-example dist 의존 | `pnpm build`(T-01 스텝) | playwright `webServer`의 example 빌드 | `@wvkit/*` 워크스페이스 dist |
| IME 가드 테스트 | T-02 | `stable-input.ts:119` 가드 로직 | `isComposing`/`keyCode` → `onSubmit` 미발화 |
| `test:coverage` 스크립트 + core threshold | T-03 | `ci` 잡 Coverage gate 스텝 | `vitest run --coverage`, glob per-file 하한 |
| 커버리지 실측 스냅샷 | `audit-unit-tests.md` 표 | T-03 threshold 값 | 실측−(1~5%p) = 설정 하한 |

**소비자 영향 없음(불변식):** T-02/T-03은 core 소스 로직(`stable-input.ts` 등)을 **변경하지 않음** → react/vue 어댑터 재빌드·API 변경 불필요. T-01은 워크플로만 추가 → 런타임 산출물 무변경.

---

## 범위 제외 (이번 스프린트에서 하지 않음)

- **e2e 스펙 신규 작성** — B-10/B-18/B-24(값 제안 골든 시나리오, PTR 잔여 계약, ScrollLock/VK 심화)는 Sprint 5 이후. 이번엔 **기존 32스펙을 CI가 돌리게** 하는 것만.
- **CameraControl/StableInput 커버리지 상향** — B-05/B-06(핵심 수식 단위검증)은 Sprint 2. 이번 threshold는 **현재 실측을 잠그기만** 하고 커버리지를 올리지 않음.
- **WKWebView 실기기 자동화** — B-19(Maestro/Detox), 장기 nightly.
- **커버리지 리포터 업로드(Codecov 등)·threshold 상향 램프** — 후속.
- **branch protection required check 설정** — 리포지토리 설정 영역(코드 밖). 계획에만 명시.
- **lines/statements threshold, react/vue 커버리지 게이트** — branch/func 우선, 후속 확대.
- **`pnpm/action-setup` 버전 핀 등 기존 `ci` 잡 리팩토링** — 범위 밖(기존 패턴 유지).

---

## 리더 부록 (2026-07-10, 스프린트 종료 시 정정)

- **AC-03 grep 하위검증 정정**: vitest 기본 리포터는 non-TTY에서 통과 테스트 타이틀을 출력하지 않아 `grep -c` 가 0을 반환한다. 올바른 명령: `pnpm --filter @guksu/wvkit-core exec vitest run stable-input --reporter=verbose 2>&1 | grep -c "isComposing\|229"` → 1 이상. (qa 검증으로 실질 인수는 충족 확인됨)
- **패키지명**: 본문 AC의 `@wvkit/core` 필터명은 구명칭 — 실배포명 `@guksu/wvkit-*` 기준으로 구현·검증됨 (백로그 B-03에서 문서 전반 일괄 정정 예정).
- **범위 편입**: B-26(사전 lint red 13건)이 스프린트 중 편입되어 완료 — ci.yml lint 스텝(`pnpm lint`)이 exit 1이면 신설 게이트가 무의미해지는 블로커였음. qa-report.md "B-26 재검증" 참조.
