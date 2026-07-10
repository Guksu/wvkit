# Sprint 8 — 잔여 테스트 공백 (residual-test-gaps)

> 대상 백로그: **B-17**(잔여 단위 공백 3건 — CameraControl `animated` 트윈 / VirtualKeyboard 회전 baseHeight 리셋 / ScrollContainer ResizeObserver 보정) · **B-18**(PTR e2e 잔여 계약 5건)
> 근거: `audit-unit-tests.md` P1 4·5·6번째(B-17) · `audit-e2e.md` P1 4번째 + 커버리지 매트릭스 PullToRefresh 행(B-18)
> 작성일: 2026-07-10 · 규모: M + S · 브랜치: `chore/quality-sprint-1`

## 목표

감사에서 지적된 마지막 P1 테스트 공백을 닫는다. 이 스프린트가 끝나면:

1. `camera-control.ts:376-417`(startTween/stepTween/cancelAnimationInternal)의 easeOutCubic RAF 트윈이 **프레임 단위 값으로** 단언된다 — 중간 보간(t=0.5 → k=0.875), 완료 전이(tween=null), 진행 중 재시작 취소, destroy 시 취소.
2. `virtual-keyboard.ts:32-38`의 회전 휴리스틱("너비가 변했으면 baseHeight 재설정")이 단위 검증된다 — 회전 중 높이 감소가 키보드로 오검출되지 않고, 회전 후 새 기준으로 정상 검출된다.
3. `scroll-container.ts:186-216`의 ResizeObserver 보정 경로가 단위 검증된다 — frustum/renderer 사이즈/패널 좌표 재계산, 동일 크기 조기 리턴, 진행 트윈 즉시 보정, destroy 가드·disconnect.
4. PullToRefresh의 CLAUDE §5 계약 5건이 e2e로 고정된다 — enabled=false 당김 무시, `onRefresh` reject 시 console.error + idle 복귀 + 후속 정상 동작, `maxDistance` cap(=120 정확값), `scrollTop>0` tryStart 거절, `overscroll-behavior: contain` 자동 적용/opt-out.
5. camera-control.ts 커버리지 threshold를 신규 실측 기준으로 상향해 이번 이득이 회귀로 사라지면 CI가 빨간불이 된다.

**라이브러리 소스(`packages/*/src` 비테스트 코드) 변경 없음.** 변경 대상은 단위 테스트 + e2e 스펙/픽스처 + 데모 계측(fail-next 토글 1개, 체크박스 testid 2개) + vitest.config뿐이다. 테스트 작성 중 실제 버그(예: destroy가 RO를 disconnect하지 않음)가 드러나면 임의 수정하지 말고 리더에게 보고한다.

---

## 태스크

### T-01 (B-17) — CameraControl `animated` 트윈(RAF) 단위 테스트

**대상 코드(변경 없음):** `packages/core/src/components/scroll-container/camera-control.ts`
- `cancelAnimationInternal` 376-382 · `startTween` 384-397 (`TWEEN_DURATION_MS = 300`, :24) · `stepTween` 399-417 · `animateToIndex` 420-433 · `animateToZoom` 435-445 · `destroy` 447-448(트윈 취소)

**테스트 파일(신규):** `packages/core/src/components/scroll-container/__tests__/camera-control.tween.test.ts`
(기존 `camera-control.test.ts`의 `makeRoot`/`makeCamera`/`HORIZONTAL_POSITIONS` 헬퍼·옵션 패턴 복제. RAF 목킹이 다른 describe에 새지 않도록 별도 파일.)

**테스트 인프라 (구현 힌트):**
- **수동 RAF 큐**: `vi.stubGlobal('requestAnimationFrame', cb => { queue.push(cb); return ++id; })` + `vi.stubGlobal('cancelAnimationFrame', vi.fn(...))` (호출 인자 단언용 스파이 유지) + `flushFrame()` 헬퍼(큐에서 1개 꺼내 실행).
- **시간 제어**: `vi.spyOn(performance, 'now')` — `startTween`이 시작 시각을 capture하므로(:387) 트윈 시작 **전에** 스파이 설치. now=1000에서 시작 → 1150(t=0.5) → 1300(t=1.0)으로 진행.
- **기대값 도출** (`easeOutCubic(t) = 1-(1-t)^3`, `matrix-utils.ts:19`): t=0.5 → k=0.875. `animateToIndex(2, true)`는 x 0→800이므로 t=0.5에서 `camera.position.x = 700`, `animateToZoom(2, true)`는 zoom 1→2이므로 t=0.5에서 `camera.zoom = 1.875`. `toBeCloseTo(…, 6)` 권장.
- `camera.updateProjectionMatrix` 단언은 `vi.spyOn(camera, 'updateProjectionMatrix')`.

