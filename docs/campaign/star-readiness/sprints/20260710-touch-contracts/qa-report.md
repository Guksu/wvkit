# Sprint 5 — touch-contracts QA 보고서

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 검증자 | qa 에이전트 (구현자 분리 검증) |
| 입력 | `plan.md` 인수조건 AC-01~18 + `dev-notes.md` 경계면 매핑 + 변경 코드 전체 |
| 판정 방식 | 전 항목 직접 재실행 (exit code) + 소스 대조 교차검증 + 껍데기 테스트 판정 |

## 종합 판정: **전 항목 PASS** (18/18) — 단, AC-18은 조건부 PASS (기존 flake 리스크, §4 참조)

---

## 1. 인수조건 판정 (기계 검증 — 전부 QA가 직접 재실행)

### 단위 (B-08 / T-01)

| AC | 내용 | 판정 | 근거 (QA 직접 실행) |
|---|---|---|---|
| AC-01~08 | U1~U8 순수 touch 경로 8건 통과 | **PASS** | `pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/components/pull-to-refresh` → **exit 0**, 60 tests passed. U1~U8 타이틀 8건 verbose 출력에서 확인 |
| AC-09~11 | U9~U11 소스 승계·이중처리 3건 통과 | **PASS** | 동일 명령 exit 0, `grep -c "touch —"` = **16** (≥11). U9~U11 타이틀 3건 확인 |
| AC-12 | pull-to-refresh.ts threshold 상향 + 커버리지 exit 0 | **PASS** | `vitest run --coverage` → **exit 0**. 실측 branches **90.07** / functions **100** (dev-notes 주장과 일치). diff: `branches 80→88, functions 85→98` (실측 −2%p 내림 규칙 준수: 90.07−2=88.07→88, 100−2=98). camera-control·stable-input threshold 변경 없음 확인 |

### e2e (B-10 / T-03·T-04)

| AC | 내용 | 판정 | 근거 |
|---|---|---|---|
| AC-13 | G1 대각 드래그 → index 1 + scene Y-shift 불변 | **PASS** | `pnpm test:e2e --grep "@golden"` → **exit 0, 16/16 passed, skip 0** (4 프로젝트 × 4 시나리오). 타이틀에 `diagonal` 포함 확인 (`--list` exit 0, 16건 나열) |
| AC-14 | G2 VP resize 중 display top·scrollY·포커스 불변 | **PASS** | 동일 실행 내 stable-input 스펙 4 프로젝트 pass |
| AC-15 | G3 orientationchange → readout '47px'/'34px' | **PASS** | 동일 실행 내 safe-area 스펙 4 프로젝트 pass. `expect.poll` 사용 — 고정 대기 없음 확인 |
| AC-16 | G4 touch+합성 pointer → refresh-count 정확히 1 | **PASS** | 동일 실행 내 pull-to-refresh.touch.spec 4 프로젝트 pass (WebKit fallback 포함 skip 0). 추가로 mobile-chrome 단독 `--repeat-each=6` → **6/6 pass** |

### 전체 회귀 게이트

| AC | 내용 | 판정 | 근거 |
|---|---|---|---|
| AC-17 | `pnpm test` exit 0 | **PASS** | turbo 캐시 우회 위해 `turbo run test --force`로 실측 재실행 → **exit 0** (core 250 / react 26 / vue 25 전부 pass) |
| AC-18 | `pnpm test:e2e` exit 0 | **PASS (조건부)** | 3회 실행: 1회차 exit 1(mobile-safari 기존 스펙 flake), 2회차 exit 1(mobile-chrome 브라우저 wedge), **3회차 exit 0 — 202 passed / 10 skipped / 0 failed** (dev-notes 주장과 정확히 일치). 실패 2회는 모두 스프린트 변경과 무관 — §4 상세 |

### 보조 게이트 (에이전트 규칙)

