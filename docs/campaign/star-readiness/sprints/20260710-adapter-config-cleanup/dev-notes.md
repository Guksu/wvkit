# dev-notes — Sprint 11 (adapter-config-cleanup, B-25)

작성: implementer · 2026-07-11 · 브랜치 `sprint/20260710-adapter-config-cleanup`

## 변경 파일

### 소스 (런타임 동작 변경은 T-06만)

| 파일 | 태스크 | 변경 |
|---|---|---|
| `packages/core/src/components/stable-input/stable-input.ts` | T-06 | `validateOptions(container, options)` 추가 — SSR 가드 통과 직후 호출. container non-HTMLElement / scrollAnchor 무효값 → `WebviewHeadlessError` throw. type/placeholder/inputMode/autocomplete 검증은 의도적 생략(주석 명시). `destroy()`에 `isFocused = false` 추가 |
| `packages/core/src/components/scroll-lock/scroll-lock.ts` | T-05 | 주석만 — `scrollY` 저장(:36 부근)·`window.scrollTo` 복원(:60 부근)에 "안전망" 의도 주석. 동작 변경 없음 |
| `packages/react/src/components/scroll-container/use-scroll-container.ts` | T-01 | JSDoc 규칙 목록에 non-callback 옵션 1회 고정 + `key` 재마운트 안내 추가 |
| `packages/vue/src/components/scroll-container/use-scroll-container.ts` | T-01 | JSDoc — 기존 "setup 시점 고정" 항목 확장(`panels` 명시 + `:key` 재마운트) |
| `packages/react/package.json` | T-02 | `peerDependencies`에서 `react-dom` 삭제 (`react >=18` 유지, devDep react-dom 유지). `pnpm-lock.yaml` 변경 없음 — 워크스페이스 importer 자신의 peerDependencies는 락파일에 기록되지 않음(frozen install로 확인) |
| `.github/workflows/deploy-demo.yml` | T-04 | `on.push.paths` 필터(plan의 9개 경로 그대로) + `workflow_dispatch` 추가. 주의: 파일 내 어디에도 `docs/worklog` 리터럴을 넣으면 안 됨(AC-12가 BSD grep `-vq`로 부재를 단언) |

### 테스트 (기존 테스트 삭제·완화 없음)

| 파일 | 추가 테스트 |
|---|---|
| `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` | `[B-25] S1`(scrollAnchor 무효 throw + 유효 3종 통과), `[B-25] S2`(container non-HTMLElement throw). `WebviewHeadlessError`는 `../../../errors`에서 값 import |
| `packages/core/src/components/scroll-lock/__tests__/scroll-lock.test.ts` | `[B-25] L1` — lock 시점 scrollY=120 저장 → 위치 틀어짐 모사 → unlock 시 `scrollTo(0, 120)` 단언(안전망 계약 핀) |
| `packages/react/src/components/scroll-container/__tests__/use-scroll-container.test.tsx` | `[B-25] R1` — rerender로 panels(3→5)/minZoom(1→2) 교체 → renderer DOM 동일 참조 + activeIndex 불변 + no throw |
| `packages/vue/src/components/scroll-container/__tests__/use-scroll-container.test.ts` | `[B-25] V1` — options 객체 mutate로 panels 교체 + nextTick → renderer DOM 동일 참조 + activeIndex 불변 |

### 문서

| 파일 | 변경 |
|---|---|
| `README.md` | `## API Reference` 서두에 Reactivity note(어댑터 공통 규칙으로 서술) — marker `captured once at mount` |
| `README.ko.md` | 동일 위치 KO — marker `마운트 시점에 1회 고정` |
| `docs/components/scroll-container/index.md` | Framework Adapter Return Values 직후 `::: warning` — EN marker 포함 |
| `docs/ko/components/scroll-container/index.md` | 동일 위치 `::: warning` — KO marker 포함 |

### changeset

- `.changeset/20260710-adapter-config-cleanup-core.md` — `@guksu/wvkit-core` **minor** (StableInput 검증 throw = breaking-ish 동작 변경 + destroy 상태 초기화 + ScrollLock 주석)
- `.changeset/20260710-adapter-config-cleanup-react.md` — `@guksu/wvkit-react` **patch** (react-dom peer 제거)

