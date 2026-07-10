# dev-notes — trust-fixes (implementer)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 입력 | plan.md (같은 폴더) |
| 브랜치 | sprint/20260710-trust-fixes |

## 변경 파일

### T-01 (B-03) — 패키지명 통일
- `docs/components/{scroll-container,stable-input,virtual-keyboard,safe-area,scroll-lock,pull-to-refresh}/index.md` + `index.ko.md` (12파일): `@wvkit/{core,react,vue}` → `@guksu/wvkit-{core,react,vue}` (sed 일괄)
- `README.md`, `README.ko.md`: 배지 라벨 `label=%40wvkit%2F*` → `label=%40guksu%2Fwvkit-*` (링크 URL은 기존에 이미 실배포명)
- `CLAUDE.md`: 네이밍 표·blockquote 지시문·모든 import/커맨드 샘플 실배포명으로 정정 + 스코프 배경 1줄 부기.
  - **주의**: 부기 문구는 AC-1(`grep '@wvkit/'` 잔존 0)과 충돌하지 않도록 슬래시 없는 `` `@wvkit` 스코프 `` 표기 사용.
  - **주의**: CLAUDE.md는 이 리포에서 **gitignore 대상**(git check-ignore 확인) — 디스크 파일만 갱신되며 diff에 안 보임. QA는 파일 내용으로 검증할 것.
- `packages/react/tsup.config.ts:10`, `packages/vue/tsup.config.ts:10`: external `'@wvkit/core'` → `'@guksu/wvkit-core'`
- 치환 금지 항목 준수: `e2e/playwright.config.ts`의 `@wvkit/react-example`(예제 실제 name), `docs/worklog/*`·`docs/qa/*`·CHANGELOG의 역사 기록은 미변경.

### T-02 (B-11) — WebviewHeadlessError 값 export (TDD)
- 신규 테스트 (Red 확인 후 구현 → Green):
  - `packages/core/src/__tests__/public-api.test.ts` (TC-5/6/7)
  - `packages/react/src/__tests__/public-api.test.ts` (TC-8)
  - `packages/vue/src/__tests__/public-api.test.ts` (TC-9)
- 구현:
  - `packages/core/src/index.ts:1`: `export type` → `export` (값 export)
  - `packages/react/src/index.ts`: `export { WebviewHeadlessError } from '@guksu/wvkit-core';` 추가
  - `packages/vue/src/index.ts`: 동일 추가
- **주의**: react/vue 테스트는 workspace 링크로 core **dist**를 resolve하므로 core 재빌드 후에만 green (Red→Green 전환 시 확인). CI에서는 turbo가 build 의존성을 처리.

### T-03 (B-12) — three peer 완화
- `packages/core/package.json`: `peerDependencies.three` `^0.184.0` → `>=0.160.0` (optional 유지, devDeps는 `^0.184.0` 원복)
- 실측 기록: `three-floor-matrix.md` (같은 폴더) — 0.160.0에서 typecheck/build/test 전부 exit 0, 첫 후보 성립으로 즉시 채택.
- `pnpm-lock.yaml`: 실측 install이 남긴 transitive 잔재(fflate 0.8.2→0.8.3)를 수동 원복 → **최종 diff 0** (`git diff --stat -- pnpm-lock.yaml` 빈 출력).

### T-04 — changeset
- `.changeset/20260710-trust-fixes.md`: core/react/vue 3패키지 **minor** + 한 줄 요약.

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 생산자 | 소비자 | 검증 포인트 |
|--------|--------|-------------|
| docs/components 12파일 + README ×2 설치·import 샘플 | 신규 사용자 복붙 | 모든 참조가 `@guksu/wvkit-*` (AC-1·2) |
| CLAUDE.md 네이밍 섹션 | 이후 에이전트·문서 편집 | 지시문 = packages/*/package.json name 필드와 일치 (단, gitignored — 파일 내용으로 검증) |
| packages/{react,vue}/tsup.config.ts external | react/vue dist → 소비자 번들러 | dist에 `@guksu/wvkit-core` import 유지·core 인라인 없음 (AC-4) |
| core 배럴 값 export → dist ESM/CJS | react/vue 배럴 재노출 → 앱 `instanceof` catch | TC-5~9 + AC-10/11 (core 내부 throw와 배럴 클래스 동일성은 TC-7) |
| core peerDependencies.three | 호스트 앱 패키지 매니저 | `>=0.160.0` = 매트릭스 실측과 정합 (AC-12·13), 현행 0.184 green (AC-14) |

## 실행한 검증 명령과 결과

- Red: 신규 3개 테스트 파일 실패 확인(core 2 failed / react·vue 각 1 failed) → 구현 → Green.
- AC 일괄 배터리 (2026-07-10): AC-1~AC-16 (AC-3 포함) **전부 exit 0**.
  - AC-3은 `pnpm build` exit 0, TC-5~9는 `--reporter=verbose` grep(FIXED 타이틀 문자열)로 확인.
- 최종 게이트: `pnpm lint && pnpm typecheck && pnpm build && pnpm test` → `lint=0 typecheck=0 build=0 test=0`.
- 테스트 수: core 228 passed(12파일), react 26 passed(7파일), vue 25 passed(7파일).

## 트레이드오프 / 남긴 것

- AC-10/11 dist 스모크는 리포 내 three devDep 설치 상태 전제(B-02 three 정적 로드 — Sprint 4 범위)로만 통과.
- three 하한은 감사 제안 첫 후보(0.160.0)가 통과해 더 낮은 하한 탐색은 하지 않음(plan 절차대로 하향 탐색은 범위 아님).
- git status에 보이는 다른 변경(backlog.md, stable-input 테스트, vitest.config, camera-control gestures 테스트 등)은 **이전 스프린트의 미커밋 산출물**이며 본 스프린트 변경 아님.
