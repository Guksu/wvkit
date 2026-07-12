# Sprint 9 (demo-deploy-publint) QA 교차검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-demo-deploy-publint/qa-report.md, examples/sandboxes/, packages/*/package.json, .github/workflows/{ci,deploy-demo}.yml |

## 1. 개요

Sprint 9(B-16 Vue 데모 배포·제로설치 링크 + B-21 publint/attw 출하 게이트)의 구현 결과를 implementer와 분리된 시선으로 교차검증했다. plan.md의 AC-01~AC-11 전부를 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면을 소스·published d.ts 대조로 검증했다.

## 2. 작업내용

- AC-01~AC-11 전부 직접 재실행 — **11/11 exit 0 (전 항목 PASS, FAIL 0건)**. 상세는 qa-report.md.
- exports 맵 6엔트리(core/react/vue × `.`/`./scroll-container`) JSON 덤프 대조 — 완전 동일 구조(require.types=`.d.cts`), attw node16 전 셀 🟢·node10 명시적 ignore 확인.
- 샌드박스 소비자 shape을 설치된 published `@guksu/wvkit-{react,vue}@0.3.1` d.ts와 직접 대조 — usePullToRefresh/useStableInput/StableInputDisplay 필드명·타입 일치.
- 추가 심화 검증: 스크래치패드에 node_modules·lockfile 없는 사본을 만들어 완전 프레시 npm install+build 재현(StackBlitz 시나리오 등가) — react/vue 양쪽 exit 0.
- `workspace:` 문자열 부재(exit 1)·registry resolved 0.3.1 확인, README EN/KO 링크 4종 = 디렉토리 경로 문자열 일치.
- plan 대비 편차 3건(샌드박스 three dep, biome .vue override, grep 명령 보정) 모두 타당성 검토 후 수용.
- 신규 단위 테스트 없음(인프라 스프린트) — 껍데기 판정 대상 부재. 게이트의 load-bearing은 dev-notes RED 증빙(T-05 이전 publint·attw exit 1)으로 성립.
- 산출: qa-report.md 작성 (코드 수정 없음, git 변경 명령 없음).

## 3. 주의사항

- 머지 후 수동 QA 필요: Pages `/wvkit/vue/` 실서빙 + StackBlitz/CodeSandbox 4링크 실부팅 (머지 전 404 정상).
- 후속 백로그 후보: 0.3.2 publish 후 샌드박스 `three` dependency 제거.
- AC-08(attw) 검증 시 파이프 금지 유지 — exit code 삼킴 주의 (plan 명시 사항, 준수함).
