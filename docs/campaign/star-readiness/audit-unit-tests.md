# 감사 보고서 — 단위/통합 테스트 품질 (Vitest)

**요약 (5줄)**
- 현재 상태: `pnpm test` = 237/237 통과, skip/경고 없음(turbo outputs 경고만). core 189 · react 25 · vue 24. 커버리지 도구는 이미 설정됨(v8, `@vitest/coverage-v8` 설치, lcov 리포터) — 단, threshold 미설정으로 강제되지 않음.
- 진짜 문제는 통과율이 아니라 **의미 검증의 편중**이다. 순수 함수(matrix-utils 100%, utils 100%, scroll-lock 100%, safe-area 100%)와 옵션 검증·라이프사이클은 탄탄하나, **각 컴포넌트의 존재 이유가 되는 핵심 동작이 미검증**이다.
- 가장 큰 3개 공백: (1) CameraControl의 pan-스냅/핀치 수식(branch 56%), (2) StableInput의 iOS 레이아웃 억제(`suppressLayoutShift`/`scrollAnchor`) 전량 미검증, (3) 한글 IME 조합 중 Enter가 `onSubmit`을 조기 발화하지 않는지 미검증.
- happy-dom의 TouchEvent 한계를 이유로 **터치 경로 전체가 pointer 경로로 대체**되면서, iOS의 touch→pointer 합성 이중처리 방어(PTR `activeSource`, StableInput 탭/스크롤 구분은 예외적으로 커버됨)가 단위 레벨에서 비어 있다 — e2e에만 의존.
- 어댑터(react/vue) 테스트는 전부 smoke 수준: StrictMode 이중 마운트·options 변경·rerender 시나리오 없음, 언마운트 테스트가 `not.toThrow()`로만 끝나 destroy 실제 효과를 검증하지 않음.

**커버리지 스냅샷 (core, v8)**

| 파일 | Stmts | Branch | Funcs | 미커버 핵심 |
|---|---|---|---|---|
| camera-control.ts | 89.4% | **56.5%** | 94.7% | 400-417(animated tween), 451-456(destroy capture release), pan/pinch 분기 |
| pull-to-refresh.ts | 78.9% | 82.1% | 88.5% | 216-273(Touch 핸들러 전체), 299-300, 330-332 |
| stable-input.ts | 85.7% | 87.2% | **78.6%** | 54, 127-144(suppressLayoutShift 함수 전체) |
| scroll-container.ts | 91.7% | 87.5% | 100% | 190-212(ResizeObserver) |
| virtual-keyboard.ts | 94.2% | 90% | 100% | 35-37(회전/너비변경 baseHeight 리셋) |
| matrix-utils / utils / scroll-lock / safe-area | 100% | 96~100% | 100% | — |

---

## 발견 목록

- [P0] CameraControl의 pan-스냅/핀치 줌 수식이 단위 레벨에서 미검증 — 근거: `camera-control.ts` branch 56.5%; `updatePan`(159-196) 엣지저항, `endPan`(198-234) 속도기반 스냅 방향(특히 217-224의 `lastMoveInterval` 지터 보정 버그픽스), `updatePinch`(265-302) 줌+앵커 보정이 어느 테스트에서도 값으로 단언되지 않음. `camera-control.test.ts`는 `animated=false` 명령형 API·destroy·`enablePinchZoom=false`만 검증하고, `scroll-container.integration.test.ts` scenario 7은 **전진 방향 pan 1건**만, 핀치는 "throw 없이 실행"(235-251)만 확인. 라이브러리의 핵심 차별점(대각 방지·축 스냅·핀치)이 사실상 무단언 / 제안: `endPan`을 순수 함수(dragRatio/velocityRatio → target)로 이미 분리된 `decideSnapTarget` 경로까지 실제 pointer 시퀀스로 전진/후진/서브임계값/속도역전 4방향 단언, `updatePinch` 결과 zoom·camera 위치를 `screenPointToWorld` 왕복으로 검증, 다지 손가락 승계(`onPointerEnd` 358-363) 케이스 추가 / 규모: M

