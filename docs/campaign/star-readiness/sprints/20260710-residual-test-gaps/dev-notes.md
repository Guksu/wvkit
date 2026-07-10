# dev-notes — Sprint 8 (residual-test-gaps) implementer

> plan: `plan.md` (B-17 잔여 단위 공백 3건 + B-18 PTR e2e 계약 5건)
> 작성: implementer · 2026-07-10~11 · 브랜치 `sprint/20260710-residual-test-gaps`

## 변경 파일

| 파일 | 종류 | 태스크 |
|---|---|---|
| `packages/core/src/components/scroll-container/__tests__/camera-control.tween.test.ts` | 신규 (테스트) | T-01 — V1~V6, `tween —` 접두 6건 |
| `packages/core/src/components/virtual-keyboard/__tests__/virtual-keyboard.test.ts` | 수정 (테스트) | T-02 — mock에 width 추가 + `makeFire` 헬퍼 + `rotate —` 3건 (기존 케이스 전부 유지) |
| `packages/core/src/components/scroll-container/__tests__/scroll-container.resize.test.ts` | 신규 (테스트) | T-03 — R1~R6, `resize —` 접두 6건 |
| `packages/core/vitest.config.ts` | 수정 (config) | T-04 — camera-control threshold 81/92 → **82/98** (실측 84.04/100 − 2%p 내림). 타 파일 threshold 무변경 |
| `examples/react-example/src/PullToRefreshDemo.tsx` | 수정 (데모 계측) | T-05 — testid 2개(`ptr-enabled-toggle`/`ptr-overscroll-toggle`) + fail-next 토글(`ptr-fail-next-toggle`, ref 경유·remountKey 미포함) |
| `examples/react-example/src/i18n.ts` | 수정 (데모 i18n) | T-05 — `controls.failNext` 라벨 en/ko 추가 (기존 tr.controls 패턴 최소 추가) |
| `e2e/fixtures/pull-to-refresh.ts` | 수정 (픽스처) | T-05 — `setEnabled` testid 교체 + 리마운트 대기, `pullOnContainer`에 `scrollTopBefore`(기본 0), 신규 `setFailNext`/`getOverscrollBehavior` |
| `e2e/specs/pull-to-refresh.contract.spec.ts` | 신규 (e2e 스펙) | T-06 — `contract —` C1~C5, 고정 대기 없음(waitForState/expect.poll만) |

**라이브러리 소스(`packages/*/src` 비테스트) 변경 없음 → changeset 불필요.** 테스트 작성 중 실제 버그 미발견 (R1 disconnect·V6 destroy 취소 모두 기대대로 동작).

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 이번 산출물의 검증 |
|---|---|---|---|
| CameraControl RAF 트윈 | `camera-control.ts` startTween/stepTween | scroll-container onChange→requestRender | `camera-control.tween.test.ts` — 수동 RAF 큐(Map, cancel이 큐에서 제거) + `performance.now` 스파이. t=0.5→k=0.875 정확값(`toBeCloseTo(700/1.875, 6)`), 완료 시 정확 도달+큐 비움, 재시작 시 `cancelAnimationFrame(기존 rafId)` 단언 |
| VirtualKeyboard ↔ visualViewport | `virtual-keyboard.ts:32-38` 회전 리셋 | react/vue `useVirtualKeyboard` | mock vp를 `(width, height)` mutable로 확장(기존 mock은 width 부재로 innerWidth 폴백에 빠졌음) + `makeFire`가 등록된 'resize' 핸들러를 capture해 발화 |
| ScrollContainer ↔ ResizeObserver | `scroll-container.ts:186-216` RO 콜백 | 호스트 레이아웃 변화 → renderer DOM | `scroll-container.resize.test.ts` — MockRO(stubGlobal, create 전 설치) 수동 trigger. 관측 지점: `root.firstChild.style.width/height`(setSize) + **`root.firstChild.firstChild.firstChild`(cameraElement)의 transform** — CSS3DRenderer 구조는 `domElement > viewElement > cameraElement > panels`이고 카메라 행렬은 cameraElement에 기록됨 (plan의 "root.firstChild의 transform"은 한 단계 얕음 — 구현에서 보정) |
| R6 트윈 취소 교차검증 | RO 콜백의 `cancelAnimation()+applyActiveIndexToCameraDirectly` | — | 리사이즈 직후 DOM == 이후 `scrollTo(1, {animated:false})`(정의상 최종 위치) DOM 동일성으로 "즉시 최종 보정"을 증명 |
| PTR 옵션 ↔ 데모 컨트롤 | `PullToRefreshDemo.tsx` remountKey + fail-next ref | `setEnabled`/`setFailNext` 픽스처 | enabled·overscroll 토글은 리마운트 경유(setEnabled가 `ptr-container`+`row-state-value` 재출현 대기), fail-next는 ref 경유 무리마운트(원샷 — 소비 후 자동 해제, `refreshCount`는 증가시키고 리스트 항목은 미추가) |
| PTR onRefresh 에러 채널 | `pull-to-refresh.ts:202` `[wvkit] PullToRefresh onRefresh error` | C2 `page.on('console')` | prefix 문자열 매칭 정확히 1건 + reject 후 같은 인스턴스로 2차 refresh 성공 |
| PTR overscroll 스타일 | `pull-to-refresh.ts:87-91` 인라인 기록 | `getOverscrollBehavior` (el.style 판정) | 기본 `'contain'` / opt-out `''` — opt-out은 리마운트 경유라 `expect.poll`로 새 컨테이너 반영 대기 |