| 항목 | 판정 | 근거 |
|---|---|---|
| `pnpm typecheck` | **PASS** | exit 0 |
| `pnpm lint` | **PASS** | exit 0 |

---

## 2. 경계면 교차검증 (생산자 ↔ 소비자 소스 대조)

| 경계면 | 판정 | 대조 결과 |
|---|---|---|
| PTR touch 계약: `pull-to-refresh.ts:216-273` ↔ 단위 테스트 | **PASS** | 소스 승계 분기(224-231: `activeSource==='pointer' && activePointerIsTouch`)를 U9가 정확히 재현 — pointerdown(touch)이 `activePointerIsTouch=true` 설정(281), touchstart가 소스만 승계하고 `startClientY`는 유지 → U9의 `1200/17` 단언이 startClientY 100 승계를 값으로 증명. U11은 `pointerType:'mouse'` → `activePointerIsTouch=false` → 229 `activeSource !== null` return 경로를 정확히 침. 감쇠 기대값 240/7·1200/17은 `applyResistance` 수식과 일치 |
| PTR ↔ e2e 픽스처 이벤트 순서 | **PASS** | `pullWithTouchAndSyntheticPointer`: pointerdown→touchstart→[touchmove,pointermove]쌍→touchend→pointerup — 소스 주석(221-223)의 실기기 순서와 일치. WebKit fallback의 touch 유사 객체 표면 `{identifier, clientX, clientY}` + `{length, item(i)}`는 소스가 소비하는 표면(219, 239-245, 264-270)과 일치 |
| PTR → 데모 readout | **PASS** | `PullToRefreshDemo.tsx` `refreshCount`(onRefresh에서 증가) → `DataRow label="refresh-count"` → `ui.tsx:35-37`이 `row-refresh-count-value` testid 자동 생성 확인 → 픽스처 `getRefreshCount`가 같은 testid 파싱 |
| StableInput ↔ visualViewport 스텁 | **PASS** | `stable-input.ts:126` `if (... && window.visualViewport)` — create 시점 capture 확인 → `installVisualViewportStub`이 `addInitScript` 사용(필수 조건 충족). 'bottom' anchor의 overflow 판정(`containerRect.bottom - vp.height > 0`)과 G2의 동적 하한(`max(innerHeight−320, bottom+24)`)이 "overflow 0 → 무보정" 전제를 모든 프로젝트에서 보존 — 편차 5(dev-notes §4)는 타당 |
| SafeArea sentinel ↔ react state ↔ readout | **PASS** | `safe-area.ts:12-26` sentinel 인라인 padding에 `env(safe-area-inset-*)` → 스텁의 식별 조건과 일치. `:53` orientationchange → `handleChange` → `onChange(readInsets())` → react `use-safe-area.ts:11` `onChange: setInsets` → 데모 `` value={`${top}px`} `` → '47px'/'34px' 단언과 단위 일치 (parseFloat('47px')=47 → '47px' 재조립) |
| ScrollContainer scene transform | **PASS** | `getSceneYShift`는 `getSceneXShift`(55-72)의 정확한 Y 대칭 (`m.y` + translate 2번째 그룹). 대각 스와이프 dx -160→-220 편차(dev-notes §4-2)는 snapThreshold 0.3 경계(dragRatio 0.29) flake 제거 목적으로 타당 — Y 오염 검출력은 dy(-120)가 결정하므로 계약 불변 |

## 3. 껍데기 테스트 판정 — **전부 load-bearing**

