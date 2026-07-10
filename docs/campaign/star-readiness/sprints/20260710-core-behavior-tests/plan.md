# Sprint 2 — 핵심 동작 단위검증 (core-behavior-tests)

> 대상 백로그: **B-05**(CameraControl 핵심 수식 단위 검증) · **B-06**(StableInput `suppressLayoutShift`/`scrollAnchor` 단위 검증)
> 근거: `audit-unit-tests.md` P0 1번째(B-05) · P0 2번째(B-06), 커버리지 스냅샷 표
> 작성일: 2026-07-10 · 규모: M + M (+ threshold 램프 S) · 브랜치: `chore/quality-sprint-1`

## 목표

라이브러리의 **존재 이유가 되는 두 핵심 동작**을 단위 테스트로 값 단언한다. 이 스프린트가 끝나면:

1. CameraControl의 pan 수식(축 제약·엣지 저항·zoom 스케일)·속도 기반 스냅 방향(지터 보정 버그픽스 포함)·핀치 줌+앵커 보정·다지 승계가 **구체적인 숫자로** 고정된다 (현재 branch 56.5%, 사실상 무단언).
2. StableInput의 iOS 레이아웃 억제(`visualViewport` resize → anchor별 scroll 보정, 현재 `stable-input.ts:127-144` 0% 커버)가 anchor 3종 × 게이트 조건별로 고정된다.
3. Sprint 1이 잠근 커버리지 threshold를 신규 실측에 맞춰 **상향**해 이번 스프린트의 이득이 회귀로 사라지면 CI가 빨간불이 된다.

**소스 코드 변경 없음(테스트 + vitest.config만).** 테스트 작성 중 실제 버그가 드러나면 임의 수정하지 말고 리더에게 보고한다 (동작 변경은 이 스프린트 범위 밖).

---

## 태스크

### T-01 (B-05) — CameraControl 제스처 수식 단위 테스트

**대상 코드(변경 없음):** `packages/core/src/components/scroll-container/camera-control.ts`
- `updatePan` 159-196 (축 제약·엣지 저항·zoom 스케일·속도 샘플)
- `endPan` 198-234 (dragRatio/velocityRatio → `decideSnapTarget`, 특히 217-224의 `lastMoveInterval` 지터 보정)
- `startPinch`/`updatePinch`/`endPinch` 237-309 (줌 배율·앵커 보정·축 저항·클램프)
- `onPointerEnd` 344-367 (다지 승계: 2→1 pan 복귀, 3→2 pinch 재시작)

**테스트 파일:** `packages/core/src/components/scroll-container/__tests__/camera-control.test.ts`에 describe 블록 추가 (기존 `makeRoot`/`makeCamera`/`pointerEvent` 헬퍼·`HORIZONTAL_POSITIONS`(x: 0/400/800/1200)·`VERTICAL_POSITIONS`(y: -300/-900/-1500/-2100) 재사용. 파일이 과대해지면 같은 `__tests__/` 아래 `camera-control.gestures.test.ts`로 분리 가능 — 구현팀 재량).

**테스트 인프라 결정 (구현 힌트):**
- happy-dom v15는 `PointerEvent` 지원, `setPointerCapture`는 소스에서 try/catch 가드됨 — 기존 `pointerEvent` 헬퍼 그대로 사용.
- 속도/지터 테스트는 `performance.now`를 제어해야 결정적이 됨: `let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);` 후 move 사이에 `now`를 증가. `afterEach`에서 `vi.restoreAllMocks()`.
- pan 시작 인덱스를 결정적으로 만들기 위해 제스처 전에 `control.animateToIndex(i, false)`로 카메라를 고정.
- 공통 옵션: `getRootSize: () => ({ width: 400, height: 600 })`, `snapThreshold: 0.3`, `resistance: 0.2`, `minZoom: 1`, `maxZoom: 3`. `decideSnapTarget`의 `velocityWeight` 기본값 0.3 (`matrix-utils.ts:122`) — effective = dragRatio + velocityRatio×0.3.

**완료 기준 — 아래 18개 `it` 케이스(A5+B5+C6+D2)가 추가되고 통과 (그룹·기대값은 수식에서 도출한 정확값):**

