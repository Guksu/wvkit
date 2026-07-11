# Sprint 10 test-hardening QA 교차검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-test-hardening/qa-report.md, e2e/, packages/*/src/**/__tests__/, examples/react-example/src/ |

## 1. 개요

Sprint 10(B-22 껍데기 단언 정리 + B-23 e2e 안정화 + B-24 e2e 잔여 커버)의 구현 결과를 구현자와 분리된 시선으로 검증했다. plan.md 인수조건 전 항목을 직접 재실행(exit code)하고, dev-notes.md의 생산자↔소비자 경계면을 소스 대조했으며, 신규·증강 테스트 diff를 전수 정독해 껍데기 여부를 판정했다.

## 2. 작업내용

- 게이트 5종 직접 재실행 — core coverage / pnpm test / test:e2e / lint / typecheck 전부 exit 0. e2e 1차 실행은 4건 실패였으나 qa 자신이 `pnpm test`를 병렬로 돌린 부하로 인한 행(1건 10.4m)으로 판정 — 격리 재실행 + 단독 풀 재실행(242 passed / 14 skipped) green.
- grep 가드 5종 + 타이틀 카운트 2종(TC-22-2=3, TC-24=24) 직접 실행 — 전부 통과.
- diff 전수 정독(25 파일, +507/-46) — T1 14건·T2 6건 증강 전부 load-bearing 확인, 테스트 삭제 0건.
- 소스 대조 — `matrix-utils.ts` clamp 분기 순서와 `applyResistance(5,10,0,0.2)===10` 일치, `safe-area.ts readInsets` 파싱·폴백 계약, `scroll-lock.ts` prev-복원 의미론, `virtual-keyboard.ts` resize+scroll 리스너, 데모 testid ↔ 스펙 문자열, `main.tsx` TAB_IDS.
- 산출물: `qa-report.md` 작성 — **전 항목 PASS, FAIL 0**.

## 3. 주의사항

- e2e는 무거운 작업(vitest coverage 등)과 병렬 실행 시 chromium에서도 행/타임아웃 flake 발생 — 운영 수칙 및 부하 내성 백로그 후보로 리더 판단 필요 (dev-notes #6의 mobile-safari S8 flake와 동일 계열).
- e2e 스펙 TS는 `pnpm typecheck` 미커버(기존과 동일) — B-25에서 정리 권장.
- 라이브러리 소스 무변경이므로 changeset 불필요 판단은 타당.
