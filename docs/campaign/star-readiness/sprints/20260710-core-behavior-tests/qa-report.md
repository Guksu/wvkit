# qa-report — Sprint 2 core-behavior-tests

검증: qa · 2026-07-10 · 브랜치 `sprint/20260710-core-behavior-tests` · 대상: plan.md 인수조건 AC-01~AC-08 전 항목 직접 재실행(exit code) + 경계면 shape 소스 대조 + 껍데기 테스트 판정

## 판정 요약: **전 항목 PASS (8/8) — FAIL 0건**

| AC | 항목 | 판정 | 근거 (qa 직접 재실행 결과) |
|---|---|---|---|
| AC-01 | B-05 camera-control 테스트 통과 | **[PASS]** | `pnpm --filter @guksu/wvkit-core exec vitest run camera-control` → exit 0 (2 files, 38 tests passed: 기존 13 + 신규 gestures 25) |
| AC-02 | B-05 케이스 존재·의미 단언 | **[PASS]** | verbose 리포트 키워드 grep -Ec = **25** (기준 ≥10) · `toBeCloseTo` + `screenPointToWorld` grep → exit 0. 껍데기 아님 판정: 아래 "테스트 의미 검증" 참조 |
| AC-03 | B-06 stable-input 테스트 통과 | **[PASS]** | `vitest run stable-input` → exit 0 (29 tests passed: 기존 21 + 신규 S1~S8) |
| AC-04 | B-06 케이스 존재·의미 단언 | **[PASS]** | verbose 키워드 grep -Ec = **8** (기준 ≥6) · `scrollBy` + `behavior: 'instant'` grep → exit 0 |
| AC-05 | T-03 threshold 플로어 | **[PASS]** | python 검증 exit 0 — cc **81/92** (플로어 70/90), si **90/85** (플로어 90/85), ptr **80/85** 미변경 |
| AC-06 | 상향 게이트 통과 | **[PASS]** | `vitest run --coverage` → exit 0. 실측: camera-control 84.26(br)/94.73(fn), stable-input 92.59(br)/85.71(fn) — dev-notes 기재값과 일치 |
| AC-07 | 회귀 없음 | **[PASS]** | `pnpm test` exit 0 · `pnpm typecheck` exit 0 · `pnpm lint` exit 0 (Biome 122 files) |
| AC-08 | 소스 무변경 불변식 | **[PASS]** | `git status --porcelain packages/core/src \| grep -v "__tests__" \| grep -q .` → exit 1 (비-테스트 core 소스 변경 없음). react/vue/examples도 무변경 → 어댑터·데모·e2e 영향 없음 확인 |

## 경계면 교차검증 (dev-notes 매핑 ↔ 소스 대조)