## 실행한 검증 명령과 결과 (AC 매핑)

| AC | 명령 | 결과 |
|---|---|---|
| AC-01~15 | `pnpm --filter @guksu/wvkit-core exec vitest run --reporter=verbose src/components/scroll-container src/components/virtual-keyboard` | exit 0, 146 passed. grep 카운트: `tween —` 6 / `rotate —` 3 / `resize —` 6 |
| AC-16 | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` | exit 0. camera-control 실측 branches 84.04 / functions 100 → threshold 82/98로 상향(diff 존재), 타 파일 무변경 |
| AC-17~21 | `pnpm test:e2e --grep "contract —" --list` → 20건(5×4 프로젝트) 나열 / `pnpm test:e2e --grep "contract —"` | exit 0, **20 passed, skip 0** |
| AC-22 | `pnpm test` | exit 0 (core 265 + react/vue 어댑터 포함 전체 그린) |
| AC-23 | `pnpm test:e2e` | exit 0 — 222 passed, 10 skipped(기존 virtual-keyboard mobile-only skip — 이번 스프린트 이전과 동일) |
| 부가 | `pnpm typecheck` / `pnpm lint` / `pnpm build` | 모두 exit 0 |

## 남긴 트레이드오프 / 특이사항

1. **포트 4173 충돌 (환경 이슈)**: 첫 `pnpm test:e2e` 실행이 webServer 프로브 타임아웃으로 실패 — 원인은 이전 세션(추정 audit-docs)의 stale `vitepress preview`(PID 23092, 7/10 23:30 시작)가 4173 IPv4 wildcard를 점유하고 `/wvkit/`에 404 응답. 해당 프로세스를 kill 후 정상. **vitepress preview 기본 포트도 4173이라 docs 프리뷰와 e2e가 상호 배타적** — 재발 시 `lsof -iTCP:4173` 확인. 후속 개선 후보: docs preview에 `--port` 고정.
2. **cameraElement 관측 경로**: plan 힌트의 "scene transform = root.firstChild의 style" 대신 실측 DOM 구조(`domElement > viewElement > cameraElement`) 기준으로 `firstChild.firstChild`를 사용. CSS3DRenderer 내부 구조 의존 — three 버전 업 시 이 테스트가 먼저 깨질 수 있음(의도된 카나리아).
3. **C2 레이스 방지**: release 직후 DOM state readout이 React 렌더 지연으로 이전 'idle'을 보일 수 있어, `waitForState('idle')` 전에 `expect.poll(getRefreshCount)===1`로 onRefresh 발화를 먼저 게이트.
4. mock visualViewport 시그니처를 `(width, height)`로 변경 — 기존 케이스 2곳 호출부를 일괄 수정(삭제 없음).
