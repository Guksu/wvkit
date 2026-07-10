# Sprint 3 (trust-fixes) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-trust-fixes/plan.md |

## 1. 개요

star-readiness 백로그 Sprint 3 대상인 B-03(패키지명 `@wvkit/*` → `@guksu/wvkit-*` 일괄 정정, 사용자 확정), B-11(`WebviewHeadlessError` 값 export), B-12(three peer 범위 하한 완화)를 구현 가능한 계획으로 분해했다. 근거는 audit-docs-dx.md P0-2·P1·P2, audit-code-ci.md P1 3건을 원문 확인했다.

## 2. 작업내용

- `docs/campaign/star-readiness/sprints/20260710-trust-fixes/plan.md` 신규 작성 — 태스크 4건(T-01 패키지명 통일 / T-02 에러 값 export TDD / T-03 three 하한 실측·완화 / T-04 changeset), 기계 검증 인수조건 16건(명령+기대 exit code) + 최종 게이트 1건.
- 계획 전 리포 실측: 구명칭 잔존 위치 grep(문서 12파일 64개소, README 배지 라벨 `%40wvkit%2F*`, CLAUDE.md, react/vue tsup external), `core/src/index.ts:1`의 `export type` 확인, `pull-to-refresh.ts:374`의 throw 지점을 TC-7 입력으로 지정, three 사용 표면(`scroll-container.ts:1-2`만 값 import) 확인.
- B-12는 실측 절차를 계획에 내장 — devDep 임시 교체 매트릭스(0.160.0부터 상향) 결과를 `three-floor-matrix.md`로 기록하고 채택 하한을 peer에 반영, devDep은 현행 원복.

## 3. 주의사항

- `e2e/playwright.config.ts:42`의 `@wvkit/react-example`은 예제 패키지의 실제 name과 일치하는 유효 참조 — **치환 금지** (plan T-01 주의 및 범위 제외에 명시). 예제 리네이밍은 B-25 편입 제안.
- AC-10/11(dist 스모크)은 B-02(three 정적 로드) 미해결 상태라 리포 루트(three devDep 설치)에서만 통과 — Sprint 4 전제.
- TC-5~TC-9의 테스트 타이틀 문자열은 인수조건 grep 대상이므로 구현 시 변경 금지. vitest 검증은 `--reporter=verbose` 필수.
- T-03의 pnpm add/install이 `pnpm-lock.yaml`을 건드림 — 최종 diff에서 lockfile 원복 여부를 QA가 확인해야 함.
