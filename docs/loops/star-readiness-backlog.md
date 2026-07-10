# 루프: star-readiness 백로그 소진

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | 리더 세션 (quality-sprint 오케스트레이터) |
| 상태 | 실행 중 |
| 실행 수단 | Workflow 반복 (`.claude/workflows/star-readiness-sprint-loop.mjs`) |

## 1. 목표

`docs/campaign/star-readiness/backlog.md`의 미완료(⬜) 항목 0건 (전 항목 ✅ 완료 또는 ⏸ 보류) **그리고** 매 스프린트 종료 시 `pnpm test` + `pnpm typecheck` + `pnpm lint` (런타임 코드 변경 시 `pnpm test:e2e` 포함) 전부 exit 0.

## 2. 루프 설계 — 사용자 확인: 2026-07-10 확인됨 (AskUserQuestion 4건 승인)

| 요소 | 값 |
|------|-----|
| 트리거 | 사용자 요청 1회 ("백로그 소진까지 루프로 자율 진행") — 이후 각 반복은 이전 스프린트 종료 시 자동 |
| 실행 단위 | 1 반복 = 1 스프린트 = 백로그 미완료 상위 1~3건 (backlog.md의 스프린트 제안 순서 준수) → planner(plan.md) → implementer(TDD 구현) → qa(교차검증, 재작업 최대 2회) → verify(검증 명령 실행) → closer(백로그·기록 갱신) |
| 검증자 | verify 에이전트가 `pnpm test`·`pnpm typecheck`·`pnpm lint` 실행, exit code를 구조화 반환(자기평가 아님 — 종료 코드만). packages/·e2e/·examples/ 변경 스프린트는 `pnpm test:e2e` 추가. qa 에이전트(생성자와 분리)가 인수조건 PASS/FAIL 판정 |
| 종료 규칙 | 성공: ⬜ 0건 + 마지막 검증 그린 / 실패: 아래 안전장치 도달 시 중단·보고 |

**보류(⏸) 정책 (사용자 확인):** 기계 검증 불가·사용자 자산 필요 항목(B-14 GIF 캡처, B-19 실기기 자동화 등)과 QA 재작업 2회 초과 항목은 ⏸ + 사유 기록 후 스킵, 종료 보고서에 목록화. B-03 방향은 `@guksu/wvkit-*` 기준 통일로 확정.

**git 정책 (2026-07-10 사용자 지시로 갱신):** 스프린트마다 `sprint/{slug}` 브랜치를 파고, 그린 종료 시 커밋·푸시 후 `gh pr create --base main`으로 PR 생성 (에이전트 수행 권한 부여됨 — 기존 "승인 기반"의 캠페인 한정 상설 승인). PR은 이전 스프린트 브랜치 위에 스택되므로 순서대로 머지. force push·rebase·merge·브랜치 삭제는 계속 금지. gh 미인증 시 커밋·푸시까지만 하고 compare URL 기록.

## 3. 안전장치

| 장치 | 값 |
|------|-----|
| 최대 반복 | 12 스프린트 |
| 토큰 예산 | Workflow 에이전트 수 상한으로 대체 강제: 스프린트당 최대 8 에이전트 × 12 = 96 (Workflow 런타임의 1000 에이전트 상한 내). 사용자가 "+Nk" 지시어를 주지 않아 `budget.total` 기반 하드 토큰 게이트는 비활성 — 초과 징후(스프린트당 재작업 반복) 시 막힘 판정이 선행 차단 |
| 막힘 판정 | 검증(그린) 실패가 2 스프린트 연속 → 전체 중단·보고. 스프린트 내 QA 재작업 2회 초과 → 해당 항목 ⏸ 후 계속. 그린 복구 불가 시 implementer가 자기 변경을 파일 편집으로 롤백해 그린 상태 복구 |

## 4. 실행 기록

| 반복 | 결과 | 비고 |
|------|------|------|
| (Sprint 1) | 통과 — B-01/B-07/B-20/B-26 | 루프 시작 전 수동 실행분 (기준선) |
| 2 | 실패 — B-05(CameraControl 핵심 수식 단위 검증 — 엣지저항·속도기반 스냅 방향·핀치 줌+앵커 보정·다지 승계 (branch 56.5%)), B-06(StableInput suppressLayoutShift/scrollAnchor 단위 검증 — 레이아웃 억제 로직 0% 커버 (stable-input.ts:127-144)) | qa PASS · 재작업 0회 |
| 3 | 실패 — B-03(패키지명 불일치 일괄 정정 — 문서 12파일 @wvkit/* import + README 배지 + CLAUDE.md 네이밍 규칙 + tsup external → 실배포명 @guksu/wvkit-*로 통일 (사용자 확정)), B-11(WebviewHeadlessError 값 export — 타입 전용이라 instanceof catch 불가 (core/src/index.ts:1)), B-12(three peer 범위 완화 — ^0.184.0 → 하한 범위(실측 후), @types/three 동반 조정) | qa PASS · 재작업 0회 |
| (트리아지) | 리더 조사: 반복 2·3의 실패는 둘 다 scroll-container.api.spec의 **webkit 한정 settle 5s 타임아웃** — 단독 실행 4회 반복 28/28 통과 → 풀 스위트 병렬 부하 flake로 판정. 수정: settle timeout 5s→15s + verify `--retries=2`(CI 패리티) + 스크립트 args 파싱 결함(slug `undefined-` 오염) 수정. 수정 후 전체 재검증 그린(test/typecheck/lint/build 0 · e2e 186 passed) → Sprint 2·3 소급 그린, 스프린트별 분리 커밋·PR 출하 | 1차 run 중단은 안전장치 정상 동작. 2차 run은 Sprint 4부터 재개 |
| 4 | 그린 — B-02(three 정적 로드 제거 — CJS require('three') 무가드 크래시 → 동적 import 지연 로드 또는 subpath export 분리), B-13(destroy 후 scrollTo/zoomTo 가드 추가 + 해당 껍데기 단언을 명시적 단언으로 강화) | qa PASS · 재작업 0회 |
| 5 | 그린 — B-08(PTR TouchEvent 경로 + activeSource 소스 승계 단위 테스트 (pull-to-refresh.ts:216-273 미커버)), B-10(e2e 골든 시나리오 — 대각 스크롤 방지, suppressLayoutShift(VP resize 중 위치 불변), orientation 후 inset 재측정, touch+합성 pointer 이중처리 1회 발화) | qa PASS · 재작업 0회 |

## 5. 종료 보고

(1차 run: 안전장치 중단 — 위 트리아지 참조. 2차 run 실행 중 — 종료 시 기입)