**그룹 A — updatePan 수식 (horizontal 기본, index 0 = camera x 0):**
| # | 케이스 | 시퀀스 (down→move) | 단언 |
|---|---|---|---|
| A1 | 전진 pan 부호·수식 | down(200,300) → move(150,300), dx=-50, zoom=1 | `camera.position.x === 50` (`start − dx/zoom`), `y === 0` |
| A2 | 대각 이동 시 cross-axis 불변 | down(200,300) → move(150,200) (dy=-100 포함) | `x === 50`, `y === 0` (대각 방지) |
| A3 | 엣지 저항 (min 밖) | index 0에서 down(200,300) → move(300,300), dx=+100 → raw target -100 < min 0 | `x === -20` (`0 − 100×0.2`, `applyResistance` 일치) |
| A4 | zoom 반영 pan | `animateToZoom(2,false)` 후 down(200,300) → move(100,300), dx=-100 | `x === 50` (`dx/zoom = 100/2`) |
| A5 | vertical 축 pan | vertical positions, `animateToIndex(0,false)`(y=-300), down(200,300) → move(200,200), dy=-100 | `y === -400` (`start + dy/zoom`), `x === 0` |

**그룹 B — endPan 스냅 방향 (performance.now 목킹, onPanRelease 스파이):**
| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| B1 | 전진 스냅 (drag > threshold) | index 0, 저속 move로 dx=-160 (dragRatio 0.4) → up | `onPanRelease(1)` 1회 |
| B2 | 후진 스냅 | index 1(x=400), dx=+160 (dragRatio -0.4) → up | `onPanRelease(0)` |
| B3 | 서브임계값 복귀 | index 1, dx=-40 (ratio 0.1), move 간격 100ms(저속) → up | `onPanRelease(1)` (원위치) |
| B4 | 플릭 (저드래그+고속도) | index 0: down@t=0 → move dx=-20@t=100 → move dx=-60(추가 -40)@t=110 → up@t=111. dt=max(1,10,1)=10 → velocityRatio=(40/400)×(100/10)=1.0, effective=0.15+0.3=0.45 | `onPanRelease(1)` |
| B5 | 지터 가드 (217-224 버그픽스 회귀) | index 0: 100ms 간격 move로 dx=-160 도달 → 지터 move dx=+8(t=+100ms) → up 2ms 후. 보정식 dt=max(1,100,2)=100 → velocityRatio=-0.02, effective≈0.374>0.3 | `onPanRelease(1)` (버그 재발 시 dt=2 → velocityRatio=-1.0 → effective 0.08 → 0으로 오스냅되어 실패) |

**그룹 C — 핀치 줌 + 앵커 보정 (enablePinchZoom=true):**
| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| C1 | 줌인 배율 | down(100,300)+down(300,300) (dist 200) → move (50,300)/(350,300) (dist 300) | `camera.zoom === 1.5`, `updateProjectionMatrix` 호출, `onChange` 호출 |
| C2 | 앵커 보정 왕복 | index 1(x=400): down(200,300)+down(360,300) (dist 160, mid 280 → worldAnchor.x=480) → move (180,300)/(380,300) (dist 200, factor 1.25) | `zoom === 1.25`, `x === 416` (`480 − 80/1.25`); `screenPointToWorld(280,300,x,y,zoom,400,600).x ≈ 480` (앵커 불변, toBeCloseTo) |
| C3 | 줌 클램프 | dist 100 → 1000 (factor 10) 및 반대로 dist 축소 | `zoom === 3`(max) / `zoom === 1`(min), position 유한값 |
| C4 | endPinch 콜백 | 핀치 후 한 손가락 up | `onPinchRelease`가 `camera.zoom` 값으로 1회 호출 |
| C5 | two-finger pan 엣지 저항 | index 0: down(100,300)+down(300,300) → 간격 유지한 채 두 손가락 +200px 평행이동 (mid 200→400, raw camera -200) | `x === -40` (저항 적용, -200 아님 — 콘텐츠 이탈 방지), `y === 0` |
| C6 | 핀치 중 cross-axis 고정 | C2 시퀀스에서 midpoint y를 300→250으로 이동시키는 비대칭 move 포함 | `camera.position.y === pinchStart 시점 y` (horizontal에서 y 불변) |

