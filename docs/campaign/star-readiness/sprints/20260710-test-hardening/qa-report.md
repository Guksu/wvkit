# qa-report — Sprint 10 test-hardening (B-22 + B-23 + B-24)

| 항목 | 내용 |
|------|------|
| 검증자 | qa (2026-07-11) |
| 입력 | plan.md 인수조건 + dev-notes.md 경계면 매핑 + git diff HEAD (25 파일, +507/-46) |
| 판정 | **전 항목 PASS (FAIL 0)** — 게이트·grep 가드·타이틀 카운트 전부 직접 재실행(exit code), 경계면은 소스 대조 |

## 1. 게이트 (기계 검증 — 직접 재실행)

| # | 항목 | 명령 | 판정 | 근거 |
|---|------|------|------|------|
| G1 | core 커버리지 threshold | `pnpm --filter @guksu/wvkit-core test -- --coverage` | **[PASS]** | exit 0 — threshold(camera-control 55/90, ptr 80/85, stable-input 85/75) 통과. 테스트 삭제 0건(diff에서 `it(`/`test(` 삭제 라인 grep 부재) |
| G2 | 전 패키지 단위 | `pnpm test` | **[PASS]** | exit 0 |
| G3 | e2e 4 프로젝트 | `pnpm test:e2e` | **[PASS]** | 최종 exit 0 — **242 passed / 14 skipped (1.3m)**. ※ 1차 실행에서 chromium stable-input 4건 실패했으나 이는 qa가 `pnpm test`(coverage 포함)를 e2e와 병렬로 돌린 자체 부하로 인한 행(테스트 1건이 10.4m 소요)으로 판정 — 격리 재실행(stable-input chromium 8/8 green, 2.5s) 및 부하 없는 풀 재실행 모두 exit 0. 이번 스프린트 미변경 스펙이며 결함 아님 |
| G4 | lint | `pnpm lint` | **[PASS]** | exit 0 |
| G5 | typecheck | `pnpm typecheck` | **[PASS]** | exit 0 (단, e2e 스펙 TS는 tsconfig 미커버 — dev-notes #7 기재대로 기존과 동일, B-25 후보) |

## 2. grep 가드 (전부 직접 실행)

| # | 항목 | 판정 | 근거 |
|---|------|------|------|
| GR1 | `waitForTimeout(` 소멸 (specs+fixtures) | **[PASS]** | `! grep` exit 0 |
| GR2 | `locator('select').first()` 소멸 | **[PASS]** | exit 0 — plan 미기재였던 `scroll-container.lifecycle.spec.ts:30`까지 교체됨(dev-notes #4) |
| GR3 | `input[type="checkbox"]` 셀렉터 소멸 | **[PASS]** | exit 0 |
| GR4 | 데모 `ctl-direction`/`ctl-enable-pinch-zoom` | **[PASS]** | `ScrollContainerDemo.tsx:146,174` 존재 |
| GR5 | 데모 `lock2-btn`/`scroll-spacer` | **[PASS]** | `ScrollLockDemo.tsx:63,72,81` 존재 |

## 3. 테스트 케이스 존재 검증

| # | 항목 | 판정 | 근거 |
|---|------|------|------|
| C1 | `TC-22-2` 타이틀 ≥3 | **[PASS]** | `--reporter=verbose \| grep -c` = **3** (TC-22-20/21/22) |
| C2 | `TC-24` 타이틀 ≥6 | **[PASS]** | `playwright --list \| grep -c` = **24** (6 케이스 × 4 프로젝트) |

## 4. 껍데기 판정 (T1 14건 + T2 6건 — diff 전수 정독)

전 20건 **[PASS]** — 모든 증강이 load-bearing (관측 가능한 부수효과 단언 추가, `not.toThrow()` 단독 케이스 소멸). 특기 사항:

- T1 #10 (`matrix-utils.test.ts`): `applyResistance(5,10,0,0.2)===10` 단언을 구현과 대조 — `matrix-utils.ts:41` `max<min → clamp(value,min,max)`, `clamp`(`:24-28`)는 `value<min` 분기 선평가로 10 반환. **정확값 일치**.
- T1 #5 (PTR setEnabled): 스파이 + pointer 시퀀스로 disabled 게이트를 unit 레벨에서 실검증 — 기존 테스트 미삭제 조건 충족.
- T2의 "전제 확인 단언" 패턴 우수 — vue safe-area(마운트 시 +1 확인 후 제거 단언), vue scroll-container(attach 확인 후 detach 단언), vue VK(unmount 전 계약 성립 확인 후 불변 단언)로 공허 단언 위험을 차단.
- 경미한 관찰(비차단): `stable-input.test.ts:420`의 hidden input 조회가 `document.body.querySelector('input[style]')` — 셀렉터가 구조 의존적이나 `document.activeElement` 동일성 단언이 오매칭을 자동 검출하므로 껍데기 아님.

## 5. T3 SafeArea 스텁 실검증 — 소스 대조

**[PASS]** — 스텁 계약이 `safe-area.ts:29-36` `readInsets`와 정확히 일치:
- TC-22-20: `paddingTop:'44px'` → `Number.parseFloat` 파싱·방향 매핑을 값으로 단언.
- TC-22-21: `''` → `parseFloat('')=NaN → || 0` 폴백 분기 실검증.
- TC-22-22: 스텁 값 변경 + `orientationchange`(구현 `:55` 등록 리스너) → onChange 재파싱 값 단언.
- 스텁은 `el !== sentinel` 원본 위임 + `afterEach vi.restoreAllMocks()` — 전역 오염 없음 (dev-notes 매핑과 일치).

## 6. 경계면 교차검증 (dev-notes §2 매핑 ↔ 소스)

| 경계면 | 판정 | 근거 |
|---|------|------|
| 데모 testid ↔ e2e 스펙 | **[PASS]** | `ctl-direction`/`ctl-enable-pinch-zoom`/`lock2-btn`/`unlock2-btn`/`lock2-status`(`data-locked` 패턴 동일)/`scroll-spacer` — 생산자(데모)와 소비자(스펙) 문자열 완전 일치. 탭 testid는 `main.tsx:12-19` TAB_IDS(`scroll-container`, `pull-to-refresh`, `virtual-keyboard`, `safe-area`)와 `tab-${id}`(`main.tsx:71`) 조합이 스펙의 `tab-pull-to-refresh` 등과 일치 |
| `waitForSceneStable` | **[PASS]** | fixture에서 export + `waitForScrollSettle` 내부 재사용으로 리팩토링, `__lastTf/__sameCount` 호출 후 리셋 유지. 소비자(gesture.spec S6·TC-24-05·TC-24-06) 사용 확인 |
| ScrollLock prev-복원 의미론 | **[PASS]** | `scroll-lock.ts:39-40`(prev 보관)·`:56-60`(prev 복원 + `scrollTo(0, scrollY)`) — TC-24-01(위치 복원, ±2px 오차 사유 타당)·TC-24-02(unlock2 후 hidden 유지 → unlock 후 `''`)가 구현 의미론을 정확히 고정. ref-count 전환 시 red가 되는 설계 의도 확인 |
| VirtualKeyboard 리스너 | **[PASS]** | `virtual-keyboard.ts:56-58`(vv에 resize+scroll 등록)·`:63-66`(destroy 전부 해제) — TC-24-03(scroll 단독 경로), TC-24-04(prototype 래핑 + 탭 진입 전 스냅샷 델타 비교로 타 vv 소비자 간섭 차단) 계약 일치 |
| 커버리지 threshold | **[PASS]** | 삭제 0건·증강만 — G1 exit 0 |
| 라이브러리 소스 불변 | **[PASS]** | `git status`상 packages/* 변경은 전부 `__tests__/` 하위 — plan "범위 제외" 준수, changeset 불필요 판단 타당 |

## 7. 미해결 아님·전달 사항 (FAIL 아님)

1. **pre-existing flake 2종 관찰** — (a) dev-notes #6의 `scroll-container.lifecycle.spec.ts:70`(S8, mobile-safari), (b) qa 1차 실행의 chromium stable-input 4건(병렬 부하 환경). 둘 다 부하 조건에서만 발생, 격리·재실행 green. e2e를 다른 무거운 작업과 병렬 실행하지 않는 운영 수칙 + 백로그(부하 내성) 후보로 리더 판단 권장.
2. e2e 스펙 TS의 typecheck 미커버(B-25 후보) — dev-notes #7과 동일 인식.