| 계약 | 대조 결과 |
|---|---|
| `updatePan` 수식 (`camera-control.ts:170-171`: `start − dx/z` / `start + dy/z`) ↔ A1·A4·A5 기대값 (50 / 50 / −400) | **일치** — 수식에서 직접 도출 확인 |
| `applyResistance` (`matrix-utils.ts:41-44`: `min − (min−v)×r`) ↔ A3(−20)·C5(−40)·E1(−10)·E4(−290) | **일치** — 경계값·저항계수 0.2 대입 재계산 완료 |
| `endPan` 지터 보정 (`camera-control.ts:221-222`: `dt = max(1, lastMoveInterval, sinceLastMove)`) ↔ B4(dt=10→velocityRatio 1.0)·B5(dt=100→−0.02) | **일치** — B5는 버그 재발 시(dt=2) effective 0.08 → `onPanRelease(0)`으로 실패하는 진짜 회귀 가드 |
| `decideSnapTarget` (`matrix-utils.ts:125`: `dragRatio + velocityRatio×0.3` vs threshold 0.3) ↔ B1(0.46)·B2(−0.46)·B3(0.13)·E2(0.46)·E3(`\|\|1` 폴백) | **일치** — velocityWeight 기본값 0.3 확인 (`matrix-utils.ts:122`) |
| 핀치 앵커 보정 (`camera-control.ts:282-283`) ↔ C2(zoom 1.25, x=416=480−64) + `screenPointToWorld` 왕복 `toBeCloseTo(480,10)` | **일치** — 앵커 불변 왕복 검증 존재 |
| 다지 승계 (`camera-control.ts:353-363`) ↔ D1(재앵커: `x≈20/1.5` — 최초 down 기준이면 46.67로 어긋남을 명시)·D2(pinch 재시작 dist `hypot(100,200)`) | **일치** — Map 삽입 순서 기반 잔여 포인터 계산까지 재확인 |
| `stable-input.ts:126-144` 게이트·인자 (`overflow+8`, `scrollTo({top:0})`, 게이트 1 `isFocused`, 게이트 2 `'none'`, 등록 조건 `suppressLayoutShift !== false && window.visualViewport`) ↔ S1~S8 | **일치** — S1의 208 = 700−500+8 정확 인자, S6는 `addEventListener` 스파이로 리스너 미등록 자체를 단언, S7은 `removeEventListener('resize')` + 사후 디스패치 무반응 이중 검증 |
| threshold 소비자 (ci.yml Coverage gate) | **일치** — `vitest run --coverage` exit code만 소비, CI 변경 불필요. AC-06으로 기계 확인 |

## 테스트 의미 검증 (껍데기 판정)

**껍데기 단언 없음.** 신규 33케이스(gestures 25 + stable-input 8) 전수 검토 결과:
- 전 케이스가 정확값(`toBe(-20)`, `toBe(416)`, `toBe(1.5)` 등) 또는 스파이 인자·횟수(`toHaveBeenCalledWith(1)`, `toHaveBeenCalledTimes(1)`)를 단언 — 존재성만 확인하는 `toBeDefined`/`not.toThrow` 단독 케이스는 S8(visualViewport 부재 no-throw)뿐이며, 이는 계약 자체가 "throw하지 않음"이라 정당.
- 부동소수는 IEEE754 정확 표현값만 `toBe`, 나머지는 `toBeCloseTo(…, 10)` — 허위 통과 여지 없음.
- 미호출 단언(S2/S4/S5/S6, E5/E6)은 모두 "호출됐어야 할 조건을 실제로 만든 뒤" 미호출을 확인 (예: S4는 overflow를 만들어 두고 anchor 'none' 게이트만으로 차단됨을 검증) — 자명한 통과 아님.
- `performance.now` 목킹이 파일 전역 적용되어 시간 의존 flake 제거, `afterEach`의 `vi.restoreAllMocks()` + visualViewport descriptor 복원으로 테스트 간 오염 없음.

## 관찰 사항 (FAIL 아님 — 후속 참고)

1. **stable-input functions 하한 85 = 실측 85.71, 마진 0.71%p** (dev-notes 자진 기재와 일치). 후속 스프린트에서 stable-input에 함수를 추가하면 즉시 red — 함수 추가 시 테스트 동반 필수. 플랜 플로어(≥85)가 실측−2~3%p 규칙보다 높아 생긴 의도된 강한 잠금이므로 수정 요구 없음.
2. plan AC-07 주석의 "신규 26케이스"는 실제 33케이스(그룹 E 7건 보강분) — 주석 불일치일 뿐 기계 기준(exit 0)과 무관.
3. `pnpm test`는 turbo 캐시(3 cached)로 일부 태스크가 캐시 재생 — core 단위 테스트는 qa가 vitest 직접 재실행으로 별도 확인했으므로 판정에 영향 없음.

## 결론

Sprint 2 인수조건 8/8 PASS. 소스 무변경 불변식 충족, 신규 테스트는 전량 load-bearing, threshold 램프는 플로어 이상으로 잠김. 수정 요청 사항 없음.