**그룹 D — 다지 승계 (onPointerEnd 353-366):**
| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| D1 | 2→1 pan 승계 | 핀치 → 손가락 1개 up → 남은 손가락 move dx → up | `onPinchRelease` 1회 후, 남은 손가락 move가 카메라 x를 변경(재앵커 기준), 최종 up에서 `onPanRelease` 1회 |
| D2 | 3→2 pinch 재시작 | 3 pointer down(핀치는 2번째에서 시작) → 1개 up → 남은 2개 벌리는 move | 1개 up 시점 `onPinchRelease` 정확히 1회, 이후 move에서 `camera.zoom` 계속 변경(제스처 죽지 않음) |

> 참고: D1의 "재앵커 기준" — `startPan(remainingId)`이 up 시점 카메라·포인터 위치로 새로 앵커하므로, 이후 move의 델타만 반영됨을 단언 (승계 없이 최초 down 기준이면 값이 어긋남).

---

### T-02 (B-06) — StableInput suppressLayoutShift/scrollAnchor 단위 테스트

**대상 코드(변경 없음):** `packages/core/src/components/stable-input/stable-input.ts:126-144`
```ts
if (options.suppressLayoutShift !== false && window.visualViewport) {
  addListener(window.visualViewport, 'resize', () => {
    if (!isFocused) return;                       // 게이트 1
    const anchor = options.scrollAnchor ?? 'bottom';
    if (anchor === 'none') return;                // 게이트 2
    ...
    if (anchor === 'bottom') {
      const overflow = containerRect.bottom - vp.height;
      if (overflow > 0) window.scrollBy({ top: overflow + 8, behavior: 'instant' });
    } else if (anchor === 'top') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });
}
```

**테스트 파일:** `packages/core/src/components/stable-input/__tests__/stable-input.test.ts`에 `describe('suppressLayoutShift / scrollAnchor')` 추가.

**테스트 인프라 결정 (구현 힌트):**
- happy-dom은 `window.visualViewport`를 제공하지 않을 수 있음 → **생성 전에** 목 주입 필수 (등록 조건 `window.visualViewport` truthy가 `createStableInput` 호출 시점에 평가됨):
  ```ts
  const mockVV = Object.assign(new EventTarget(), { height: 800, width: 400 });
  Object.defineProperty(window, 'visualViewport', { value: mockVV, configurable: true });
  ```
  `afterEach`에서 원래 값 복원(`configurable: true` 필수). 키보드 등장 재현 = `mockVV.height` 축소 후 `mockVV.dispatchEvent(new Event('resize'))`.
- `window.scrollBy`/`window.scrollTo`는 `vi.fn()`으로 스텁(스파이 아닌 대체 — happy-dom 구현 부작용 차단), afterEach 복원.
- 포커스 상태 = `hiddenInput.dispatchEvent(new Event('focus'))` (기존 테스트 패턴, `isFocused=true` 설정). hiddenInput 선택자는 기존 패턴 `document.body.querySelector('input[style]')`.
- container 위치는 `vi.spyOn(container, 'getBoundingClientRect')` 목킹 (기존 BUG-01 테스트 패턴 재사용).

**완료 기준 — 아래 8개 `it` 케이스가 추가되고 통과:**

| # | 케이스 | 조건 | 단언 |
|---|---|---|---|
| S1 | bottom(기본) overflow 보정 | 옵션 생략(기본 anchor 'bottom'), focus, rect.bottom=700, vv.height=500 → resize | `scrollBy`가 정확히 `{ top: 208, behavior: 'instant' }`로 1회 호출 (`700−500+8`) |
| S2 | bottom overflow 없음 | focus, rect.bottom=400, vv.height=500 → resize | `scrollBy`/`scrollTo` 미호출 |
| S3 | anchor 'top' | `scrollAnchor:'top'`, focus → resize | `scrollTo`가 `{ top: 0, behavior: 'instant' }`로 1회 호출, `scrollBy` 미호출 |
| S4 | anchor 'none' | `scrollAnchor:'none'`, focus, overflow 존재 → resize | 둘 다 미호출 (게이트 2) |
| S5 | 비포커스 게이트 | focus 없이(또는 blur 후) overflow 존재 → resize | 둘 다 미호출 (게이트 1) |
| S6 | `suppressLayoutShift:false` opt-out | 목 vv 존재 + focus + overflow → resize | 둘 다 미호출 + `mockVV`에 'resize' 리스너 자체가 등록되지 않음 (`addEventListener` 스파이) |
| S7 | destroy 시 리스너 해제 | S1 조건에서 `destroy()` 후 resize 디스패치 | `scrollBy` 미호출 + `mockVV.removeEventListener`가 'resize'로 호출됨 |
| S8 | visualViewport 부재 | `window.visualViewport` = undefined 상태에서 생성 | `createStableInput` 정상 생성·`focus()`/`destroy()` no-throw + resize 경로 부재로 scroll 스텁 미호출 |

