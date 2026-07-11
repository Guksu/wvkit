# Sprint 8 (residual-test-gaps) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner (star-readiness 캠페인) |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-residual-test-gaps/plan.md |

## 1. 개요

백로그 B-17(잔여 단위 공백 — CameraControl RAF 트윈 / VirtualKeyboard 회전 baseHeight 리셋 / ScrollContainer ResizeObserver 보정)과 B-18(PTR e2e 잔여 계약 5건)을 구현 가능한 스프린트 계획으로 분해했다. 근거는 audit-unit-tests.md P1 4·5·6번째와 audit-e2e.md P1 4번째 + PullToRefresh 커버리지 매트릭스 행을 원문 확인했고, 대상 소스(camera-control.ts 376-448, virtual-keyboard.ts 32-38, scroll-container.ts 186-216·259-261, pull-to-refresh.ts 87-119·200-202, utils.ts 15-23)와 기존 테스트·e2e 픽스처·데모를 직접 읽어 라인 근거를 계획에 박았다.

## 2. 작업내용

- 생성: `docs/campaign/star-readiness/sprints/20260710-residual-test-gaps/plan.md` — 태스크 6건(T-01 트윈 단위 6케이스 / T-02 회전 3케이스 / T-03 RO 6케이스 / T-04 camera-control threshold 램프 / T-05 데모 계측+픽스처 확장 / T-06 e2e 계약 스펙 5케이스), 인수조건 23건(전부 명령 + 기대 exit code), 경계면 매핑 6행, 범위 제외 명시.
- 핵심 결정 1 — 트윈 검증은 vitest fake timers 대신 **수동 RAF 큐 + performance.now 스파이**로 지정(프레임 단위 결정성). 기대값을 easeOutCubic 수식에서 미리 도출(t=0.5 → x=700 / zoom=1.875)해 인수조건을 값 단언으로 고정.
- 핵심 결정 2 — RO 보정의 관측 지점을 `root.firstChild`(CSS3DRenderer.domElement)의 style.width/height와 transform 스냅샷으로 지정. requestRender가 동기(renderer.render 직접 호출, scroll-container.ts:143-145)임을 확인해 RAF flush 불요를 명시.
- 핵심 결정 3 — B-18의 onRefresh reject 계약은 데모에 **ref 경유 fail-next 토글**(remountKey 미포함 — 같은 인스턴스로 reject→복구를 검증해야 하므로)을 신설해 검증. enabled/overscroll 토글은 기존 remountKey 경유임을 픽스처 계약으로 문서화.
- 핵심 결정 4 — maxDistance cap 인수조건을 근사가 아닌 **정확값 120**으로 고정(감쇠식상 raw ≥ 240이면 hard clamp — utils.ts:22). scrollTop>0 거절은 픽스처가 무조건 scrollTop=0을 강제하는 문제(:78)를 `scrollTopBefore` 옵션으로 풀도록 지정.
- 캠페인 관례 반영: 테스트 타이틀 접두(`tween —`/`rotate —`/`resize —`/`contract —`) + `--reporter=verbose` grep(Sprint 1 교훈), threshold 램프 규칙(실측 −2%p), 고정 대기 금지.

## 3. 주의사항

- R1(destroy 시 RO disconnect)·V6(destroy 시 트윈 취소)는 소스에 구현이 존재함을 확인하고 넣었으나, 실패하면 소스 버그이므로 impl이 임의 수정하지 말고 리더에게 보고해야 한다(plan.md 범위 제외 절에 명시).
- e2e `setEnabled` 픽스처를 순서 의존 셀렉터에서 testid로 교체하는 것은 B-23의 부분 선반영 — B-23 착수 시 중복 작업하지 않도록 주의.
- 데모 enabled 토글은 리마운트를 유발하므로 e2e에서 토글 후 `ptr-container` 재출현 대기가 필수 — 이걸 빼먹으면 stale element로 flake가 난다.
- 기존 virtual-keyboard mock에 width가 없어 확장이 필요한데, 기존 케이스 삭제는 금지(커버리지 threshold는 camera-control/ptr/stable-input 3파일뿐이지만 기존 단언 자체가 회귀 방지선).