- [P0] StableInput의 `suppressLayoutShift`/`scrollAnchor` 레이아웃 억제 로직 전량 미검증 — 근거: `stable-input.ts` 127-144 라인 0% 커버(funcs 78.6%). 이 컴포넌트의 존재 이유인 iOS 키보드 레이아웃 튀어오름 억제(`visualViewport` resize 핸들러, `scrollAnchor: 'bottom'`의 overflow 계산 + `scrollBy`, `'top'`, `'none'` 분기)가 테스트 없음. `stable-input.test.ts`는 듀얼 인풋 동기화·탭/스크롤 구분·포커스만 검증 / 제안: `visualViewport`를 목킹(height 축소)하고 focus 상태에서 resize 디스패치 → `window.scrollBy`/`scrollTo` 스파이로 anchor별 호출·미호출(‘none’, 비포커스) 단언 / 규모: M

- [P0] 한글 IME 조합 중 Enter가 `onSubmit`을 조기 발화하지 않는지 미검증 — 근거: `stable-input.ts` 119 라인(`isComposing || keyCode === 229` 가드)이 커버되지 않음; `stable-input.test.ts`의 Enter 테스트(97-105)는 조합 아닌 경우만. "한국의 모든 웹뷰"가 목표인데 조합형 입력의 대표 회귀 위험이 무방비 / 제안: `KeyboardEvent('keydown', { key:'Enter', isComposing:true })` 및 `keyCode:229` 케이스에서 `onSubmit` **미호출**, 조합 종료 후 Enter에서 호출 단언 / 규모: S

- [P1] PTR TouchEvent 경로 + iOS touch→pointer 합성 이중처리 방어가 단위 미검증 — 근거: `pull-to-refresh.ts` 216-273(`onTouchStart/Move/End`) 미커버, 특히 소스 승계 로직(224-231의 `activeSource==='pointer' && activePointerIsTouch → 'touch'`)과 `onTouchMove`의 `preventDefault`(251). 통합 테스트는 전부 PointerEvent로만 시뮬(파일 주석이 happy-dom TouchEvent 한계를 명시), 이 방어는 e2e에만 의존 / 제안: `changedTouches`/`identifier`를 주입한 Touch 유사 이벤트로 소스 승계·`preventDefault` 호출을 단위에서 재현(StableInput 테스트가 이미 쓰는 `Object.defineProperty` 패턴 재사용) / 규모: M

- [P1] destroy 이후 `scrollTo`/`zoomTo`가 여전히 콜백을 발화하고 DOM을 변형함 — 근거: `scroll-container.ts` `scrollTo`(220-229)/`zoomTo`(235-243)에 `destroyed` 가드가 없음. destroy 후 호출 시 `activeIndex` 갱신 + `applyVirtualization()`로 `panel.style.display` 재변형 + `onIndexChange` 발화(control만 null이라 카메라 트윈만 no-op). `scroll-container.test.ts` 369-383은 이를 **의도적으로 단언 회피**("whether callbacks fire is implementation-defined")하는 껍데기 단언 — 실제 누수를 테스트가 가리고 있음 / 제안: 구현에 `destroyed` 가드 추가 여부는 구현팀 결정으로 넘기되, 테스트는 현재 동작(콜백 발화 여부·display 변형)을 **명시적으로 단언**하도록 강화해 회귀를 고정 / 규모: S

- [P1] 어댑터(react/vue) 테스트가 smoke 전용 — StrictMode 이중 마운트·options 변경·rerender 미커버 — 근거: `use-scroll-container.ts`는 StrictMode 안전 cleanup(65-71)과 optionsRef 최신화(34-36)를 구현하나, 어떤 어댑터 테스트도 `<React.StrictMode>` 이중 마운트나 rerender로 options 갱신을 검증하지 않음(grep 결과 전무). 언마운트 테스트들(`use-pull-to-refresh` 32-48, vue 79-86 등)은 `expect(()=>unmount()).not.toThrow()`로만 끝나 destroy의 실제 효과(리스너 제거·overscroll 복원) 미확인 / 제안: StrictMode로 감싼 마운트에서 리스너/DOM이 이중 등록·잔존하지 않음을 단언, rerender로 새 콜백이 stale 없이 반영되는지 1건씩 추가 / 규모: M

