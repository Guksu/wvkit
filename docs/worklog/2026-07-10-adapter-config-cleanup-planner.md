# Sprint 11 (adapter-config-cleanup) 계획 수립 — B-25

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-adapter-config-cleanup/plan.md, docs/campaign/star-readiness/audit-code-ci.md(P2 ×6), packages/react/package.json, packages/core/src/components/{stable-input,scroll-lock}, .github/workflows/deploy-demo.yml |

## 1. 개요

star-readiness 백로그 B-25(어댑터·설정 정리, audit-code-ci P2 6건)를 스프린트 계획으로 분해했다. 6개 하위 항목(non-callback prop 미반영 문서화 / react-dom peer 제거 / biome 무효 억제 정리 / deploy-demo paths 필터 / ScrollLock scrollY 주석 명확화 / StableInput 옵션 검증)을 태스크 7건 + 기계 검증 인수조건 22건(명령 + 기대 exit code)으로 정의했다.

## 2. 작업내용

- `docs/campaign/star-readiness/sprints/20260710-adapter-config-cleanup/plan.md` 신규 작성 — 목표 / 태스크 T-01~T-07 / 인수조건 AC-01~22 / 경계면 매핑 / 범위 제외.
- 감사 시점(2026-07-10) 대비 현재 코드 상태 실측 후 계획에 반영:
  - biome 억제 주석은 감사가 지적한 3곳이 아닌 2곳 잔존(react의 scroll-lock:14, virtual-keyboard:14)이며 `pnpm exec biome lint packages`는 현재 경고 0·exit 0 → T-03을 "정리"에서 "유효성 검증 + 회귀 가드"로 조정(억제 임시 제거로 load-bearing 여부 판정).
  - tsup external 오기(B-03)·WebviewHeadlessError 값 export(B-11)는 기 해소 확인 — T-06 테스트가 instanceof 단언 가능함을 명시.
- 핵심 설계 결정:
  - T-01: panels 미반영은 문서화 + **핀 테스트**(renderer domElement 참조 동일성으로 "재생성 없음"을 관측 단언 — mock 불필요, 기존 B-09 테스트 인프라 재사용).
  - T-04: `docs/**` 전체가 아닌 사이트 빌드 입력 경로만 paths에 나열(워크로그·캠페인 문서 push로 재배포 방지) + 수동 재배포용 `workflow_dispatch` 동반 추가.
  - T-06: validateOptions는 SSR 가드 **직후** 호출(HTMLElement 전역이 SSR에 없음), 검증 throw는 동작 변경이므로 core changeset **minor** 지정. stable-input 커버리지 threshold(85/75) 하한 방지를 위해 유효/무효 분기 전수 커버 지시.

## 3. 주의사항

- T-03은 실측상 이미 해소됐을 가능성이 높음 — 구현자는 판정 근거(억제 제거 시 diagnostic 발생 여부)를 워크로그에 남기고, 무효로 판명된 억제만 삭제할 것.
- T-06의 throw 추가는 어댑터(useStableInput) 경유 시 effect/onMounted 내부에서 발생 — 기존 어댑터 테스트는 정상 옵션만 사용하므로 영향 없어야 하며, 깨지면 계획 오류로 리더에게 보고.
- AC의 vitest 타이틀 grep은 반드시 `--reporter=verbose`(non-TTY에서 기본 리포터는 통과 타이틀 미출력 — Sprint 1 교훈).
- AC-09는 기대 exit **1**(grep 무매치 = 경고 없음)임에 주의.
- 워크로그 파일명은 공통 컨텍스트 지정(2026-07-10-{slug}-{역할})을 따랐으나 실제 작성일은 2026-07-11.