**완료 기준 — 아래 6개 `it` 케이스 추가·통과 (타이틀에 `tween —` 접두 고정, qa grep용):**

| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| V1 | 중간 프레임 easeOutCubic 보간 | now=1000에서 `animateToIndex(2, true)` → now=1150 → flushFrame | `camera.position.x` `toBeCloseTo(700)`, `camera.position.y === 0`, 프레임마다 `onChange` 1회 호출 |
| V2 | 완료 전이 — 정확 도달 + RAF 중단 | V1 이어서 now=1300 → flushFrame | `camera.position.x === 800` 정확값, **RAF 큐 비어 있음**(추가 프레임 미스케줄), 이후 flush 시도에도 `onChange` 추가 호출 없음 |
| V3 | 진행 중 재시작 → 기존 트윈 취소 | `animateToIndex(1, true)` → 1프레임 진행 → `animateToIndex(2, true)` → 완료까지 flush | `cancelAnimationFrame`이 **첫 트윈의 rafId로 호출**됨, 최종 `camera.position.x === 800`, 프레임당 `onChange` 1회(이중 스텝 없음) |
| V4 | zoom 트윈 + 불변 시 projection 미갱신 | (a) `animateToZoom(2, true)` t=0.5 프레임 (b) 별도 인스턴스에서 `animateToIndex(2, true)` t=0.5 프레임 | (a) `camera.zoom` `toBeCloseTo(1.875)` + `updateProjectionMatrix` 호출됨 (b) fromZoom===toZoom이므로 스텝 중 `updateProjectionMatrix` **미호출** (:406 분기) |
| V5 | cancelAnimation() 중단 — 위치 동결 | `animateToIndex(2, true)` → t=0.5 프레임(x=700) → `control.cancelAnimation()` → now=1300 → 잔여 큐 flush | `cancelAnimationFrame` 호출, `camera.position.x` 700에 동결, `onChange` 추가 호출 없음 |
| V6 | destroy() 중단 | `animateToIndex(2, true)` → 1프레임 진행 → `control.destroy()` → 잔여 큐 flush | `cancelAnimationFrame` 호출(:448 경유), 위치 불변, throw 없음 |

### T-02 (B-17) — VirtualKeyboard 회전 baseHeight 리셋 단위 테스트

**대상 코드(변경 없음):** `packages/core/src/components/virtual-keyboard/virtual-keyboard.ts:32-38` — `currentWidth !== baseWidth → baseWidth/baseHeight 재설정`. 기본 `threshold = 100`.

**테스트 파일(기존 확장):** `packages/core/src/components/virtual-keyboard/__tests__/virtual-keyboard.test.ts`
- 기존 `mockVisualViewport(height)` 헬퍼를 `mockVisualViewport(width, height)`로 확장(소스가 `visualViewport.width`를 읽음 — 현재 mock은 width 부재로 `window.innerWidth` 폴백에 빠짐). vp 객체를 mutable로 두고, `vp.addEventListener.mock.calls`에서 `'resize'` 핸들러를 capture해 `fire(width, height)` 헬퍼로 감싼다. 기존 테스트들의 시그니처 호환은 기본 인자로 유지하거나 일괄 수정(기존 케이스 삭제 금지).

**완료 기준 — 아래 3개 `it` 케이스 추가·통과 (타이틀에 `rotate —` 접두 고정):**

