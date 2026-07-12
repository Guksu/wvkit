# star-readiness 백로그

> 감사 4종(audit-unit-tests / audit-e2e / audit-docs-dx / audit-code-ci, 2026-07-10) 종합.
> 방침: **테스트 신뢰성 최우선** (사용자 지정). 상태: ⬜ 대기 · 🔄 진행 · ✅ 완료 · ⏸ 보류

## P0 — 신뢰를 직접 깨는 것

| ID | 항목 | 규모 | 근거 | 상태 |
|----|------|------|------|------|
| B-01 | CI에 e2e 잡 추가 — chromium+webkit 설치 → `pnpm test:e2e`, PR 게이트 승격, trace/report 아티팩트 업로드 | M | audit-e2e P0, audit-code P1, audit-docs P2 (3중 지적) | ✅ Sprint 1 |
| B-02 | three 정적 로드 제거 — CJS `require('three')` 무가드로 three 없는 소비자 크래시. 동적 import 지연 로드 또는 subpath export 분리 | L | audit-code P0 (`dist/index.cjs:3`) | ✅ Sprint 4 |
| B-03 | 패키지명 불일치 일괄 정정 — 문서 12파일 `@wvkit/*` import(복붙 시 npm 404) + README 배지 라벨 + CLAUDE.md 네이밍 규칙 + tsup external 오기 → 실배포명 `@guksu/wvkit-*`로 통일 | M | audit-docs P0-2·P1·P2, audit-code P1 | ✅ Sprint 3 |
| B-04 | 문서 사이트 실물화 — VitePress 문법을 쓰는 고아 마크다운 12파일. VitePress 스캐폴드+i18n+배포 잡 추가 (또는 순수 GFM 다운그레이드 결정) | L | audit-docs P0-1 | ✅ Sprint 7 |
| B-05 | CameraControl 핵심 수식 단위 검증 — 엣지저항·속도기반 스냅 방향·핀치 줌+앵커 보정·다지 승계 (branch 56.5%) | M | audit-unit P0 | ✅ Sprint 2 |
| B-06 | StableInput `suppressLayoutShift`/`scrollAnchor` 단위 검증 — 존재 이유인 레이아웃 억제 로직 0% 커버 (`stable-input.ts:127-144`) | M | audit-unit P0 | ✅ Sprint 2 |
| B-07 | 한글 IME 조합 Enter 가드 테스트 — `isComposing || keyCode===229` 시 `onSubmit` 미발화 검증 (`stable-input.ts:119`) | S | audit-unit P0 | ✅ Sprint 1 |

## P1 — 품질·전환율 직결

