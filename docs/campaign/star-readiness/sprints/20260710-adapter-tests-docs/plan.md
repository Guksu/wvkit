# Sprint 6 — 어댑터 실질화 + 문서 진입로 (adapter-tests-docs)

| 항목 | 내용 |
|------|------|
| 슬러그 | 20260710-adapter-tests-docs |
| 백로그 | B-09 (M) · B-14b (S) · B-15 (S) |
| 근거 | audit-unit-tests.md P1(어댑터 smoke 전용, :35) · audit-docs-dx.md P1(README 문서 링크 0, :21) · audit-docs-dx.md P1(커뮤니티 헬스 전무, :27) + P2(TESTING.md 미링크, :41) |
| 브랜치 | chore/quality-sprint-1 (git 변경 명령은 사용자 전담) |

## 목표

1. **B-09**: react/vue 어댑터 테스트를 smoke(`not.toThrow`)에서 실질 검증으로 승격 — StrictMode 이중 마운트에서 리소스가 이중 등록되지 않음, rerender 시 최신 콜백이 stale 없이 반영됨, unmount(destroy) 후 리스너·DOM이 실제로 제거됨을 관측 가능한 부수효과로 단언한다.
2. **B-14b**: README(EN/KO)에 Documentation 섹션을 추가해 docs/components/ 6종 문서로의 진입로 0 상태를 해소한다.
3. **B-15**: CONTRIBUTING.md + 이슈 템플릿 2종 + PR 템플릿으로 GitHub 커뮤니티 프로필 최소 세트를 채운다.

## 태스크

### T-01 (B-09) — React 어댑터 실질화 테스트 8건

**대상 파일 (기존 테스트 파일에 `describe('[B-09] ...')` 블록 추가 — 기존 케이스 삭제 금지):**

- `packages/react/src/components/scroll-container/__tests__/use-scroll-container.test.tsx`
- `packages/react/src/components/pull-to-refresh/__tests__/use-pull-to-refresh.test.tsx`
- `packages/react/src/components/stable-input/__tests__/use-stable-input.test.tsx`
- `packages/react/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts`

**구현 참조 (검증 대상 경계면):**

- optionsRef 최신화: `packages/react/src/components/scroll-container/use-scroll-container.ts:34-36` (PTR 훅도 동일 패턴 `use-pull-to-refresh.ts:40-42`)
- StrictMode-안전 cleanup: `use-scroll-container.ts:66-72`, `use-pull-to-refresh.ts:75-81`
- 관측점: PTR은 `root.style.overscrollBehavior`('contain' ↔ 복원)와 `onPull`/`onStateChange` 호출 수, StableInput은 container 내 `input` 요소 수(display+hidden=2)와 destroy 시 `remove()`(core `stable-input.ts:159-160`), ScrollContainer는 containerRef 자식으로 붙는 renderer DOM 수와 `onIndexChange` 호출 수.
- 이벤트 시뮬레이션: core `packages/core/src/components/pull-to-refresh/__tests__/pull-to-refresh.integration.test.ts:27-66`의 PointerEvent 헬퍼 패턴 재사용 (happy-dom은 TouchEvent 부분 지원 → PointerEvent로 시뮬, `scrollTop=0` 가드 충족 필요).

**테스트 케이스 (타이틀에 `[B-09]` 태그 필수 — verbose 리포터 grep 검증용):**