| # | 케이스 | 시퀀스 (초기 vp 390×844) | 단언 |
|---|---|---|---|
| K1 | 회전 중 높이 감소를 키보드로 오검출하지 않음 | fire(844, 390) — 너비·높이 동시 스왑 (delta 454 > threshold이지만 너비 변경) | `isOpen === false`, `keyboardHeight === 0`, `onChange` **미호출**(상태 무변화 조기 리턴 :50) |
| K2 | 회전 후 새 baseHeight 기준으로 정상 검출 | fire(844, 390) → fire(844, 90) — 너비 유지, 높이 300 감소 | `isOpen === true`, `keyboardHeight === 300` (새 기준 390 대비 — 옛 기준 844 대비 754가 아님) |
| K3 | 키보드 열린 채 회전 → 닫힘으로 리셋 통지 | fire(390, 500) (isOpen true, height 344 확인) → fire(844, 390) | `onChange` 마지막 호출 인자 `{ isOpen: false, keyboardHeight: 0 }`, getter도 동일 |

### T-03 (B-17) — ScrollContainer ResizeObserver 보정 단위 테스트

**대상 코드(변경 없음):** `packages/core/src/components/scroll-container/scroll-container.ts`
- RO 블록 186-216: destroyed 가드(190) → 동일 크기 조기 리턴(193) → frustum 갱신(196-200) → `renderer.setSize`(201) → `computePositions` + CSS3DObject 좌표 재적용(202-208) → `control.cancelAnimation()` + `applyActiveIndexToCameraDirectly()` + `requestRender()`(210-212)
- destroy의 `resizeObserver.disconnect()` 259-261

**테스트 파일(신규):** `packages/core/src/components/scroll-container/__tests__/scroll-container.resize.test.ts`
(기존 `scroll-container.test.ts`의 `makeRoot`/`makePanels` 헬퍼 복제. RO stub이 다른 파일에 새지 않도록 별도 파일.)

**테스트 인프라 (구현 힌트):**
- **RO stub**: `vi.stubGlobal('ResizeObserver', MockRO)` — 인스턴스 목록에 `{ callback, observed[], disconnect: vi.fn() }` capture, 테스트에서 `Object.defineProperty(root, 'clientWidth', …)` 갱신 후 `callback()` 수동 발화. `createScrollContainer` **호출 전** stub 설치 필수(:188이 생성 시점에 분기).
- **관측 지점 (렌더는 동기 — `requestRender`가 `renderer.render`를 직접 호출 :143-145):**
  - renderer 사이즈 → `root.firstChild`(CSS3DRenderer.domElement)의 `style.width`/`style.height` (`setSize`가 px 문자열로 기록)
  - 카메라/패널 좌표 → 렌더 후 DOM `style.transform` 문자열(scene·패널의 `matrix3d`/`translate`) 스냅샷 비교. 정확 수치 파싱이 과하면 "리사이즈 전후 transform 문자열 변경/불변"으로 단언
- T-01과 동일한 수동 RAF 큐를 R6에서 재사용(트윈 진행 상태 제어).

**완료 기준 — 아래 6개 `it` 케이스 추가·통과 (타이틀에 `resize —` 접두 고정):**

| # | 케이스 | 시퀀스 | 단언 |
|---|---|---|---|
| R1 | root observe + destroy 시 disconnect | create → destroy | RO 인스턴스가 root를 `observe`, destroy 후 `disconnect` 1회 호출(:260) |
| R2 | 리사이즈 → renderer 사이즈 갱신 | clientWidth 400→800, clientHeight 600→500 → callback() | `root.firstChild.style.width === '800px'`, `.height === '500px'` |
| R3 | 리사이즈 → 패널 좌표·카메라 재계산 | initialIndex 1(horizontal, 3패널) → 400→800 리사이즈 → callback() | 활성 패널(및 scene)의 `style.transform`이 리사이즈 전과 **다름**(computePositions 반영), `getActiveIndex() === 1` 불변, `onIndexChange` 미발화 |
| R4 | 동일 크기 조기 리턴 | 크기 변경 없이 callback() | `root.firstChild.style.width/height` 및 transform 스냅샷 **불변** (:193) |
| R5 | destroy 후 콜백 no-op | destroy() → clientWidth 변경 → callback() | throw 없음, DOM(스타일·transform) 불변 (:190) |
| R6 | 진행 트윈 즉시 보정 | RAF stub 하에 `scrollTo(1, { animated: true })`(트윈 시작, 미완료) → 리사이즈 callback() | **RAF flush 없이** 활성 패널이 새 좌표 기준 최종 위치의 transform(=`applyActiveIndexToCameraDirectly` 효과), 이후 잔여 RAF flush에도 transform 불변(트윈 취소 :210 증명) |