---

### T-03 — 커버리지 threshold 램프 (Sprint 1 T-03의 후속 잠금)

**파일:** `packages/core/vitest.config.ts` (라인 13-17 `thresholds`만 수정)

**절차 (완료 기준):** T-01/T-02 완료 후 `pnpm --filter @guksu/wvkit-core exec vitest run --coverage`로 신규 실측을 확인하고, `camera-control.ts`와 `stable-input.ts` 하한을 **실측 − 2~3%p**로 상향. `pull-to-refresh.ts`(80/85)는 이번 스프린트 무관 — 미변경.

**최소 플로어 (인수조건 AC-05로 기계 검증 — 이 값 미만으로 설정하면 램프 실패):**

| 파일 | 항목 | Sprint 1 하한 | 이번 스프린트 최소 플로어 | 근거 |
|---|---|---|---|---|
| camera-control.ts | branches | 55 | **≥ 70** | pan/endPan/pinch/승계 분기 대량 커버 (미커버 잔여: 트윈 399-417 = B-17, try/catch 가드) |
| camera-control.ts | functions | 90 | **≥ 90 유지** | `stepTween` 미커버 잔존(B-17 범위) — 하향 금지 |
| stable-input.ts | branches | 85 | **≥ 90** | 127-144 anchor 분기 전체 커버 |
| stable-input.ts | functions | 75 | **≥ 85** | resize 핸들러 함수 커버 (78.6% → 90%대 예상) |

실측이 플로어를 하회하면(테스트가 예상 분기를 못 태움) 테스트를 보강하는 것이지 플로어를 낮추지 않는다. 낮춰야 할 사정이 생기면 리더 에스컬레이션.

---

## 인수조건 (기계 검증 — 명령 + 기대 종료 상태)

> 모든 명령은 `/Users/kimjongmin/dev/wvkit`에서 실행. exit 0 = 통과. 패키지 필터는 실배포명 `@guksu/wvkit-core` 사용 (CLAUDE.md의 `@wvkit/*`는 구명칭 — B-03 정정 대상). vitest 타이틀 grep은 non-TTY에서 `--reporter=verbose` 필수 (Sprint 1 교훈).

**AC-01 (B-05 · 테스트 통과):**
- `pnpm --filter @guksu/wvkit-core exec vitest run camera-control` → **exit 0**

**AC-02 (B-05 · 케이스 존재 — 18건):**
- `pnpm --filter @guksu/wvkit-core exec vitest run camera-control --reporter=verbose 2>&1 | grep -Ec "엣지 저항|저항|스냅|snap|핀치|pinch|앵커|anchor|승계|지터|jitter"` → **10 이상** (그룹 A~D 케이스가 리포트에 등장)
- 의미 단언(코드 존재 검증): 테스트 파일에 `onPanRelease` 스파이의 인자 단언(`toHaveBeenCalledWith(1)`/`(0)`), `camera.position.x`의 정확값 단언(`-20`, `416`, `-40` 등), `screenPointToWorld` 왕복 `toBeCloseTo` 단언이 모두 존재:
  `grep -q "toBeCloseTo" packages/core/src/components/scroll-container/__tests__/camera-control*.test.ts && grep -q "screenPointToWorld" packages/core/src/components/scroll-container/__tests__/camera-control*.test.ts` → **exit 0**

**AC-03 (B-06 · 테스트 통과):**
- `pnpm --filter @guksu/wvkit-core exec vitest run stable-input` → **exit 0**

**AC-04 (B-06 · 케이스 존재 — 8건):**
- `pnpm --filter @guksu/wvkit-core exec vitest run stable-input --reporter=verbose 2>&1 | grep -Ec "suppressLayoutShift|scrollAnchor|anchor|visualViewport"` → **6 이상**
- 의미 단언: `grep -q "scrollBy" packages/core/src/components/stable-input/__tests__/stable-input.test.ts && grep -q "behavior: 'instant'" packages/core/src/components/stable-input/__tests__/stable-input.test.ts` → **exit 0** (정확 인자 단언 존재)

