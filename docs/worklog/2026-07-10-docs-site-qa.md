# Sprint 7 (docs-site) QA 검증

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-docs-site/qa-report.md, docs/.vitepress/, docs/ko/, .github/workflows/deploy-demo.yml |

## 1. 개요

Sprint 7(B-04 VitePress 문서 사이트 실물화)의 구현 결과를 구현자와 분리된 시선으로 교차검증했다. plan.md의 기계 검증 인수조건 AC-01~AC-14를 전부 직접 재실행(exit code 판정)하고, dev-notes.md의 생산자↔소비자 경계면 7종을 소스 대조로 검증했으며, plan :202가 qa에 위임한 `pnpm docs:preview` 수동 스팟체크를 수행했다.

## 2. 작업내용

- AC-01~AC-14 전 항목 리포 루트에서 직접 재실행 — **14/14 exit code 그린** (dev-notes 자가 보고와 일치). AC-13은 turbo 캐시 히트였으나 packages/* 무변경으로 유효 판정.
- 경계면 교차검증 7종 — deploy-demo.yml:47-51 합성 커맨드가 AC-10과 문자열 동일함을 확인, config.ts srcExclude 7종 = dist 부재 실측 일치, docs 워크스페이스의 turbo build 미편입(태스크 5개) 확인, biome override(`**/.vitepress/**`)·.gitignore(`/site/` 등) 실효 확인.
- KO 이동 6파일 본문 무개정 검증 — `git show HEAD:...index.ko.md` 대비 바이트 diff 6/6 identical (git 읽기만 사용).
- preview 스팟체크 — EN/KO 랜딩·컴포넌트 페이지 HTTP 200, 로케일 스위처(VPNavBarTranslations)·nav Demo 링크·`/wvkit/docs/assets/*` 자산 경로 정상.
- 신규 테스트 껍데기 판정 — 이번 스프린트는 신규 테스트 미추가(plan 범위 제외 준수), AC 게이트 자체(특히 AC-04 렌더 증거, ignoreDeadLinks 금지)가 load-bearing임을 확인.
- 산출: `docs/campaign/star-readiness/sprints/20260710-docs-site/qa-report.md` — **종합 PASS, FAIL 0**.

## 3. 주의사항

- dev-notes.md:35 "turbo 태스크 6개 불변"은 실측 5개(빌드 태스크)로 표기 부정확 — 계약 의도는 충족되어 판정 영향 없음.
- 실제 GitHub Pages 배포 검증은 main 머지 후에만 가능 — 첫 배포 후 `https://guksu.github.io/wvkit/docs/` 실효 확인 및 README/homepage URL 반영(plan 범위 제외)을 후속 스프린트로 리더에게 이관 필요.
- `site/`는 AC-10 재현 산출물로 워킹트리에 잔존(.gitignore 처리됨) — 삭제해도 무방.