| ID | 훅 | 시나리오 | 단언 |
|----|----|----------|------|
| A1 | useScrollContainer | `<React.StrictMode>`로 감싸 render (React 18 dev: mount→cleanup→mount) | containerRef div의 renderer 자식 DOM이 정확히 1세트(이중 attach 없음), `container.querySelectorAll` 수치 단언 |
| A2 | usePullToRefresh | StrictMode render 후 pointerdown→pointermove 1회 제스처 | `overscrollBehavior === 'contain'` 유지 + `onPull` 호출 수가 move 이벤트 수와 일치(이중 등록이면 2배) |
| A3 | useStableInput | StrictMode render | container 내 `input` 요소 정확히 2개(display+hidden — 4개면 이중 마운트 누수) |
| A4 | usePullToRefresh | rerender로 새 `onPull`/`onStateChange`(vi.fn) 주입 → 제스처 디스패치 | 새 콜백 호출됨 + 이전 콜백 `toHaveBeenCalledTimes(0)` (optionsRef 경유 stale 회피 검증) |
| A5 | useScrollContainer | rerender로 새 `onIndexChange` 주입 → `scrollTo(1, { animated: false })` | 새 콜백이 `1`로 호출 + 이전 콜백 미호출 |
| A6 | usePullToRefresh | unmount 후 원 컨테이너 요소에 pointerdown→pointermove 디스패치 | `onPull`/`onStateChange` 미호출(리스너 실제 제거) + `overscrollBehavior` 복원(≠ 'contain') |
| A7 | useStableInput | unmount 후 | container 내 `input` 요소 0개 (`displayInput.remove()`/`hiddenInput.remove()` 실효) |
| A8 | useVirtualKeyboard | `addEventListener`/`removeEventListener` spy (window + visualViewport 목) 후 unmount | 등록된 (target, type, handler) 전부에 대응하는 remove 호출 존재 (짝 맞춤 단언) |

**완료 기준:** `pnpm --filter @guksu/wvkit-react test` exit 0 + A1~A8 전부 verbose 출력에 존재. 테스트가 어댑터/core의 실결함을 드러내면 어댑터 코드 최소 수정은 허용, core 동작 변경이 필요하면 구현을 멈추고 리더에게 보고(신규 백로그 후보).

### T-02 (B-09) — Vue 어댑터 실질화 테스트 4건

Vue에는 StrictMode·rerender-props 개념이 없음(컴포저블 options는 setup 시점 고정 — `packages/vue/src/components/scroll-container/use-scroll-container.ts:21-22` 주석 참조). 따라서 Vue 몫은 **destroy 실효 + unmount 후 명령형 메서드 noop**으로 한정한다.

**대상 파일 (기존 파일에 추가):**

- `packages/vue/src/components/pull-to-refresh/__tests__/use-pull-to-refresh.test.ts`
- `packages/vue/src/components/stable-input/__tests__/use-stable-input.test.ts`
- `packages/vue/src/components/scroll-container/__tests__/use-scroll-container.test.ts`
- `packages/vue/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts`

**테스트 케이스 (`@vue/test-utils` mount/unmount, 타이틀에 `[B-09]` 태그):**

| ID | 컴포저블 | 시나리오 | 단언 |
|----|----------|----------|------|
| A9 | usePullToRefresh | unmount 후 원 컨테이너에 pointer 제스처 디스패치 | `onPull` 미호출 + `overscrollBehavior` 복원 |
| A10 | useStableInput | unmount 후 | container 내 `input` 요소 0개 |
| A11 | useScrollContainer | unmount 후 `scrollTo(1)` 호출 | `onIndexChange` 미호출 (instance null → noop, `use-scroll-container.ts:60-63` 실효) |
| A12 | useVirtualKeyboard | add/removeEventListener spy 후 unmount | 등록 리스너 전부 제거 (짝 맞춤) |

**완료 기준:** `pnpm --filter @guksu/wvkit-vue test` exit 0 + A9~A12 verbose 출력 존재.

### T-03 (B-14b) — README Documentation 링크 섹션 (EN + KO)

**대상 파일:** `README.md`, `README.ko.md`

**요구 형태:**

- `## Features`와 `## Installation` 사이에 `## Documentation` 섹션 신설 (README.ko.md는 대응 위치에 `## 문서`).
- 컴포넌트 6종의 GitHub 상대 링크 테이블 또는 리스트: `docs/components/scroll-container/index.md` · `stable-input` · `pull-to-refresh` · `virtual-keyboard` · `safe-area` · `scroll-lock` (각 `index.md`).
- 문구에 "심화 문서(문제 배경/아키텍처/전체 API/제한사항)" 성격 1줄 안내. VitePress 사이트 URL은 넣지 않는다(B-04 미해결 — 사이트 없음, 링크는 리포 경로).
- `## Development` 섹션에 `CONTRIBUTING.md` 링크 1줄 추가 (T-04와 연결).

**완료 기준:** AC-05/AC-06 스크립트 exit 0. 기존 섹션 삭제·개편 금지(추가만).

### T-04 (B-15) — 커뮤니티 헬스 파일 4종

**신규 파일:**

