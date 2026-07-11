# Sprint 6 (adapter-tests-docs) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-adapter-tests-docs/plan.md |

## 1. 개요

star-readiness 캠페인 Sprint 6 계획. 백로그 B-09(어댑터 테스트 실질화), B-14b(README Documentation 링크 섹션), B-15(커뮤니티 헬스 파일)를 대상으로, audit-unit-tests.md P1과 audit-docs-dx.md P1·P2 근거를 확인해 TDD 전제의 기계 검증 가능한 계획을 작성했다.

## 2. 작업내용

- 근거 감사 항목 확인: audit-unit P1(:35 어댑터 smoke 전용 — StrictMode/rerender/destroy 실효 미커버), audit-docs P1(:21 README 문서 링크 0, :27 커뮤니티 헬스 전무), P2(:41 TESTING.md 미링크).
- 어댑터 구현 4종(react use-scroll-container/use-pull-to-refresh + vue 대응)과 기존 테스트 파일을 읽어 관측 가능한 단언점 도출: PTR `overscrollBehavior` 적용/복원 + `onPull` 호출 수, StableInput input 요소 수(2/0), ScrollContainer renderer DOM 세트 수 + `onIndexChange`, VirtualKeyboard add/removeEventListener 짝 맞춤.
- 태스크 4건 정의: T-01 React 8케이스(A1~A8, StrictMode·rerender·destroy 실효), T-02 Vue 4케이스(A9~A12, Vue는 StrictMode/rerender 미해당 — destroy 실효 한정), T-03 README EN/KO Documentation 섹션(6종 상대 링크), T-04 CONTRIBUTING + 이슈 폼 2종 + PR 템플릿.
- 인수조건 AC-01~AC-12 작성(명령 + 기대 exit code). 테스트 타이틀 `[B-09]` 태그 규약으로 verbose grep 검증 가능하게 함(Sprint 1 교훈 반영).

## 3. 주의사항

- Vue에는 StrictMode·rerender 개념이 없어 B-09의 Vue 몫을 destroy 실효로 한정했다 — qa는 이를 결함이 아닌 설계로 판정할 것.
- happy-dom은 TouchEvent 부분 지원 → 제스처 시뮬은 core `pull-to-refresh.integration.test.ts`의 PointerEvent 헬퍼 패턴을 재사용해야 하며, PTR 가드(scrollTop=0) 충족 필요.
- 어댑터 테스트가 core 결함을 드러내면 core를 고치지 말고 리더 보고(계획의 범위 제외 항목).
- B-25(non-callback prop rerender 미반영)는 이번에 기능 추가하지 않음 — A4/A5는 콜백 반영만 검증.
- README 링크는 리포 경로만 사용(B-04 VitePress 사이트 미실물). 커뮤니티 파일은 백로그 명시 최소 세트만(CoC/SECURITY/FUNDING 제외).
