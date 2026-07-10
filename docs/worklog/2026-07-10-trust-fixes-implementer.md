# Sprint 3 trust-fixes 구현 (B-03 + B-11 + B-12)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 관련 경로 | packages/{core,react,vue}/src/index.ts, packages/{react,vue}/tsup.config.ts, packages/core/package.json, docs/components/, README*.md, CLAUDE.md, .changeset/20260710-trust-fixes.md, docs/campaign/star-readiness/sprints/20260710-trust-fixes/ |

## 1. 개요

npm에서 wvkit을 발견한 사용자의 첫 5분 신뢰 복구 스프린트. 문서·배지·CLAUDE.md·tsup 설정에 남은 구명칭 `@wvkit`(스코프 미확보로 폐기)을 실배포명 `@guksu/wvkit-*`로 통일하고(B-03), `WebviewHeadlessError`를 값으로 export해 `instanceof` 식별을 가능하게 하고(B-11), `three` peer 범위를 실측 하한 `>=0.160.0`으로 완화했다(B-12).

## 2. 작업내용

- **B-03 패키지명 통일**: docs/components 12파일 + README×2 배지 라벨(`%40guksu%2Fwvkit-*`) + CLAUDE.md(네이밍 표·지시문·샘플 정정, 스코프 배경 부기) + react/vue tsup external 오기 수정. `@wvkit/react-example`(e2e 유효 참조)과 역사 기록(worklog/qa/CHANGELOG)은 계획대로 미치환.
- **B-11 값 export (TDD)**: `packages/{core,react,vue}/src/__tests__/public-api.test.ts` 신규(TC-5~9, Red 확인 후 구현). `core/src/index.ts` `export type`→`export`, react/vue 배럴에 재노출 추가. dist ESM/CJS 스모크(AC-10/11) 통과.
- **B-12 three peer 완화**: 후보 0.160.0 실측(typecheck/build/test 전부 exit 0, `sprints/20260710-trust-fixes/three-floor-matrix.md`에 기록) → `peerDependencies.three: ">=0.160.0"` 반영, devDeps `^0.184.0` 원복, pnpm-lock.yaml transitive 잔재(fflate)까지 원복해 lockfile diff 0.
- **changeset**: `.changeset/20260710-trust-fixes.md` — 3패키지 minor.
- **검증**: AC-1~AC-16 전부 exit 0 + 최종 게이트 `pnpm lint/typecheck/build/test` 전부 exit 0. 상세는 `sprints/20260710-trust-fixes/dev-notes.md`.

## 3. 주의사항

- CLAUDE.md는 이 리포에서 gitignore 대상 — 정정 내용이 git diff에 보이지 않으므로 파일 내용으로 확인해야 한다.
- react/vue 단위 테스트는 core dist를 resolve하므로 core 미빌드 상태에서는 public-api 테스트가 실패한다(빌드 선행 필요).
- AC-10/11 dist 스모크는 three devDep 설치 환경 전제(B-02 three 정적 로드 제거는 Sprint 4).
- 예제 패키지 리네이밍(`@wvkit/{react,vue}-example`)은 범위 제외 — B-25 편입 제안 상태.
