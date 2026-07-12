# qa-report — Sprint 11 (adapter-config-cleanup, B-25)

검증: qa · 2026-07-11 · 브랜치 `sprint/20260710-adapter-config-cleanup` · 리포 루트에서 전 AC 직접 재실행(exit code 판정)

**결과: 22/22 PASS — FAIL 0건.** 경계면 교차검증·껍데기 테스트 판정에서도 차단 이슈 없음(하단 관찰 2건은 비차단).

## 인수조건 판정 (전 항목 직접 재실행)

### T-01 — non-callback prop 문서화 + 핀 테스트

| # | 판정 | 근거 (직접 실행) |
|---|---|---|
| AC-01 | **[PASS]** | react 스위트 exit 0 + `--reporter=verbose` 출력에 `✓ … [B-25] R1: rerender로 panels/minZoom을 교체해도 인스턴스는 재생성되지 않는다` (grep exit 0) |
| AC-02 | **[PASS]** | vue 스위트 exit 0 + `✓ … [B-25] V1: 마운트 후 options 객체의 panels를 교체해도 인스턴스는 재생성되지 않는다` (grep exit 0) |
| AC-03 | **[PASS]** | `captured once at mount` marker — README.md(:270 Reactivity note) + docs/components/scroll-container/index.md(`::: warning`) 양쪽 존재, grep exit 0 |
| AC-04 | **[PASS]** | `마운트 시점에 1회 고정` marker — README.ko.md + docs/ko/components/scroll-container/index.md 양쪽 존재, grep exit 0 |
| AC-05 | **[PASS]** | `재마운트` — react/vue `use-scroll-container.ts` JSDoc 양쪽 존재, grep exit 0 |

### T-02 — react-dom peer 제거

| # | 판정 | 근거 |
|---|---|---|
| AC-06 | **[PASS]** | `packages/react/package.json` peerDependencies에 `react-dom` 부재(node 판정 exit 0). `react >=18.0.0` peer 유지·devDep `react-dom` 유지 확인 |
| AC-07 | **[PASS]** | `pnpm install --frozen-lockfile` exit 0 — 락파일 정합 (dev-notes의 "워크스페이스 importer 자신의 peer는 락파일 무기록" 설명과 일치, 락파일 무변경이 정상) |
| AC-08 | **[PASS]** | `pnpm --filter @guksu/wvkit-react build && … test` exit 0 |

### T-03 — biome 억제 유효성 + 회귀 가드

| # | 판정 | 근거 |
|---|---|---|
| AC-09 | **[PASS]** | `pnpm exec biome lint packages 2>&1 \| grep -iq "suppress"` → **exit 1** (기대값 — suppression 경고 0건) |
| AC-10 | **[PASS]** | `pnpm exec biome lint packages` exit 0 |

- 소스 대조: 억제 2곳(`use-scroll-lock.ts:14`, `use-virtual-keyboard.ts:14`) 잔존 = dev-notes의 "둘 다 load-bearing 판정 → 복원" 결론과 일치. 소스 변경 0 확인(git diff에 두 파일 없음).

### T-04 — deploy-demo paths 필터 + dispatch

| # | 판정 | 근거 |
|---|---|---|
| AC-11 | **[PASS]** | `paths:` + `packages/**` + `examples/**` + `docs/.vitepress` 전부 존재, grep 체인 exit 0. plan의 9개 경로 그대로 반영 확인 |
| AC-12 | **[PASS]** | `workflow_dispatch` 존재 + `docs/worklog` 리터럴 0건(`grep -c` = 0으로 강한 형태 재확인 — AC의 `-vq`는 약한 단언이므로 부재를 별도 검증) |

