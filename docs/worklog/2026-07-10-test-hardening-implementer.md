# Sprint 10 test-hardening 구현 (B-22 + B-23 + B-24)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | implementer |
| 관련 경로 | `packages/*/src/components/*/__tests__/`, `e2e/specs/`, `e2e/fixtures/scroll-container.ts`, `examples/react-example/src/{ScrollContainerDemo,ScrollLockDemo}.tsx`, `docs/campaign/star-readiness/sprints/20260710-test-hardening/` |

## 1. 개요

테스트를 "통과한다"에서 "동작을 보증한다"로 격상하는 스프린트. `not.toThrow()`만 있는 껍데기 단언 20곳(core 14 + 어댑터 6)에 관측 가능한 부수효과 단언을 추가하고(B-22), happy-dom이 0으로 계산하는 SafeArea `env()` 인셋 파싱을 getComputedStyle 스텁으로 실검증(TC-22-20~22)했다. e2e에서는 고정 대기 3건을 상태 폴링으로, 위치 의존 셀렉터를 data-testid로 교체하고(B-23), ScrollLock 위치복원·중첩 / VirtualKeyboard scroll 경로·리스너 해제 / ScrollContainer both 폴백·줌 pan 커버 공백 6건(TC-24-01~06)을 채웠다(B-24). 라이브러리 소스 변경은 없다.

## 2. 작업내용

- core 테스트 11개 파일: 껍데기 단언 14건 증강(테스트 삭제 0건 — 커버리지 threshold 유지). 대표적으로 'both' 폴백에 `getActiveIndex()===1`+`onIndexChange` 고정, setEnabled에 pointer 시퀀스 게이트 검증, `applyResistance(5,10,0,0.2)===10` 정확값 고정.
- `safe-area.test.ts`: sentinel 한정 getComputedStyle 스텁(원본 위임 + restoreAllMocks)으로 TC-22-20(파싱·방향 매핑)/21(0 폴백)/22(orientationchange 재파싱) 신규 3건.
- 어댑터 테스트 5개 파일: unmount 후 콜백 미발화·DOM 정리·초기값 계약 등 6건 증강. vue virtual-keyboard는 window 폴백 경로로 재구성해 실 리스너 해제를 검증.
- `e2e/fixtures/scroll-container.ts`: `waitForSceneStable` 추출·export, `waitForScrollSettle`이 재사용. CSS3D 래퍼 체인(`:scope > div > div > div`) 구조 의존 주석 보강(testid 불가 — 범위 제외 항목).
- e2e 스펙 5개 파일: waitForTimeout 3건 제거, `select.first()`/checkbox 셀렉터 → `ctl-direction`/`ctl-enable-pinch-zoom`, 탭 role/regex → `tab-*` testid, TC-24-01~06 신규 6건(타이틀 프리픽스 준수).
- 데모 2개 파일: `ScrollContainerDemo.tsx` 컨트롤 testid 2종, `ScrollLockDemo.tsx` 2번째 lock 인스턴스(`lock2-*`) + `scroll-spacer`(1600px).
- 검증: `pnpm --filter @guksu/wvkit-core test -- --coverage`·`pnpm test`·`pnpm test:e2e`(242 passed/14 skipped)·`pnpm lint`·`pnpm typecheck`·`pnpm build` 전부 exit 0. grep 가드 5종·타이틀 카운트(TC-24=24, TC-22-2=3) 통과. TDD red: 데모 testid 부재 상태에서 신규 스펙 6건 red 확인 후 green 전환.
- 산출물: 같은 스프린트 폴더 `dev-notes.md`(변경 파일·경계면 매핑·트레이드오프 7건).

## 3. 주의사항

- **changeset 없음**: packages/* 런타임 변경 없음(테스트·데모·e2e만) — 배포 불필요.
- **TC-24-01은 DOM click**(`page.evaluate`) 사용: Playwright click()의 자동 스크롤이 lock 시점 scrollY를 훼손하기 때문. 복원 단언은 `|Δ|≤2` 오차 허용(chromium scrollTo 드리프트 관측).
- **TC-24-02는 prev-값 복원 의미론을 고정**: scroll-lock을 ref-count 방식으로 바꾸면 이 테스트가 의도적으로 red가 된다.
- **pre-existing flake 1건 보고**: `scroll-container.lifecycle.spec.ts:70`(S8 scrollTo(5))가 mobile-safari 풀 스위트 병렬 부하에서 1회 실패(격리·재실행 green, 이번 변경과 무관). 백로그 등록 검토 필요.
- e2e 디렉토리는 전용 tsconfig가 없어 `pnpm typecheck` 미커버(기존과 동일) — B-25 후보.
- plan T5 표에 없던 `scroll-container.lifecycle.spec.ts:30`의 select 셀렉터도 grep 가드 충족을 위해 함께 교체했다.
