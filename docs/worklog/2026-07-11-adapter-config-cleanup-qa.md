# Sprint 11 (adapter-config-cleanup, B-25) QA 교차검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-adapter-config-cleanup/qa-report.md, packages/core/src/components/{stable-input,scroll-lock}/, packages/{react,vue}/src/components/scroll-container/, packages/react/package.json, .github/workflows/deploy-demo.yml, .changeset/20260710-adapter-config-cleanup-*.md |

## 1. 개요

Sprint 11(B-25 어댑터·설정 정리)의 구현 결과를 구현자와 분리된 시선으로 검증했다. plan.md의 인수조건 AC-01~AC-22 전 항목을 리포 루트에서 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면 매핑을 소스 대조로 교차검증했으며, 신규 테스트 5건(R1/V1/L1/S1/S2)의 껍데기 여부를 판정했다.

## 2. 작업내용

- AC-01~AC-22 전부 직접 재실행 → **22/22 PASS, FAIL 0건**. 상세는 `docs/campaign/star-readiness/sprints/20260710-adapter-config-cleanup/qa-report.md`.
  - 테스트 게이트: core 271 / react·vue 스위트 전부 green, `--reporter=verbose` grep으로 신규 테스트 5건 통과 타이틀 확인.
  - AC-09는 기대대로 grep exit 1(suppression 경고 0건), AC-22는 threshold가 `--coverage` 시에만 평가되므로 `vitest run --coverage`를 별도 실행해 stable-input branches 93.33(≥90)/functions 86.66(≥85) 하한 유지를 재실측.
- 경계면 교차검증: validateOptions 호출 위치가 SSR 가드 직후임을 소스로 확인(SSR noop 계약 유지), WebviewHeadlessError 값 import(instanceof 가능), react/vue useStableInput 어댑터 무변경(정상 옵션 테스트 green), deploy-demo paths가 사이트 compose 입력(examples/*/dist, docs/.vitepress/dist)의 소스 경로를 전부 포함함을 docs/ 실측 ls로 대조, 문서 marker(EN/KO 4파일 + JSDoc 2파일)와 R1/V1 핀 테스트가 동일 계약을 서술함을 확인.
- 껍데기 테스트 판정: 5건 모두 load-bearing(구체 값·에러 타입·관측 가능한 부수효과 단언). V1은 비반응성 객체 mutate 방식이라 상대적으로 약하나 plan 지정 방식 준수.
- changeset 2건 semver 대조: core minor(throw 동작 변경 명시) / react patch — plan 지정과 일치.

## 3. 주의사항

- 코드 수정 0건(QA 원칙) — 잔여 수정 요청 없음. 스프린트 게이트 통과 상태로 리더 판단(머지·커밋)만 남음. 커밋·푸시는 사용자 전담.
- 비차단 관찰 2건을 qa-report에 기록: (1) Vue V1 핀은 reactive props 경유 시나리오가 더 강한 단언이 됨(후속 참고), (2) plan의 AC-12 `grep -vq`는 약한 단언이므로 향후 `! grep -q` 형태 권장 — QA는 `grep -c` = 0으로 부재를 별도 재확인했음.
- `pnpm-lock.yaml` 무변경은 정상(워크스페이스 importer 자신의 peer는 락파일에 기록되지 않음 — frozen install exit 0으로 확인).