- 경계면 대조(배포 스킵 사고 여부): compose 입력 3종(`examples/react-example/dist` ← examples/**+packages/**, `docs/.vitepress/dist` ← docs/.vitepress·components·ko·index.md·package.json, `examples/vue-example/dist` ← examples/**)의 소스가 paths에 전부 포함. `docs/` 실측 ls 결과 제외 대상은 campaign·loops·qa·reports·templates·worklog·node_modules뿐 — 사이트 소스 누락 없음.

### T-05 — ScrollLock 안전망 주석 + L1 핀

| # | 판정 | 근거 |
|---|---|---|
| AC-13 | **[PASS]** | core 스위트 exit 0(271 passed) + `✓ … [B-25] L1: unlock은 lock 시점의 scrollY로 window.scrollTo를 호출한다(안전망)` |
| AC-14 | **[PASS]** | `안전망` marker — scroll-lock.ts unlock 경로(:61-63)와 lock 저장부(:36) 주석 존재, grep exit 0 |

- 주석↔테스트 정합: 주석이 약속하는 "lock 시점 값 복원"을 L1이 정확히 단언 — scrollY=120으로 lock → scrollY=0으로 틀어짐 모사 → `expect(scrollToSpy).toHaveBeenCalledWith(0, 120)`. mock 복원(finally + originalDescriptor)도 완비. **껍데기 아님(load-bearing).**

### T-06 — StableInput validateOptions + destroy isFocused

| # | 판정 | 근거 |
|---|---|---|
| AC-15 | **[PASS]** | `✓ … [B-25] S1: 잘못된 scrollAnchor는 WebviewHeadlessError를 던진다` |
| AC-16 | **[PASS]** | `✓ … [B-25] S2: container가 HTMLElement가 아니면 WebviewHeadlessError를 던진다` |
| AC-17 | **[PASS]** | `grep -A 8 "function destroy" … \| grep -q "isFocused = false"` exit 0 — destroy 본문 내 초기화 확인 |

- 소스 대조(plan 요구사항 전수):
  - `validateOptions` 호출 위치 = SSR 가드(`typeof window === 'undefined'` noop return) **직후** — SSR noop 계약 유지 확인 (stable-input.ts:32).
  - container non-HTMLElement / scrollAnchor 무효값 → `WebviewHeadlessError` throw, 메시지 plan 문안과 일치.
  - type/placeholder/inputMode/autocomplete 의도적 생략이 validateOptions JSDoc에 명시(감사 제안 이행).
  - `WebviewHeadlessError`는 `../../errors`에서 **값 import**(소스)·테스트도 `../../../errors` 값 import — instanceof 단언 컴파일·통과.
  - S1은 무효 throw(타입+메시지 `/scrollAnchor/`) + 유효 3종 무throw 루프 — 분기 양쪽 커버. S2도 타입+메시지 단언. **껍데기 아님.**

### T-07 + 전역 게이트

| # | 판정 | 근거 |
|---|---|---|
| AC-18 | **[PASS]** | `.changeset/` 비-README md 5건(≥2) — 신규 2건 내용 대조: core **minor**(StableInput throw 동작 변경 CHANGELOG 명시 포함), react **patch**(react-dom peer 제거). plan의 semver 지정과 일치 |
| AC-19 | **[PASS]** | `pnpm lint` exit 0 |
| AC-20 | **[PASS]** | `pnpm typecheck` exit 0 |
| AC-21 | **[PASS]** | `pnpm build` exit 0 |
| AC-22 | **[PASS]** | `pnpm test` exit 0 (core 271 / react·vue 스위트 전부 green). 커버리지 게이트는 `--coverage` 시에만 평가되므로 별도 재실측: `vitest run --coverage` → stable-input **branches 93.33 ≥ 90 / functions 86.66 ≥ 85** — 하한 유지 (dev-notes 수치와 일치) |

## 경계면 교차검증 (dev-notes 매핑 전 행 대조)

| 경계면 | 판정 | 비고 |
|---|---|---|
| core validateOptions throw ↔ react/vue useStableInput | **[PASS]** | 어댑터 파일 무변경(git diff 부재) — create는 기존대로 effect/onMounted 내부, 정상 옵션 어댑터 테스트 전부 green(스위트 exit 0) |
| `WebviewHeadlessError` 값 export ↔ S1/S2 instanceof | **[PASS]** | errors.ts 값 import, typecheck exit 0 |
| 문서 marker ↔ R1/V1 핀 테스트 계약 일치 | **[PASS]** | 문서·JSDoc·테스트 모두 동일 계약("1회 고정 + 변경 무시 + key 재마운트") 서술 — 표류 없음. README 노트는 어댑터 공통 규칙으로 서술(범위 제외 조건 준수) |
| react package.json peer 축소 ↔ pnpm 해석 | **[PASS]** | frozen install + react build/test exit 0 |
| deploy-demo paths ↔ compose 입력 | **[PASS]** | 상기 T-04 대조 — 소스 경로 누락 없음 |
| scroll-lock 주석 ↔ L1 단언 | **[PASS]** | 상기 T-05 대조 |

## 껍데기 테스트 판정 (신규 5건)

- **R1 (react)**: load-bearing — renderer DOM(`firstElementChild`) 동일 참조는 재생성 시 반드시 깨지는 관측 가능한 부수효과. activeIndex 불변 + no-throw 포함. 자동 재초기화가 도입되면 즉시 red.
- **V1 (vue)**: load-bearing이되 R1보다 약함 — 비반응성 options 객체 mutate는 어댑터가 감지할 수 없는 경로라 단언이 깨질 가능성이 구조적으로 낮음(관찰 1 참조). 단 plan T-01이 이 방식("옵션 객체 mutate")을 명시 지정했으므로 계획 준수.
- **L1 / S1 / S2 (core)**: load-bearing — 구체적 값·에러 타입·메시지 단언, S1은 유효/무효 분기 양쪽 커버(커버리지 하한 유지 실측 확인).

## 관찰 (비차단 — FAIL 아님)

1. **V1의 감지력**: Vue 쪽 계약 핀은 "reactive props 갱신 경유"(R1의 rerender 대응) 쪽이 더 강한 단언이 됐을 것. 현 형태도 plan 지정 방식이며 계약(재생성 없음)은 고정되므로 수정 불요. 후속 스프린트에서 reactive options 시나리오 추가 시 참고.
2. **AC-12의 `grep -vq`는 약한 단언**(어느 한 줄이라도 비매치면 exit 0 — 사실상 항상 통과). QA는 `grep -c "docs/worklog"` = **0**으로 부재를 강한 형태로 재확인해 실질 의도(리터럴 0건)를 판정했음. 향후 plan 작성 시 `! grep -q` 형태 권장.

## 결론

FAIL 0건 — Sprint 11 인수조건 전체 충족. 잔여 수정 요청 없음.