| 파일 | 필수 내용 |
|------|-----------|
| `CONTRIBUTING.md` (루트) | ① 셋업: `pnpm install` ② 빌드: `pnpm build` ③ 테스트: `pnpm test` + `pnpm test:e2e`(chromium/webkit 설치 포함) — 상세는 `TESTING.md` 링크 ④ 린트/타입: `pnpm lint`·`pnpm typecheck` ⑤ changeset 흐름: PR에 `pnpm changeset` 산출물 동봉 → bot이 Release PR 생성 → 머지 시 자동 publish (d69ff57 PR-기반 흐름 반영) ⑥ 패키지명은 `@guksu/wvkit-*` 명시 |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | GitHub issue form: `name:`/`description:`/`body:` 필수. 입력 필드 — 패키지(core/react/vue 드롭다운), 버전, 환경(iOS Safari/Android WebView 등), 재현 절차, 기대/실제 동작 |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | issue form: 문제 배경, 제안 API, 대안 검토 |
| `.github/PULL_REQUEST_TEMPLATE.md` | 체크리스트: 테스트 추가/통과, `pnpm lint`·`pnpm typecheck` 통과, changeset 포함 여부(`- [ ]`), 관련 이슈 링크 |

**완료 기준:** AC-07~AC-10 exit 0. `ISSUE_TEMPLATE/config.yml`·CODE_OF_CONDUCT·SECURITY·FUNDING은 범위 제외(아래 참조).

## 인수조건 (기계 검증 — 명령 + 기대 exit code)

> 인수조건 = 테스트 케이스 (TDD). AC-02는 A1~A8, AC-04는 A9~A12와 1:1 대응.
> Sprint 1 교훈: vitest 기본 리포터는 non-TTY에서 통과 타이틀을 출력하지 않음 → grep 검증은 반드시 `--reporter=verbose`.

```bash
# AC-01 — 전 패키지 단위 테스트 + core 커버리지 threshold 통과 (회귀 없음)
pnpm test
# 기대: exit 0

# AC-02 — React 어댑터 B-09 케이스 8건 존재·통과
pnpm --filter @guksu/wvkit-react exec vitest run --reporter=verbose 2>&1 | grep -c '\[B-09\]'
# 기대: 출력 ≥ 8, exit 0

# AC-03 — Vue 패키지 단독 통과
pnpm --filter @guksu/wvkit-vue test
# 기대: exit 0

# AC-04 — Vue 어댑터 B-09 케이스 4건 존재·통과
pnpm --filter @guksu/wvkit-vue exec vitest run --reporter=verbose 2>&1 | grep -c '\[B-09\]'
# 기대: 출력 ≥ 4, exit 0

# AC-05 — README.md Documentation 섹션 + 6종 링크 + 링크 대상 실존
grep -q '^## Documentation' README.md && \
for c in scroll-container stable-input pull-to-refresh virtual-keyboard safe-area scroll-lock; do
  grep -q "docs/components/$c/index.md" README.md && test -f "docs/components/$c/index.md" || exit 1
done
# 기대: exit 0

# AC-06 — README.ko.md 동일 (섹션명 '## 문서')
grep -q '^## 문서' README.ko.md && \
for c in scroll-container stable-input pull-to-refresh virtual-keyboard safe-area scroll-lock; do
  grep -q "docs/components/$c/index.md" README.ko.md || exit 1
done
# 기대: exit 0

# AC-07 — 커뮤니티 헬스 파일 4종 실존
test -f CONTRIBUTING.md && \
test -f .github/ISSUE_TEMPLATE/bug_report.yml && \
test -f .github/ISSUE_TEMPLATE/feature_request.yml && \
test -f .github/PULL_REQUEST_TEMPLATE.md
# 기대: exit 0

# AC-08 — CONTRIBUTING 필수 내용 (TESTING.md 링크 / changeset 흐름 / e2e 커맨드 / 실배포 패키지명)
grep -q 'TESTING.md' CONTRIBUTING.md && \
grep -q 'changeset' CONTRIBUTING.md && \
grep -q 'test:e2e' CONTRIBUTING.md && \
grep -q '@guksu/wvkit' CONTRIBUTING.md
# 기대: exit 0

# AC-09 — 이슈 템플릿이 GitHub issue form 구조를 갖춤
grep -q '^name:' .github/ISSUE_TEMPLATE/bug_report.yml && grep -q '^body:' .github/ISSUE_TEMPLATE/bug_report.yml && \
grep -q '^name:' .github/ISSUE_TEMPLATE/feature_request.yml && grep -q '^body:' .github/ISSUE_TEMPLATE/feature_request.yml
# 기대: exit 0

# AC-10 — PR 템플릿에 changeset·테스트 체크리스트 존재
grep -q 'changeset' .github/PULL_REQUEST_TEMPLATE.md && grep -qc '\- \[ \]' .github/PULL_REQUEST_TEMPLATE.md
# 기대: exit 0

# AC-11 — 린트 그린 유지 (B-26 이후 그린 상태 — 신규 파일이 깨지 않아야 함)
pnpm lint
# 기대: exit 0

# AC-12 — 타입 체크 그린 유지
pnpm typecheck
# 기대: exit 0
```

