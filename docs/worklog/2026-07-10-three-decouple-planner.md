# Sprint 4 (three-decouple) 계획 수립

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-three-decouple/plan.md |

## 1. 개요

star-readiness 캠페인 Sprint 4 계획. 백로그 B-02(three 정적 로드 제거 — CJS `require('three')` 무가드로 three 미설치 소비자 크래시, audit-code P0)와 B-13(destroy 후 `scrollTo`/`zoomTo` 가드 + 껍데기 단언 강화, audit-unit P1)을 TDD 전제의 구현 가능한 태스크로 분해했다.

## 2. 작업내용

- `docs/campaign/star-readiness/sprints/20260710-three-decouple/plan.md` 신규 작성 — 태스크 4건(T-01 검증 스크립트 선작성 / T-02 core subpath 분리 / T-03 어댑터·데모·문서·changeset 이행 / T-04 destroyed 가드), 인수조건 14건(AC-1~AC-14, red 게이트 AC-1a·AC-13a 포함, 전부 명령 + 기대 exit code).
- **설계 결정**: B-02는 동적 import 대신 **subpath export 분리**(`@guksu/wvkit-{core,react,vue}/scroll-container`) 채택 — `create*` 동기 팩토리 컨벤션 유지, 기존 동기 단위 테스트 무변경, CJS/ESM 양쪽 결정적 해소. 배럴에는 ScrollContainer 타입만 type-only 잔존.
- 근거 확인: audit-code-ci.md :18(P0)/:26(P1), audit-unit-tests.md :33(P1), 소스(`scroll-container.ts:1-2, 220-243, 249-277`), 껍데기 테스트(`scroll-container.test.ts` "subsequent scrollTo/zoomTo after destroy are silent"), tsup/exports/vitest 설정, react-example·e2e 소비 지점(vue-example은 ScrollContainer 미사용).

## 3. 주의사항

- **breaking 승인 선행**: subpath 이동은 공개 API breaking(3패키지 minor + changeset). CLAUDE.md import 샘플도 바뀌므로 리더/사용자 승인 후 T-02 착수 — plan.md "설계 결정" 절에 명시. 반려 시 동적 import 안으로 재기획 필요.
- 어댑터 단위 테스트는 코어 dist exports 서브패스를 경유하므로 코어 빌드 선행(AC-7 순서). 격리 런타임 스모크(scripts/verify-three-decouple.mjs)가 grep보다 정본 판정 — ESM 청크 분할 전이 참조 대비.
- 신규 exports 서브패스가 생기므로 B-21(publint/attw) 우선순위 상향을 리더에게 제안함.
