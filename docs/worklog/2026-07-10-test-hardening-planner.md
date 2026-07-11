# Sprint 10 (test-hardening) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-test-hardening/plan.md |

## 1. 개요

star-readiness 캠페인 Sprint 10의 계획 수립. 백로그 B-22(껍데기 단언 정리)·B-23(e2e 안정화)·B-24(e2e 잔여 커버) 3건을 8개 태스크로 분해하고, 인수조건 33개 테스트 케이스와 기계 검증 게이트(명령 + exit code)를 정의했다. 근거는 audit-unit-tests.md P2(43·45행), audit-e2e.md P2(44·46·48·50·52행).

## 2. 작업내용

- 생성: `docs/campaign/star-readiness/sprints/20260710-test-hardening/plan.md` — 목표 / 태스크 T1~T8 / 인수조건(게이트·grep 가드·TC 33개) / 경계면 매핑 / 범위 제외.
- 사전 조사(코드 실상 반영):
  - `not.toThrow` 41건 전수 grep 후 B-09/B-13에서 이미 강화된 것을 제외하고 잔여 껍데기만 T1(core 14건)·T2(어댑터 6건)로 목록화.
  - PTR e2e 픽스처는 B-23 testid 전환이 선반영됨(`e2e/fixtures/pull-to-refresh.ts:276`) — 잔여는 scroll-container 계열 3곳으로 좁힘.
  - ScrollLock 코어는 ref-count가 아닌 prev-값 복원 방식임을 확인(`scroll-lock.ts:39-60`) — TC-24-02는 이 의미론을 고정하도록 설계.
  - 데모 확장 필요 지점 특정: `ScrollContainerDemo.tsx`(ctl-direction/ctl-enable-pinch-zoom testid), `ScrollLockDemo.tsx`(scroll-spacer + 2번째 lock 인스턴스). 탭 testid `tab-${id}`는 main.tsx에 이미 존재함을 확인.
- 핵심 결정:
  - 라이브러리 소스(packages/*) 변경 금지 — 이 스프린트는 테스트·픽스처·데모만 수정. 테스트 중 구현 결함 발견 시 백로그 신규 등록.
  - 기존 테스트 삭제 금지, 단언 증강만 — core 커버리지 threshold(camera-control 55/90, ptr 80/85, stable-input 85/75) 하락 방지.
  - 신규 테스트 타이틀에 TC-22-2x / TC-24-0x 프리픽스를 강제해 grep 기반 존재 검증 가능하게 함(Sprint 1 교훈: vitest는 `--reporter=verbose` 필요).

## 3. 주의사항

- CSS3DRenderer 래퍼 체인 셀렉터(`:scope > div > div > div`)는 렌더러 생성 DOM이라 testid 부여 불가 — 범위 제외로 명시했으니 implementer가 무리하게 교체하지 말 것.
- `pull-to-refresh.contract.spec.ts:17`의 "waitForTimeout" 문자열은 주석(금지 안내)이므로 grep 가드는 `waitForTimeout(` 호출 패턴으로만 검출해야 오탐이 없다.
- TC-24-04(visualViewport 리스너 카운터)는 StableInput 등 다른 소비자와 간섭하므로 반드시 탭 진입 전 스냅샷 대비 델타로 단언할 것.
- e2e 대상은 react-example(:4173)뿐 — vue-example 데모 확장은 이번 범위가 아님.