## 경계면 매핑 (생산자 ↔ 소비자 — qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 이번 스프린트의 계약 |
|--------|--------|--------|----------------------|
| core 팩토리 ↔ react 훅 | `packages/core/src/components/*/`(destroy 멱등, 리스너 해제, DOM 정리) | `packages/react/src/components/*/use-*.ts` effect cleanup | StrictMode 이중 마운트에도 리소스 1세트(A1~A3), unmount 후 이벤트가 콜백을 발화하지 않음(A6~A8) |
| react optionsRef ↔ 사용자 콜백 | `use-*.ts`의 `optionsRef` wrap(`onIndexChange`/`onPull`/`onStateChange`) | 훅 소비자(테스트의 vi.fn) | rerender 후 최신 콜백만 호출, 이전 콜백 0회(A4~A5) |
| core 팩토리 ↔ vue 컴포저블 | 동일 core | `packages/vue/src/components/*/use-*.ts` `onUnmounted` | unmount 후 리스너 제거·DOM 정리·명령형 메서드 noop(A9~A12) |
| README ↔ docs/components | `README.md`/`README.ko.md` Documentation 섹션 | GitHub/npm 방문자 → `docs/components/{6종}/index.md` | 링크 6종 전부 실존 경로(AC-05/06). 문서 내용 자체(VitePress 문법 렌더 깨짐)는 B-04 소관 |
| CONTRIBUTING ↔ 개발 인프라 | `CONTRIBUTING.md` | 외부 기여자 | 기재된 커맨드가 CLAUDE.md 주요 커맨드·PR-기반 changeset 흐름과 일치, `TESTING.md` 링크(AC-08) |
| 이슈/PR 템플릿 ↔ GitHub UI | `.github/ISSUE_TEMPLATE/*.yml`, `PULL_REQUEST_TEMPLATE.md` | 이슈/PR 작성자 | issue form 스키마 키(`name`/`body`) 보유(AC-09), PR 체크리스트에 changeset 항목(AC-10) |

## 범위 제외

- **B-14a** README 히어로 GIF — 실기기 캡처 필요, 보류 확정(백로그 ⏸).
- **B-04** VitePress 사이트 실물화 — Documentation 링크는 리포 경로로만; 사이트 URL·`homepage` 필드 갱신(audit-docs P2 :43)은 B-04 이후.
- **B-22** 껍데기 단언 전수 정리 — 이번 스프린트는 audit이 지목한 3계약(StrictMode/rerender/destroy 실효)만. SafeArea·ScrollLock 어댑터의 잔여 `not.toThrow` 정리는 B-22에서.
- **B-25** non-callback prop(rerender 시 `panels` 등) 미반영의 **문서화** — A4/A5는 콜백 반영만 검증. non-callback 옵션을 rerender에 반영하는 기능 추가는 하지 않는다.
- CODE_OF_CONDUCT.md · SECURITY.md · FUNDING.yml · `ISSUE_TEMPLATE/config.yml` — 백로그 B-15가 명시한 최소 세트(CONTRIBUTING+이슈 2종+PR 1종) 외.
- core 동작 변경 — 어댑터 테스트가 core 결함을 드러내면 수정하지 말고 리더에게 보고(신규 백로그 후보로 등재).
- e2e 추가 없음 — B-09는 단위(Vitest) 레벨.