### T-04 (B-17) — camera-control.ts 커버리지 threshold 상향

**대상 파일:** `packages/core/vitest.config.ts` — 현재 `'**/camera-control.ts': { branches: 81, functions: 92 }`.

**절차 (Sprint 1·2·5와 동일한 램프 규칙):** T-01 완료 후 `pnpm --filter @guksu/wvkit-core exec vitest run --coverage`로 실측 → **실측값 −2%p(내림)** 로 상향. stepTween/startTween 커버로 branches ≥ 84, functions ≥ 94 실측 예상 — 하회하면 T-01 누락 케이스 재점검.

**완료 기준:** vitest.config diff에 camera-control 라인 상향 존재 + 커버리지 실행 exit 0. `pull-to-refresh.ts`/`stable-input.ts` threshold와 다른 파일 신규 threshold는 건드리지 않는다. (scroll-container.ts·virtual-keyboard.ts threshold 신설은 범위 외 — B-22 판단 사항.)

### T-05 (B-18) — 데모 계측 + PTR 픽스처 확장

**데모 변경:** `examples/react-example/src/PullToRefreshDemo.tsx` — 스타일·레이아웃·i18n 구조 변경 없음.
1. **testid 부여**: enabled 체크박스(:118)에 `data-testid="ptr-enabled-toggle"`, disableOverscrollContain 체크박스(:124)에 `data-testid="ptr-overscroll-toggle"`.
2. **fail-next 토글(신규 ControlItem)**: 체크박스 `data-testid="ptr-fail-next-toggle"` + `failNextRef = useRef(false)`(표시용 state와 동기). `handleRefresh`(:94)에서 `failNextRef.current`면 플래그를 false로 되돌리고 `refreshCount` 증가 후 `throw new Error('e2e-forced-refresh-failure')` — 리스트 항목은 추가하지 않는다. **`remountKey`(:92)에 fail-next를 포함하지 않는다**(ref 경유 — 토글이 인스턴스를 리마운트하면 안 됨).

**픽스처 변경:** `e2e/fixtures/pull-to-refresh.ts`
1. `setEnabled(page, enabled)`(:273-280)를 `page.getByTestId('ptr-enabled-toggle')` 기반으로 교체 — 현재 `input[type="checkbox"].first()` 순서 의존 제거(주석의 fragile 자인 해소, B-23 선반영). 주의: 데모의 enabled 토글은 `remountKey` 경유 재생성이므로 토글 후 `ptr-container` 재출현을 대기.
2. `pullOnContainer` opts에 `scrollTopBefore?: number`(기본 0) 추가 — 현재 무조건 `el.scrollTop = 0`(:78)인 것을 옵션값으로 설정하도록 변경. 기본값이 0이므로 기존 스펙 무영향.
3. 신규 헬퍼: `setFailNext(page)` (`ptr-fail-next-toggle` 체크), `getOverscrollBehavior(page): Promise<string>` (`page.evaluate`로 ptr-container의 **인라인** `el.style.overscrollBehavior` 반환 — 소스가 element.style로 직접 기록, `pull-to-refresh.ts:87-91`).

**완료 기준:** T-06 스펙이 위 헬퍼만으로 작성 가능 + 기존 e2e 4개 스펙 파일 무수정 통과.

### T-06 (B-18) — PTR e2e 계약 스펙 5건

**스펙 파일(신규):** `e2e/specs/pull-to-refresh.contract.spec.ts` — 각 test 타이틀에 **`contract —`** 접두 고정(qa grep용). 고정 대기 금지(`expect.poll`/`waitForState`만 — audit-e2e P2 flake 지적).

**수치 근거:** 기본 옵션 threshold 60 / maxDistance 120 / resistance 0.5. 감쇠식 `damped = min(raw/(1 + 0.5·raw/120), 120)` (`utils.ts:15-23`) — raw ≥ 240이면 정확히 120으로 clamp되므로 dy=600 당김 hold 시 distance readout은 **정확히 120**.