| ID | 항목 | 규모 | 근거 | 상태 |
|----|------|------|------|------|
| B-08 | PTR TouchEvent 경로 + `activeSource` 소스 승계 단위 테스트 (`pull-to-refresh.ts:216-273` 미커버) | M | audit-unit P1 | ✅ Sprint 5 |
| B-09 | 어댑터 테스트 실질화 — StrictMode 이중 마운트, rerender 시 options 반영, destroy 실효(리스너 제거) 단언 | M | audit-unit P1 | ✅ Sprint 6 |
| B-10 | e2e 골든 시나리오 — 대각 스크롤 방지, suppressLayoutShift(VP resize 중 위치 불변), orientation 후 inset 재측정, touch+합성 pointer 이중처리 1회 발화 | M | audit-e2e P1 ×3 | ✅ Sprint 5 |
| B-11 | `WebviewHeadlessError` 값 export — 현재 타입 전용이라 `instanceof` catch 불가 (`core/src/index.ts:1`) | S | audit-code P1 | ✅ Sprint 3 |
| B-12 | three peer 범위 완화 — `^0.184.0` → 하한 범위(실측 후), @types/three 동반 조정 | S | audit-code P1 | ✅ Sprint 3 |
| B-13 | destroy 후 `scrollTo`/`zoomTo` 가드 + 해당 껍데기 단언을 명시적 단언으로 강화 (`scroll-container.ts:220-243`) | S | audit-unit P1 | ✅ Sprint 4 |
| B-14a | README 히어로 GIF 3~4종 (현재 GIF 0) | M | audit-docs P1 | ⏸ 보류(실기기·데모 화면 캡처 장비 필요 — 에이전트 단독 수행 불가) |
| B-14b | README Documentation 링크 섹션 (현재 문서 진입로 0) — B-14에서 실행 가능 부분 분리 | S | audit-docs P1 | ✅ Sprint 6 |
| B-15 | 커뮤니티 헬스 파일 — CONTRIBUTING(빌드/테스트/changeset 흐름, TESTING.md 링크) + 이슈 템플릿 2종 + PR 템플릿 | S | audit-docs P1·P2 | ✅ Sprint 6 |
| B-16 | Vue 데모 배포(서브패스) + StackBlitz/CodeSandbox 링크 | M | audit-docs P1 | ✅ Sprint 9 |
| B-17 | 잔여 단위 공백 — CameraControl `animated` 트윈(RAF), VirtualKeyboard 회전 baseHeight 리셋, ScrollContainer ResizeObserver 보정 | M | audit-unit P1 ×3 | ✅ Sprint 8 |
| B-18 | PTR e2e 잔여 계약 — setEnabled(false) 무시, onRefresh reject 복구, maxDistance cap, scrollTop>0 거절, overscroll-behavior 적용/opt-out | S | audit-e2e P1 | ✅ Sprint 8 |
| B-19 | WKWebView 실기기 자동화 — Maestro/Detox로 시뮬레이터 스모크 1~2건(nightly). 단기: README에 "webkit ≠ WKWebView" 한계 명시 | L | audit-e2e P1 | ⏸ 보류(iOS 시뮬레이터·실기기 자동화 장비 필요 — 에이전트 단독 수행 불가) |

## P2 — 회귀 방지·정리

| ID | 항목 | 규모 | 근거 | 상태 |
|----|------|------|------|------|
| B-20 | 커버리지 threshold 도입 — 핵심 3파일(camera-control/pull-to-refresh/stable-input) branch/func 하한 | S | audit-unit P2 | ✅ Sprint 1 |
| B-21 | CI에 publint + @arethetypeswrong/cli 스텝 | S | audit-docs P2 | ✅ Sprint 9 |
| B-22 | 껍데기 단언 정리 — `not.toThrow()`-only 테스트에 관측 가능한 부수효과 단언 추가, SafeArea 인셋 파싱 스텁 검증 | M | audit-unit P2 ×2 | ⬜ |
| B-23 | e2e 안정화 — `waitForTimeout` → `expect.poll`, 데모 `data-testid` 부여 후 위치 의존 셀렉터 교체 | S | audit-e2e P2 ×2 | ⬜ |
| B-24 | e2e 잔여 커버 — ScrollLock(위치 복원·중첩), VirtualKeyboard(scroll 경로·리스너 해제), `both` 폴백, 줌 상태 pan | S | audit-e2e P2 ×3 | ⬜ |
| B-25 | 어댑터·설정 정리 — non-callback prop 미반영 문서화(특히 `panels`), react-dom peer 제거, biome 무효 억제 정리, deploy-demo `paths:` 필터, ScrollLock scrollY 주석 명확화, StableInput 옵션 검증 | M | audit-code P2 ×6 | ⬜ |
| B-26 | 사전 존재 lint red 13건 정리 — `pnpm lint`가 e2e/·examples/·packages/react 기존 코드에서 exit 1 (noDefaultExport, noNonNullAssertion 등). CI lint 게이트가 사실상 무력화된 상태 | S | Sprint 1 QA 발견 (qa-report.md 미해결 2) | ✅ Sprint 1 편입 |

## 스프린트 제안 순서

1. **Sprint 1 — 테스트 게이트**: B-01 + B-07 + B-20 (CI가 e2e·커버리지를 지키게 만드는 것이 모든 후속 작업의 전제)
2. **Sprint 2 — 핵심 동작 단위검증**: B-05 + B-06
3. **Sprint 3 — 신뢰 붕괴 수정**: B-03 + B-11 + B-12
4. **Sprint 4 — three 분리**: B-02 (+ B-13)
5. **Sprint 5 — 터치 계약**: B-08 + B-10
6. 이후: B-09 → B-14/B-15 → B-04 → 나머지 P1/P2, B-19는 장기(nightly)
