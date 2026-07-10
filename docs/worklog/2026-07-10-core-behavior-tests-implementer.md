# Sprint 2 core-behavior-tests 구현 (B-05 · B-06 · threshold 램프)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer (star-readiness 캠페인) |
| 관련 경로 | packages/core/src/components/scroll-container/__tests__/camera-control.gestures.test.ts, packages/core/src/components/stable-input/__tests__/stable-input.test.ts, packages/core/vitest.config.ts, docs/campaign/star-readiness/sprints/20260710-core-behavior-tests/ |

## 1. 개요

라이브러리의 핵심 동작 두 가지 — CameraControl 제스처 수식(pan/스냅/핀치/다지 승계)과 StableInput의 iOS 레이아웃 억제(`suppressLayoutShift`/`scrollAnchor`) — 가 사실상 무단언 상태였다(camera-control branch 56.5%, stable-input 127-144행 0%). plan.md(T-01~T-03)에 따라 이 동작들을 구체적 숫자로 고정하는 단위 테스트를 추가하고, 커버리지 threshold를 신규 실측에 맞춰 상향해 회귀 시 CI가 red가 되도록 잠갔다. 소스 코드는 변경하지 않았다.

## 2. 작업내용

- **신규**: `packages/core/src/components/scroll-container/__tests__/camera-control.gestures.test.ts` — 25케이스.
  - 그룹 A(5): updatePan 수식 — 부호(`start − dx/zoom`), 대각 방지, 엣지 저항(`-20`), zoom 스케일, vertical 축.
  - 그룹 B(5): endPan 스냅 — 전진/후진/서브임계값/플릭/지터 가드(dt 하한 버그픽스 회귀). `performance.now` 목킹으로 결정적.
  - 그룹 C(6): 핀치 — 배율 1.5, 앵커 보정(`x=416` + `screenPointToWorld` 왕복), 클램프, endPinch 콜백, two-finger pan 저항(`-40`), cross-axis 고정.
  - 그룹 D(2): 다지 승계 — 2→1 pan 재앵커, 3→2 pinch 재시작.
  - 그룹 E(7): 경계·가드 보강 — 빈 positions, vertical 스냅/핀치, rootSize 0, 무효 pointerId, dead-panStart, destroy 중 캡처 release(m-5). (최초 실측 branches 66.21%가 플로어 70 미달이라 플랜 지침대로 테스트를 보강 — 최종 84.26%.)
- **수정**: `packages/core/src/components/stable-input/__tests__/stable-input.test.ts` — S1~S8 8케이스. mock visualViewport(`EventTarget` + `Object.defineProperty`, 생성 전 주입)로 키보드 resize를 재현해 `scrollBy({top:208, behavior:'instant'})` 정확 인자, anchor 3종, 게이트 2종(비포커스/none), opt-out(리스너 미등록), destroy 해제, vv 부재를 고정.
- **수정**: `packages/core/vitest.config.ts` — threshold 램프: camera-control 55/90→81/92, stable-input 85/75→90/85 (실측−2~3%p, stable-input functions는 플로어 85 적용). pull-to-refresh 80/85 미변경.
- **검증**: AC-01~08 전부 통과. `pnpm test`(225) / `typecheck` / `lint` / `build` 모두 exit 0. 소스 무변경(AC-08 exit 1 확인).
- **산출물**: `docs/campaign/star-readiness/sprints/20260710-core-behavior-tests/dev-notes.md` (생산자↔소비자 매핑, AC별 결과, 커버리지 실측표).

## 3. 주의사항

- **stable-input functions 하한 85는 실측(85.71) 대비 마진 0.71%p** — stable-input에 새 함수를 추가하면 테스트 동반 없이는 coverage gate가 red. 의도된 강한 잠금.
- 테스트 기대값은 `matrix-utils.ts` 순수 함수 수식에서 도출 — `applyResistance`/`decideSnapTarget`(velocityWeight 0.3)/`screenPointToWorld` 수식이 바뀌면 정확값 단언(`-20`, `416`, `-40`, `-290`, `208` 등)도 함께 갱신해야 한다.
- happy-dom v15는 `setPointerCapture`/`visualViewport` 미제공 — E7과 S계열의 스텁·주입 패턴 참고(후속 B-17 VirtualKeyboard 테스트에서 재사용 가능).
- 트윈(RAF, camera-control 400-417) 미커버는 B-17 범위로 의도적 제외. changeset 없음(런타임 변경 없음). 테스트 중 소스 버그는 발견되지 않았다.