| # | 계약 (근거 라인) | 시나리오 | 단언 |
|---|---|---|---|
| C1 | enabled=false 당김 무시 (`pull-to-refresh.ts:117`) | `setEnabled(false)` → `pullOnContainer(150)` → `setEnabled(true)` → `pullOnContainer(150)` | 1차 당김 동안·후 state `idle` 유지 + `getRefreshCount() === 0`; 재활성 후 2차 당김으로 `waitForState('refreshing')` 도달 + count 1 (토글이 실제 효력 있음을 양방향 증명) |
| C2 | onRefresh reject → console.error + idle 복귀 + 후속 정상 (:200-202, D6) | `page.on('console')` 수집 시작 → `setFailNext(page)` → `pullOnContainer(150)` → `waitForState('idle')` → 다시 `pullOnContainer(150)` → `waitForState('idle')` | (1) 에러 메시지에 `'[wvkit] PullToRefresh onRefresh error'` 포함 1건 (2) reject 후 리스트에 `Refreshed` 항목 **없음** (3) 2차 당김은 `refreshing` 경유 + `Refreshed` 항목 1건 + `getRefreshCount() === 2` (인스턴스가 죽지 않음) |
| C3 | maxDistance cap (:34, :108 + `utils.ts:22`) | `pullOnContainer(600, { hold: true })` → `expect.poll(getDistance)` → `release()` → `waitForState('idle')` | hold 중 `getDistance() === 120` (초과 없음 — cap 정확값), release 후 정상 refresh 완료(armed 상태였으므로) |
| C4 | scrollTop>0 tryStart 거절 (:119) | `page.evaluate`로 컨테이너 `scrollTop = 200` 선설정 → `pullOnContainer(150, { hold: true, scrollTopBefore: 200 })` → 상태 확인 → `release()` | hold 중·release 후 state `idle` 유지, `getDistance() === 0`, `getRefreshCount() === 0` (리스트 20항목 × ~40px > 높이 280px — 스크롤 가능 전제 성립) |
| C5 | overscroll-behavior 자동 적용/opt-out (:87-91, D3) | 기본 상태에서 `getOverscrollBehavior()` → `ptr-overscroll-toggle` 체크(리마운트) → 새 컨테이너 대기 → 재조회 | 기본 `'contain'`, opt-out 후 `''` (미적용) |

**완료 기준:** 5개 test가 4개 Playwright 프로젝트(chromium/webkit/mobile-safari/mobile-chrome) 전부에서 skip 없이 통과. PointerEvent 합성만 사용하므로 엔진별 Touch 생성자 이슈 없음.

---

## 인수조건 (기계 검증 — 명령 + 기대 exit code)

> 인수조건 = 테스트 케이스 (TDD). AC-01~15는 T-01~03의 V/K/R 케이스와 1:1, AC-17~21은 T-06의 C1~C5와 1:1.

**단위 (B-17) — 검증 명령:**
```bash
pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose \
  src/components/scroll-container src/components/virtual-keyboard
# 기대: exit 0
```
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-01~06 | V1~V6 (CameraControl 트윈 6건) 통과 | 위 명령 exit 0 + verbose 출력 `grep -c "tween —"` ≥ 6 |
| AC-07~09 | K1~K3 (VirtualKeyboard 회전 3건) 통과 | 동일 명령 exit 0 + `grep -c "rotate —"` ≥ 3 |
| AC-10~15 | R1~R6 (ResizeObserver 보정 6건) 통과 | 동일 명령 exit 0 + `grep -c "resize —"` ≥ 6 |

