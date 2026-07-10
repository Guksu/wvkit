# dev-notes — Sprint 2 core-behavior-tests (implementer)

작성: implementer · 2026-07-10 · 브랜치: `sprint/20260710-core-behavior-tests`

## 변경 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `packages/core/src/components/scroll-container/__tests__/camera-control.gestures.test.ts` | **신규** | T-01 그룹 A~D 18케이스 + 그룹 E 경계·가드 7케이스 (총 25) |
| `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` | 수정 | T-02 `describe('suppressLayoutShift / scrollAnchor ...')` S1~S8 8케이스 추가 |
| `packages/core/vitest.config.ts` | 수정 | T-03 threshold 램프 — camera-control 55/90 → **81/92**, stable-input 85/75 → **90/85** (pull-to-refresh 80/85 미변경) |

**core 소스(`packages/core/src` 비-`__tests__`) 무변경** — AC-08 충족. 테스트 중 소스 버그 미발견(리더 보고 사항 없음).
**changeset 불필요** — 배포 패키지 런타임 동작 변경 없음 (테스트 + vitest.config만).

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 산출물 | 생산자 | 소비자 | 계약 |
|---|---|---|---|
| `camera-control.gestures.test.ts` 그룹 A~E | T-01 | `camera-control.ts:159-367` (updatePan/endPan/pinch/onPointerEnd) | PointerEvent 시퀀스 → `camera.position`/`zoom` 정확값(`-20`, `416`, `-40`, `-290` 등), `onPanRelease(index)`/`onPinchRelease(zoom)` 인자·횟수 |
| 기대값 도출 | `matrix-utils.ts` 순수 함수 | 테스트 단언값 | `applyResistance`/`decideSnapTarget`(velocityWeight 0.3)/`screenPointToWorld` 수식에서 도출 — 수식 변경 시 테스트 갱신 필요 |
| stable-input S1~S8 | T-02 | `stable-input.ts:126-144` | mock visualViewport resize → `scrollBy({top:208,...})`/`scrollTo({top:0,...})` 정확 인자·미호출 게이트 |
| visualViewport 목 패턴 (`EventTarget` + `Object.defineProperty`) | T-02 | 후속 B-17 VirtualKeyboard 테스트 | 생성 **전** 주입 필수 (등록 조건이 create 시점 평가) |
| threshold 신규 하한 | T-03 | `.github/workflows/ci.yml` Coverage gate | `vitest run --coverage` exit code — CI 변경 불필요 |

## AC별 결과 (전부 통과)

| AC | 명령 | 결과 |
|---|---|---|
| AC-01 | `vitest run camera-control` | exit 0 (31 tests: 기존 13 + 신규 18 + 보강 7... 파일 2개 합산 38) |
| AC-02 | 키워드 grep -Ec | **25** (기준 ≥10) · `toBeCloseTo`/`screenPointToWorld` grep exit 0 |
| AC-03 | `vitest run stable-input` | exit 0 (29 tests: 기존 21 + 신규 8) |
| AC-04 | 키워드 grep -Ec | **8** (기준 ≥6) · `scrollBy`/`behavior: 'instant'` grep exit 0 |
| AC-05 | threshold 플로어 python 검증 | exit 0 (cc 81/92, si 90/85, ptr 80/85) |
| AC-06 | `vitest run --coverage` | exit 0 (225 tests, 신규 하한으로 그린) |
| AC-07 | `pnpm test` / `pnpm typecheck` / `pnpm lint` | 모두 exit 0 (+ `pnpm build` exit 0) |
| AC-08 | `git status --porcelain packages/core/src \| grep -v __tests__` | 매치 없음 (exit 1) — 소스 무변경 |

## 커버리지 실측 (2026-07-10, T-03 하한 산정 근거)

| 파일 | 항목 | Sprint 1 | 실측 | 신규 하한 | 비고 |
|---|---|---|---|---|---|
| camera-control.ts | branches | 55 | **84.26** | 81 (실측−3.26) | 플랜 예상(~70+)보다 높음 — 그룹 E 보강 덕 |
| camera-control.ts | functions | 90 | 94.73 | 92 (실측−2.73) | `stepTween`(400-417)만 미커버 = B-17 |
| stable-input.ts | branches | 85 | **92.59** | 90 (실측−2.59) | 127-144 anchor 분기 전체 커버 |
| stable-input.ts | functions | 75 | **85.71** | 85 (실측−0.71) | **플로어(≥85)가 실측−2~3%p보다 높아 플로어로 고정** — 마진 0.71%p로 얇음, 아래 트레이드오프 참고 |

## 구현 결정·트레이드오프

1. **테스트 파일 분리**: 플랜 허용 재량에 따라 제스처 테스트를 `camera-control.gestures.test.ts`로 분리 (기존 파일 397줄 과대 방지). `vitest run camera-control` 필터와 AC-02 grep(`camera-control*.test.ts`)은 두 파일 모두 매치.
2. **그룹 E(7케이스) 추가**: 최초 실측에서 camera-control branches 66.21%로 플로어(70) 미달 → 플랜 지침("테스트를 보강하는 것이지 플로어를 낮추지 않는다")대로 in-scope 경계·가드를 보강해 84.26%로 상향. 케이스: 빈 positions pan/release, vertical endPan 부호 반전 스냅, rootSize 0 `|| 1` 폴백, vertical 핀치 y축 저항, 무효 pointerId 무시, pinch-비활성 dead-panStart 가드, 제스처 중 destroy 캡처 release(m-5). 트윈(RAF) 경로는 B-17 범위라 제외 유지.
3. **performance.now 목킹 파일 전역 적용**: 그룹 B·D뿐 아니라 파일 전체에 `vi.spyOn(performance,'now')` — A·C·E도 시간 비의존이 보장되어 flake 여지 제거. `afterEach`에서 `vi.restoreAllMocks()`.
4. **부동소수 정확값**: `-20`(100×0.2), `-40`(200×0.2), `416`(480−80/1.25), `1.25`, `1.5` 모두 IEEE754에서 정확히 표현/반올림되어 `toBe` 사용. 앵커 왕복(C2)·재앵커(D1)·재시작 줌(D2)만 `toBeCloseTo(…, 10)`.
5. **stable-input functions 하한 85 = 실측−0.71%p**: 마진이 얇다. 미커버 함수는 SSR no-op 스텁 일부(54행 등)로, 다른 함수가 커버리지에서 빠지면 즉시 red가 날 수 있음 — 의도된 강한 잠금이지만 후속 스프린트에서 stable-input에 함수를 추가할 때는 해당 함수 테스트를 동반해야 함.
6. **E7 setPointerCapture 스텁**: happy-dom v15에 `setPointerCapture`가 없어(실측 확인) m-5 release 경로는 `Object.assign(root, {setPointerCapture, releasePointerCapture})` 스텁으로 커버.

## 실행한 검증 명령 (요약)

```
pnpm --filter @guksu/wvkit-core exec vitest run camera-control          # exit 0
pnpm --filter @guksu/wvkit-core exec vitest run stable-input            # exit 0
pnpm --filter @guksu/wvkit-core exec vitest run --coverage              # exit 0, 225 passed
pnpm test && pnpm typecheck && pnpm lint && pnpm build                  # 모두 exit 0
git status --porcelain packages/core/src | grep -v __tests__ | grep -q .  # exit 1 (무변경)
```

lint는 1회 실패 후 수정: Biome `noDelete` — visualViewport 복원의 `delete` 연산자를 `Object.defineProperty(..., {value: undefined})`로 교체.
