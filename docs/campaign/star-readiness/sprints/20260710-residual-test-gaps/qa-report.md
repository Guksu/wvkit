# qa-report — Sprint 8 (residual-test-gaps)

> 검증자: qa · 2026-07-11 · 브랜치 `sprint/20260710-residual-test-gaps`
> 입력: `plan.md`(AC-01~23) + `dev-notes.md`(경계면 매핑) + 변경 코드 8파일
> 판정 원칙: 전 항목 기계 검증(직접 재실행, exit code) + 생산자↔소비자 소스 대조 + 껍데기 테스트 판정

## 종합: **PASS (23/23)** — FAIL 0건

라이브러리 소스(`packages/*/src` 비테스트) 변경 없음 확인(git diff 대조). dev-notes의 실행 결과와 재실행 결과 전 항목 일치.

---

## 1. 인수조건 판정 (기계 검증 — 직접 재실행)

### 단위 (B-17)

검증 명령: `pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/components/scroll-container src/components/virtual-keyboard` → **exit 0, 146 passed**

| AC | 항목 | 판정 | 근거 |
|---|---|---|---|
| AC-01~06 | V1~V6 CameraControl 트윈 6건 | **[PASS]** | `grep -c "tween —"` = 6, 전부 통과 |
| AC-07~09 | K1~K3 VirtualKeyboard 회전 3건 | **[PASS]** | `grep -c "rotate —"` = 3, 전부 통과 |
| AC-10~15 | R1~R6 ResizeObserver 보정 6건 | **[PASS]** | `grep -c "resize —"` = 6, 전부 통과 |

### 커버리지 게이트 (T-04)

| AC | 항목 | 판정 | 근거 |
|---|---|---|---|
| AC-16 | camera-control threshold 상향 | **[PASS]** | `vitest run --coverage` exit 0. 실측 branches **84.04** / functions **100** → threshold `81/92 → 82/98` (−2%p 내림 램프 규칙 준수, diff 확인). pull-to-refresh(88/98)·stable-input(90/85) 등 타 파일 threshold 무변경 확인 |

### e2e (B-18)

- `pnpm test:e2e --grep "contract —" --list` → exit 0, **20건**(C1~C5 × chromium/webkit/mobile-safari/mobile-chrome) 나열
- `pnpm test:e2e --grep "contract —"` → exit 0, **20 passed, skip 0**

| AC | 항목 | 판정 | 근거 |
|---|---|---|---|
| AC-17 | C1 enabled=false 무시 + 재활성 동작 | **[PASS]** | 4 프로젝트 전부 pass. hold 중 idle·distance 0 + release 후 count 0, 재활성 후 refreshing 도달 + count 1 (양방향 증명) |
| AC-18 | C2 reject → console.error + idle + 후속 정상 | **[PASS]** | prefix `[wvkit] PullToRefresh onRefresh error` 정확히 1건 매칭 + Refreshed 항목 0→1 + count 2 |
| AC-19 | C3 maxDistance cap 정확값 120 | **[PASS]** | dy=600 hold 시 `getDistance() === 120` (감쇠식 raw≥240 → clamp 120, `utils.ts` 대조) |
| AC-20 | C4 scrollTop>0 tryStart 거절 | **[PASS]** | scrollTop=200 선설정 + `scrollTopBefore: 200` — idle 유지·distance 0·count 0 |
| AC-21 | C5 overscroll 인라인 contain / opt-out '' | **[PASS]** | 인라인 `el.style.overscrollBehavior` 판정 (computed 아님 — dev-notes 계약 준수) |

### 전체 회귀 게이트

| AC | 항목 | 판정 | 근거 |
|---|---|---|---|
| AC-22 | `pnpm test` exit 0 | **[PASS]** | core 265 + react 34 + vue 29 = 328 passed |
| AC-23 | `pnpm test:e2e` exit 0 | **[PASS]** | 222 passed / 10 skipped(기존 virtual-keyboard mobile-only — 스프린트 이전과 동일). 하단 §4-1 참고(1차 실행 부하 flake) |

부가: `pnpm typecheck` exit 0 / `pnpm lint` exit 0.

---

## 2. 경계면 교차검증 (생산자 ↔ 소비자 소스 대조)