**커버리지 게이트 (T-04):**
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-16 | camera-control.ts threshold 상향 후 커버리지 통과 | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` → exit 0, `git diff packages/core/vitest.config.ts`에 camera-control 라인 변경 존재(branches > 81, functions > 92), 타 파일 threshold 무변경 |

**e2e (B-18) — 검증 명령:**
```bash
pnpm test:e2e --grep "contract —" --list
# 기대: exit 0, 타이틀 5종(C1~C5) × 4 프로젝트 = 20건 나열
pnpm test:e2e --grep "contract —"
# 기대: exit 0, skip 0건
```
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-17 | C1: enabled=false 당김 무시 + 재활성 시 동작 | 위 실행 내 해당 test pass |
| AC-18 | C2: reject 시 `[wvkit] PullToRefresh onRefresh error` console + idle 복귀 + 2차 성공 | 동일 실행 내 pass |
| AC-19 | C3: dy=600 hold 시 distance 정확히 120 | 동일 실행 내 pass |
| AC-20 | C4: scrollTop=200에서 당김 → idle·distance 0·count 0 | 동일 실행 내 pass |
| AC-21 | C5: 인라인 overscrollBehavior 기본 'contain' / opt-out '' | 동일 실행 내 pass |

**전체 회귀 게이트:**
| AC | 내용 | 기계 검증 |
|---|---|---|
| AC-22 | 단위 전체 그린 (threshold 포함, react/vue 어댑터 포함) | `pnpm test` → exit 0 |
| AC-23 | e2e 전체 그린 (기존 스펙 + 신규 contract 5건 — 픽스처 `setEnabled` 교체·`pullOnContainer` 확장의 무회귀 증명) | `pnpm test:e2e` → exit 0 |

---

## 경계면 매핑 (생산자 ↔ 소비자 — qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 이번 스프린트의 계약 |
|---|---|---|---|
| CameraControl RAF 트윈 | `camera-control.ts` startTween/stepTween (384-417) | `scroll-container.ts` scrollTo/zoomTo(animated=true) → onChange→requestRender | 프레임당 easeOutCubic 보간 + onChange 1회, 완료 시 정확 도달·RAF 중단. T-01이 단위 고정, R6가 리사이즈와의 상호작용(트윈 취소) 고정 |
| VirtualKeyboard ↔ visualViewport | `virtual-keyboard.ts` update (28-54) | react/vue `useVirtualKeyboard` → 앱 레이아웃 조정 | "너비 변화 = 회전 → 기준 리셋, 키보드 아님". mock vp의 width/height 동시 갱신으로 재현 (기존 mock은 width 부재 — T-02에서 확장) |
| ScrollContainer ↔ ResizeObserver | `scroll-container.ts` RO 콜백 (189-213) | 호스트 레이아웃 변화(회전·분할화면) → renderer DOM (`root.firstChild` style/transform) | 리사이즈 1회 → frustum·setSize·패널 좌표 동기 보정 + 트윈 취소. 렌더가 동기(:143-145)라 flush 불필요 — qa는 transform 스냅샷 비교로 교차검증 |
| PTR 옵션/명령 ↔ 데모 컨트롤 | `PullToRefreshDemo.tsx` remountKey 재생성(:92) + fail-next ref | `e2e/fixtures/pull-to-refresh.ts` `setEnabled`(testid 교체)/`setFailNext` | enabled·overscroll 토글은 **리마운트 경유**(토글 후 컨테이너 재출현 대기 필수), fail-next는 **ref 경유 무리마운트**(같은 인스턴스로 reject→복구 검증이 목적이므로) |
| PTR onRefresh 에러 채널 | `pull-to-refresh.ts:200-202` console.error swallow | Playwright `page.on('console')` | 메시지 prefix `'[wvkit] PullToRefresh onRefresh error'` 고정 문자열 — 소스 변경 없이 이 문자열로 매칭 |
| PTR overscroll 스타일 | `pull-to-refresh.ts:87-91` `el.style.overscrollBehavior` 직접 기록 | 픽스처 `getOverscrollBehavior` | **인라인 style로 판정** (computed style은 UA 기본값 개입 여지) — 적용 'contain' / opt-out '' |

## 범위 제외

- **어댑터 StrictMode/rerender 테스트** — B-09 별도 (완료됨 — 회귀만 AC-22로 확인).
- PTR touch 경로·소스 승계 — Sprint 5(B-08/B-10)에서 완료, 재작업 금지.
- `scroll-container.ts`/`virtual-keyboard.ts` 커버리지 threshold **신설** — B-22 판단 사항.
- 기존 스펙의 `waitForTimeout`→`expect.poll` 일괄 전환·잔여 위치 의존 셀렉터 정리 — **B-23** 별도 (단, 이번 신규 산출물에는 고정 대기·순서 의존 셀렉터 금지, `setEnabled`의 testid 교체만 선반영).
- ScrollLock·`both` 폴백·줌 상태 pan e2e — **B-24**.
- 라이브러리 소스(`packages/*/src` 비테스트) 동작 변경 — 테스트 중 버그 발견 시(특히 R1 disconnect·V6 destroy 취소가 실패하는 경우) 리더 보고 후 별도 백로그.
- WKWebView 실기기 자동화(**B-19**), 데모 스타일·i18n 텍스트 변경(fail-next ControlItem 라벨은 기존 `tr.controls` 패턴 최소 추가만 허용).