- [P1] CameraControl `animated=true` 트윈(RAF `stepTween`) 미검증 — 근거: `camera-control.ts` 399-417 미커버. easeOutCubic 보간·중간 프레임·완료 시 `tween=null` 전이, 진행 중 재시작 취소가 무테스트 / 제안: `requestAnimationFrame`/`performance.now` 목킹으로 t=0/0.5/1 프레임의 `camera.position`·`onChange` 호출 단언 / 규모: S

- [P1] VirtualKeyboard 회전/창너비 변경 시 baseHeight 리셋 휴리스틱 미검증 — 근거: `virtual-keyboard.ts` 35-37(`currentWidth !== baseWidth → baseHeight 재설정`) 미커버. 회전 중 높이 감소를 키보드로 오검출하지 않는 iOS/Android 핵심 휴리스틱인데 테스트에 너비 변경 시나리오 없음(기존 테스트는 높이만 변경) / 제안: `innerWidth`/`visualViewport.width` 변경 + 높이 감소 동시 디스패치 → `isOpen` false 유지 단언 / 규모: S

- [P1] ScrollContainer ResizeObserver 보정 경로 미검증 — 근거: `scroll-container.ts` 190-212 미커버. root 리사이즈 시 카메라 frustum·renderer 사이즈·패널 좌표 재계산 + 진행 트윈 취소가 무테스트 / 제안: `ResizeObserver`를 목으로 대체하거나 콜백을 수동 트리거해 `computePositions` 반영·`control.cancelAnimation` 호출 단언 / 규모: M

- [P2] "not.toThrow()"만 하는 껍데기 단언이 여러 곳에 존재 — 근거: 어댑터 언마운트 테스트 다수, `scroll-container.test.ts` 369-383, 각 core의 SSR 블록 일부가 부수효과 없이 예외 부재만 확인. 예외 부재는 최소 요건일 뿐 동작 보증이 아님 / 제안: 각 케이스에 관측 가능한 부수효과(콜백 호출 수·DOM 상태·리스너 제거) 단언을 1개 이상 덧붙임 / 규모: M

- [P2] SafeArea가 실제 인셋 값을 검증하지 못함 — 근거: `safe-area.test.ts` 19-28/30-37은 `top`이 number라는 형태만 단언. happy-dom이 `env(safe-area-inset-*)`를 지원하지 않아 항상 0이 읽혀 padding-trick 파싱(`safe-area.ts` 28-36)의 실제 동작이 무의미하게 통과 / 제안: sentinel의 `getComputedStyle`을 스텁해 0이 아닌 padding을 주입하고 `readInsets`가 파싱·매핑을 올바로 하는지 단언 / 규모: S

- [P2] 세로 방향·후진 pan 스냅이 통합 미검증 — 근거: `scroll-container.integration.test.ts` scenario 7은 horizontal 전진 1건뿐. vertical 축 pan→스냅→`onIndexChange`, 후진(index 감소), 서브임계값 복귀(`onPanRelease` 원위치)가 통합에 없음(camera-control 단위엔 vertical `animated=false`만) / 제안: vertical 제스처 시퀀스 + 후진/복귀 케이스 추가 / 규모: S

- [P2] 커버리지 threshold 미설정 — 근거: `packages/*/vitest.config.ts`에 `coverage.thresholds` 없음. 도구는 있으나 회귀를 막는 게이트가 없어 커버리지 하락이 CI를 통과함 / 제안: 핵심 파일(camera-control/pull-to-refresh/stable-input)에 branch/func 하한을 점진 도입(현재 값 근처에서 시작해 상향) / 규모: S

- [P2] matrix-utils 잔여 분기 1건 미커버 — 근거: `matrix-utils.ts` 99 라인. 나머지 100%라 영향은 작음 / 제안: 해당 분기(경계 입력 추정) 1건 보강 / 규모: S