- 단위 18건(U1~U11 + 램프 7건): 전부 값 단언 — `toBeCloseTo(240/7)`·`toBeCloseTo(1200/17)`(감쇠 수식 역산), `defaultPrevented` true/false 양방향, `toHaveBeenCalledTimes(1)`, 상태열 `toEqual([...])` (toContain이 아닌 정확 배열 비교 — 추가 전이 검출). `lastPullDistance` 헬퍼가 onPull 미호출 시 명시적 throw — 침묵 통과 불가.
- 음성 단언(U5·U6·U7·U11 "미호출")은 모두 대응 양성 단언과 쌍 — 예: U11은 touchmove 무시 + pointermove 구동을 같은 테스트에서 단언.
- G4 e2e: `waitForState('refreshing')`를 idle 확인 전에 배치 — "아무 일도 안 일어나 count 0→0" 류의 트리비얼 통과 차단. refresh-count `toBe(1)` (toBeGreaterThan 아님 — 이중 발화 시 2로 실패).
- 램프 7건도 각각 소스의 실제 분기(111, 118, 261, 279, 292-294, 298-300, 165-169)에 대응 — threshold 숫자 채우기용 무의미 케이스 아님.

## 4. 발견 사항 (수정 요청 없음 — 리스크·후속 권고)

### R-1. [미해결 리스크 — 스프린트 무관] 기존 e2e flake: `scroll-container.api.spec.ts:43` (mobile-safari)
- 전체 스위트 1회차 실행에서 실패 (`row-activeIndex-value` expected '5' received '0'). **단독 반복 실행(--repeat-each=5)에서도 1/5 실패** → 병렬 부하와 무관한 내재 flake.
- 이 스펙(commit 938a51f)과 라이브러리 소스는 이번 스프린트에서 미변경 — 스프린트 회귀 아님. 로컬 `retries: 0`이라 로컬 풀런에서 간헐 red (CI는 retries 2로 흡수 가능성 높음).
- **권고:** B-23(기존 스펙 대기 정리)에 이 스펙의 non-animated scrollTo 후 readout 폴링 보강을 명시 추가.

### R-2. [모니터링] 전체 스위트 2회차의 mobile-chrome 브라우저 wedge
- 2회차 실행에서 mobile-chrome 4건 실패 — 전부 "Tearing down context exceeded 30000ms" 동반, `pull-to-refresh.touch.spec.ts` 파일에서 hang 시작(16.4m) 후 같은 워커의 safe-area 스펙 연쇄 실패. 브라우저 인스턴스 단위 wedge.
- 신규 스펙 귀책 여부: mobile-chrome 단독 6/6 pass(각 2.7s), golden 16/16 pass 2회, 3회차 풀런 그린 — **재현 불가, 환경성으로 판단**. 단 CI에서 동일 패턴 재발 시 trace(`e2e/test-results/.../trace.zip`) 확보해 신규 스펙의 `page.evaluate` async 루프를 우선 조사할 것.

### 참고 (판정 영향 없음)
- `PullToRefreshDemo.tsx`의 계측 wrapper `<div style={{ marginTop: 8 }}>`: 인라인 스타일이나 데모 앱은 기존에도 인라인 스타일 관례(동일 파일 6곳, ui.tsx 전체) — 라이브러리 컨벤션(인라인 금지) 적용 대상 아님. plan의 "스타일·레이아웃 변경 없음"은 기존 요소 기준으로 충족.
- `backlog.md` 2줄 수정은 planner 산출물 (dev-notes §5 기재와 일치) — implementer/qa 범위 아님.
- 라이브러리 소스(`packages/*/src` 비테스트) 변경 없음 확인 (`git status`) → changeset 불필요 판단 타당.

## 5. dev-notes 주장 대조 (구현자 보고 신뢰성)

| dev-notes 주장 | QA 재실행 결과 | 일치 |
|---|---|---|
| grep "touch —" = 16 | 16 | ✓ |
| 커버리지 branches 90.07 / functions 100 | 90.07 / 100 | ✓ |
| golden 16/16, skip 0 | 16/16, skip 0 | ✓ |
| `pnpm test` core 250 포함 exit 0 | 250/26/25 pass, exit 0 (--force 재실행) | ✓ |
| e2e 202 passed / 10 skipped | 3회차 202/10/0 (1·2회차는 기존 flake·환경 wedge로 red) | ✓ (조건부) |