**AC-05 (T-03 · threshold 램프 값):**
- `python3 -c "
import re,sys
t=open('packages/core/vitest.config.ts').read()
cc=re.search(r\"camera-control\.ts.*?branches:\s*(\d+),\s*functions:\s*(\d+)\",t)
si=re.search(r\"stable-input\.ts.*?branches:\s*(\d+),\s*functions:\s*(\d+)\",t)
ptr=re.search(r\"pull-to-refresh\.ts.*?branches:\s*(\d+),\s*functions:\s*(\d+)\",t)
ok=cc and si and ptr and int(cc[1])>=70 and int(cc[2])>=90 and int(si[1])>=90 and int(si[2])>=85 and int(ptr[1])==80 and int(ptr[2])==85
sys.exit(0 if ok else 1)"` → **exit 0** (플로어 충족 + pull-to-refresh 미변경)

**AC-06 (T-03 · 상향된 게이트 통과):**
- `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` → **exit 0** (신규 하한으로 즉시 그린)

**AC-07 (회귀 없음 — 전체):**
- `pnpm test` → **exit 0** (기존 대비 신규 26케이스 증가 — core 단위 테스트만 증가)
- `pnpm typecheck` → **exit 0**
- `pnpm lint` → **exit 0** (Biome — 신규 테스트 코드 포함)

**AC-08 (불변식 · 소스 무변경):**
- `git status --porcelain packages/core/src | grep -v "__tests__" | grep -q .` → **exit 1** (테스트 외 core 소스 변경 없음; `vitest.config.ts`는 `src/` 밖이라 이 검사와 무관)

---

## 경계면 매핑 (생산자 ↔ 소비자)

| 산출물 | 생산자 | 소비자 | 계약 |
|---|---|---|---|
| CameraControl 제스처 테스트 | T-01 | `camera-control.ts` 159-367 | PointerEvent 시퀀스 → `camera.position`/`zoom` 정확값, `onPanRelease(index)`/`onPinchRelease(zoom)` 인자 |
| 수식 기대값 | `matrix-utils.ts` (`applyResistance`/`decideSnapTarget`/`screenPointToWorld`, 이미 100% 커버) | T-01 단언값 산출 | 테스트 기대값은 이 순수 함수 수식에서 도출 — 수식 변경 시 테스트도 갱신 |
| StableInput 억제 테스트 | T-02 | `stable-input.ts:126-144` | mock visualViewport resize → `scrollBy`/`scrollTo` 호출·인자·미호출 |
| visualViewport 목 패턴 | T-02 | (후속) B-17 VirtualKeyboard 테스트 | `EventTarget` + `Object.defineProperty(window,...)` 주입 패턴 재사용 가능 |
| threshold 신규 하한 | T-03 | `.github/workflows/ci.yml` Coverage gate 스텝 (Sprint 1 산출물) | `vitest run --coverage` exit code — CI 변경 불필요 |
| 커버리지 신규 실측 | T-01/T-02 실행 결과 | T-03 하한 산정 (실측 − 2~3%p, 플로어 이상) | 실측 → worklog에 기록 |

**소비자 영향 없음(불변식):** core 소스·public API 무변경 → react/vue 어댑터·데모·e2e 영향 없음. qa는 AC-08로 교차검증.

---

## 범위 제외 (이번 스프린트에서 하지 않음)

- **CameraControl `animated=true` 트윈(RAF) 테스트** — B-17 (camera-control functions 하한을 90으로 유지만 하는 이유).
- **ScrollContainer ResizeObserver 보정 / VirtualKeyboard baseHeight 리셋** — B-17.
- **PTR TouchEvent 경로·activeSource 승계** — B-08 (Sprint 5 "터치 계약").
- **어댑터(react/vue) StrictMode·rerender 테스트** — B-09.
- **e2e 시나리오 추가** (suppressLayoutShift 실브라우저 검증 등) — B-10. 이번엔 happy-dom 단위 레벨만.
- **destroy 후 scrollTo/zoomTo 가드** — B-13 (Sprint 4 동반).
- **소스 코드 동작 변경 일체** — 테스트가 버그를 드러내면 리더 보고 후 별도 결정.
- **pull-to-refresh threshold 조정, lines/statements threshold 도입** — 후속.
