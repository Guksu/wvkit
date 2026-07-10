# Sprint 8 — 잔여 테스트 공백 구현 (residual-test-gaps)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer (에이전트) |
| 관련 경로 | packages/core/src/components/{scroll-container,virtual-keyboard}/__tests__/, packages/core/vitest.config.ts, e2e/{fixtures,specs}/pull-to-refresh*, examples/react-example/src/{PullToRefreshDemo.tsx,i18n.ts} |

## 1. 개요

star-readiness 캠페인 Sprint 8. 감사(audit-unit/audit-e2e)에서 지적된 마지막 P1 테스트 공백을 닫는다 — B-17(CameraControl RAF 트윈 / VirtualKeyboard 회전 baseHeight 리셋 / ScrollContainer ResizeObserver 보정 단위 테스트 3건)과 B-18(PullToRefresh CLAUDE §5 계약 e2e 5건). 라이브러리 런타임 소스 변경 없음 — 테스트·픽스처·데모 계측·vitest threshold만.

## 2. 작업내용

- 신규 `packages/core/src/components/scroll-container/__tests__/camera-control.tween.test.ts` — 수동 RAF 큐(Map 기반, cancel 시 큐 제거) + `performance.now` 스파이로 easeOutCubic 트윈을 프레임 단위 검증 (`tween —` V1~V6: 중간 보간 t=0.5→x=700 정확값, 완료 전이, 재시작 취소, zoom projection 분기, cancelAnimation 동결, destroy 취소).
- `packages/core/src/components/virtual-keyboard/__tests__/virtual-keyboard.test.ts` 확장 — mock visualViewport에 width 추가(기존 mock은 width 부재로 innerWidth 폴백에 빠져 회전 휴리스틱 검증 불가) + `makeFire` 헬퍼, `rotate —` K1~K3 3건 추가. 기존 케이스 전부 유지(호출부 2곳만 시그니처 맞춤).
- 신규 `.../scroll-container/__tests__/scroll-container.resize.test.ts` — ResizeObserver stub 수동 발화로 RO 보정 경로 검증 (`resize —` R1~R6: observe/disconnect, setSize px, 좌표 재계산, 동일 크기 조기 리턴, destroy 가드, 진행 트윈 즉시 보정). 카메라 행렬 관측은 CSS3DRenderer 실구조(`domElement > viewElement > cameraElement`) 기준.
- `packages/core/vitest.config.ts` — camera-control threshold 81/92 → 82/98 (실측 84.04/100 − 2%p 램프 규칙).
- `examples/react-example/src/PullToRefreshDemo.tsx` — enabled/overscroll 체크박스 testid 부여 + fail-next 원샷 토글(`ptr-fail-next-toggle`, ref 경유·remountKey 미포함·리스트 항목 미추가) / `i18n.ts` controls.failNext en·ko 추가.
- `e2e/fixtures/pull-to-refresh.ts` — `setEnabled`를 testid 기반으로 교체(순서 의존 제거, 리마운트 대기 포함), `pullOnContainer`에 `scrollTopBefore` 옵션(기본 0), 신규 `setFailNext`/`getOverscrollBehavior`(인라인 style 판정).
- 신규 `e2e/specs/pull-to-refresh.contract.spec.ts` — `contract —` C1~C5 (enabled=false 무시, reject 시 console.error+복구, maxDistance cap=120 정확값, scrollTop>0 거절, overscroll contain/opt-out). 고정 대기 없음.
- 검증: AC 명령 전부 exit 0 — 단위 146 passed(grep: tween 6/rotate 3/resize 6), coverage 게이트, contract 20/20(4 프로젝트, skip 0), `pnpm test`/`pnpm test:e2e`(222 passed)/`typecheck`/`lint`/`build`. 상세는 스프린트 폴더 `dev-notes.md`.

## 3. 주의사항

- **포트 4173 충돌**: 이전 세션의 stale `vitepress preview`가 4173을 점유해 e2e webServer 프로브가 타임아웃했음 — kill 후 정상. vitepress preview 기본 포트가 e2e와 같으므로 docs 프리뷰를 띄운 채 e2e를 돌리면 재발한다 (`lsof -iTCP:4173`로 확인).
- resize 테스트는 CSS3DRenderer 내부 DOM 구조(`viewElement/cameraElement` 중첩)에 의존 — three 메이저/마이너 업 시 이 테스트가 먼저 깨질 수 있음(카나리아 역할, 소스 버그 아님).
- changeset 없음 — `packages/*/src` 런타임 변경이 없다(테스트 파일만). 데모·e2e·config는 changeset 대상 아님.
- 테스트 작성 중 라이브러리 실버그 미발견 (plan이 경계한 R1 disconnect·V6 destroy 취소 모두 정상).