## T-03 판정 (biome 억제 유효성 — 소스 변경 0)

두 억제 모두 **유효(load-bearing)** 판정, 각각 임시 제거 → `pnpm exec biome lint packages` 실행으로 검증:

- `packages/react/src/components/scroll-lock/use-scroll-lock.ts:14` — 제거 시 `useExhaustiveDependencies` 에러 발생(`options.allowScrollWithin` 의존성 지적, :16) → 복원
- `packages/react/src/components/virtual-keyboard/use-virtual-keyboard.ts:14` — 제거 시 동일 에러 발생(`options.threshold` 지적, :16) → 복원

현재 `pnpm exec biome lint packages` 경고 0(exit 0), "suppress" 계열 출력 0건(AC-09/10 충족). 감사 시점의 무효 억제 3곳은 이전 스프린트에서 이미 정리된 것으로 판단.

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 생산자 | 산출 | 소비자 | 검증 포인트 |
|---|---|---|---|
| core `stable-input.ts` validateOptions | 무효 옵션 시 `WebviewHeadlessError` throw | react/vue `useStableInput` (effect/onMounted 내부 create) | 기존 어댑터 테스트(정상 옵션) 전부 green 확인(react 35, vue 30). 어댑터에 무효 옵션 주입 테스트는 plan 범위 외 |
| core `errors.ts` `WebviewHeadlessError` 값 export | instanceof 가능 클래스 | S1/S2 테스트의 `toThrow(WebviewHeadlessError)` | 테스트가 `../../../errors`에서 값 import — 타입 전용 회귀 시 컴파일 실패 |
| README/docs/JSDoc 문서 marker (T-01) | "non-callback 1회 고정" 계약 서술 | 라이브러리 소비자 | R1/V1 핀 테스트와 같은 계약(재생성 없음)을 단언 — 문서·테스트 표류 방지 |
| `packages/react/package.json` peer 축소 | 설치 제약 완화 | npm 소비자 / pnpm 해석 | `pnpm install --frozen-lockfile` exit 0 + react build/test green |
| `deploy-demo.yml` paths | main push 필터 | GitHub Actions | 사이트 compose 입력(examples/*/dist, docs/.vitepress/dist)의 소스 경로 전부 포함 — `docs/` 직하위는 campaign/worklog/reports/qa/templates/loops만 제외됨(실측 ls로 확인) |
| `scroll-lock.ts` 안전망 주석 | 의도 서술 | 유지보수자 | L1 테스트가 주석이 약속하는 "lock 시점 값 복원"을 단언 |

## 실행한 검증 명령과 결과

- AC-01~AC-18: 전부 exit 0 (AC-09는 의도대로 grep exit 1 = suppress 경고 0건). AC-12는 최초 1회 실패 — 워크플로 주석에 `docs/worklog` 리터럴을 썼다가 BSD grep `-vq`(패턴 부재 단언)에 걸림 → 주석 리워딩 후 통과
- AC-19 `pnpm lint` exit 0 / AC-20 `pnpm typecheck` exit 0 / AC-21 `pnpm build` exit 0 / AC-22 `pnpm test` exit 0 (core 271, react 35, vue 30 — 전부 pass)
- 커버리지 게이트 사전 확인: core `vitest run --coverage` → stable-input branches **93.33**(하한 90) / functions **86.66**(하한 85) — validateOptions 분기 양쪽 커버로 하한 유지

## 트레이드오프 / 남긴 것

- R1/V1/L1은 특성상 기존 동작을 고정하는 characterization 테스트 — Red 단계가 없음(T-06 S1/S2만 Red→Green 수행: 구현 전 2건 실패 확인 후 구현).
- `pnpm-lock.yaml`은 의도적으로 무변경(재생성 결과가 no-op). AC-07의 "락파일 갱신 완료 상태"는 frozen install 통과로 충족.
- ScrollLock scrollY 복원은 여전히 `window.scrollTo(0, scrollY)` 그대로 — 전략 전환(position:fixed)은 plan 범위 제외.
- scroll-container 외 컴포넌트 docs 개별 페이지의 caveat 반영은 plan 범위 제외(README 공통 노트가 커버).