| 경계면 | 대조 결과 |
|---|---|
| CameraControl RAF 트윈 | **일치.** `camera-control.ts:399-417` stepTween — 프레임당 `onChange()` 정확 1회(:410), t=1에서 `tween=null; rafId=null`(:414-415, 추가 프레임 미스케줄), `:406` fromZoom===toZoom 분기에서 projection 미갱신 — V1~V4 단언과 1:1. 재시작 시 `startTween→cancelAnimationInternal`(:385)이 기존 rafId를 취소 — V3의 `cancelSpy(2)` 단언 정확(1프레임 진행 후 재스케줄된 rafId=2). destroy(:448)가 `cancelAnimationInternal` 경유 — V6 일치 |
| VirtualKeyboard ↔ visualViewport | **일치.** `virtual-keyboard.ts:34-37` 너비 변경 → baseWidth/baseHeight 재설정, `:49` 상태 무변화 조기 리턴 — K1(onChange 미호출 근거), K2(새 기준 390 대비 300 — 옛 기준 754 아님), K3(`toHaveBeenLastCalledWith({isOpen:false, keyboardHeight:0})`) 모두 소스 동작과 1:1. mock에 `width` 추가로 기존 innerWidth 폴백 우회 문제 해소(plan 지적사항 반영) |
| ScrollContainer ↔ ResizeObserver | **일치.** `scroll-container.ts:190` destroyed 가드(R5), `:193` 동일 크기 조기 리턴(R4), `:201` setSize(R2), `:202-208` computePositions+좌표 재적용(R3), `:210-212` cancelAnimation+즉시 보정+동기 렌더(R6), `:259-261` disconnect(R1). 관측 지점은 dev-notes 명시대로 plan 힌트를 보정한 `cameraElement`(domElement>viewElement>cameraElement) — 실제 CSS3DRenderer 구조와 일치, three 버전 카나리아로 의도 문서화됨 |
| PTR 옵션 ↔ 데모 컨트롤 | **일치.** `PullToRefreshDemo.tsx:101` remountKey = `[threshold, maxDistance, resistance, enabled, disableOverscrollContain]` — **failNext 미포함**(ref 경유, plan 요구사항). testid 3종(`ptr-enabled-toggle`/`ptr-overscroll-toggle`/`ptr-fail-next-toggle`) 위치 정확. fail-next는 원샷(소비 후 자동 해제) + `refreshCount` 증가 + 리스트 항목 미추가 — C2 단언 전제와 일치. 픽스처 `setEnabled`는 testid 기반 + 리마운트 후 `ptr-container`/`row-state-value` 재출현 대기(순서 의존 셀렉터 제거 — B-23 선반영 확인) |
| PTR onRefresh 에러 채널 | **일치.** `pull-to-refresh.ts` catch 블록의 `console.error('[wvkit] PullToRefresh onRefresh error:', err)` — C2의 `includes` 매칭 문자열과 일치, 소스 무변경 |
| PTR overscroll 스타일 | **일치.** `pull-to-refresh.ts:87-91` `root.style.overscrollBehavior = 'contain'` 인라인 직접 기록(disableOverscrollContain 시 미기록) — `getOverscrollBehavior`가 `el.style`(인라인) 판정, contain/'' 계약 일치 |

## 3. 껍데기(load-bearing) 판정

세 테스트 파일 모두 **load-bearing** — 껍데기 단언 없음:

- `camera-control.tween.test.ts`: 정확 수치 단언(`toBeCloseTo(700/1.875, 6)`, 완료 시 `toBe(800)` 정확값), 부정 단언(`rafQueue.size === 0`, `onChange` 추가 호출 없음, `updateProjectionMatrix` 미호출), 취소 대상 rafId 정확 매칭(`cancelSpy(2)`). 수동 RAF 큐가 cancel 시 큐에서 제거(실 브라우저 시맨틱)라 취소 검증이 실효적.
- `virtual-keyboard.test.ts` rotate 3건: 오검출 부정 단언(K1 onChange 미호출) + 잘못된 기준값 배제 단언(K2 "754가 아님") + 마지막 통지 인자 정확 매칭(K3). 기존 9개 케이스 삭제 없음(git diff에서 `-it(` 0건), mock 시그니처 변경분 호출부 일괄 수정 확인.
- `scroll-container.resize.test.ts`: DOM 스냅샷 변경/불변 양방향 단언(R3 변경↔R4 불변), R6는 "RAF flush 없이 이미 보정 + flush 후 불변 + non-animated 점프와 DOM 동일성" 3중 증명 — 트윈 취소를 우회 불가능하게 고정.
- `pull-to-refresh.contract.spec.ts`: 고정 대기(`waitForTimeout`) 0건 — `waitForState`/`expect.poll`만 사용(grep 확인). C1·C2가 부정+긍정 양방향 단언으로 토글 효력을 증명.

## 4. 관찰 사항 (FAIL 아님 — 리더 참고)

1. **e2e 부하 민감성**: AC-23 1차 실행을 `pnpm test`와 동시 수행했더니 mobile-safari의 기존 ScrollContainer 스펙 2건(`scroll-container.api.spec.ts:43` clamp, `scroll-container.lifecycle.spec.ts:25` direction remount)이 실패(activeIndex readout 미갱신, 5s 타임아웃). 격리 재실행·단독 전체 재실행 모두 통과 — 이번 스프린트 변경 파일과 무관한 기존 스펙의 부하 flake로 판정. B-23(waitForTimeout→expect.poll 정리) 처리 시 함께 볼 후보로 기록.
2. **CSS3DRenderer 내부 구조 의존**: resize 테스트의 `cameraEl()`(firstChild.firstChild)은 three 내부 DOM 구조 의존 — dev-notes가 의도된 카나리아로 문서화했으므로 수용. three peer 범위 상향 시 이 테스트부터 깨질 수 있음을 인지할 것.
3. dev-notes의 포트 4173 충돌(vitepress preview와 상호 배타) 재발 없음 — 검증 시점 포트 비점유 확인.

## 5. 재검증 이력

| 회차 | 일시 | 결과 |
|---|---|---|
| 1차 | 2026-07-11 | PASS 23 / FAIL 0 |
