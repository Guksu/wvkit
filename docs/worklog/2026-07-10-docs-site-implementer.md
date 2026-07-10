# Sprint 7 — 문서 사이트 실물화 (B-04) 구현

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 관련 경로 | docs/package.json, docs/.vitepress/config.ts, docs/index.md, docs/ko/**, .github/workflows/deploy-demo.yml, biome.json, .gitignore, package.json, pnpm-lock.yaml |

## 1. 개요

audit-docs-dx P0-1(VitePress 사이트 실존하지 않음)에 대한 B-04 구현. 고아 상태였던 docs/components 12파일(EN 6 + KO 6)을 VitePress 스캐폴드로 빌드 가능한 사이트로 실물화하고, KO 문서를 `/ko/` 로케일로 재배치했으며, deploy-demo.yml에 데모 루트 + `/docs` 서브패스 합성 배포를 추가했다. 계획: docs/campaign/star-readiness/sprints/20260710-docs-site/plan.md.

## 2. 작업내용

- `docs/package.json` 신규 — `@guksu/wvkit-docs` private, `vitepress@^1.6.3`, scripts는 turbo build 미편입을 위해 `docs:build` 명명.
- `docs/.vitepress/config.ts` 신규 — `base: '/wvkit/docs/'`, srcExclude(campaign/worklog/templates/qa/loops/reports/digests), locales root(EN)+ko, 로케일별 사이드바 6종·Demo nav, GitHub socialLink. `ignoreDeadLinks` 미사용으로 데드링크 게이트 유지.
- `docs/index.md`·`docs/ko/index.md` 신규 — home 레이아웃 랜딩 2종, 설치 커맨드는 `@guksu/wvkit-*`.
- KO 6파일 이동 — `docs/components/{slug}/index.ko.md` → `docs/ko/components/{slug}/index.md` (본문 무개정, 일반 mv).
- 루트 `package.json` — `docs:dev`/`docs:build`/`docs:preview` 스크립트 추가.
- `.github/workflows/deploy-demo.yml` — Build docs + Compose site 스텝 추가, upload path `site`, name `Deploy Demo & Docs`. trigger/permissions/concurrency 불변.
- `biome.json` — `**/.vitepress/**` noDefaultExport 예외. `.gitignore` — `/site/` 추가.
- 검증: AC-01~AC-14 전부 기대 exit code 충족. `pnpm build`/`test`/`typecheck`/`lint` exit 0, `pnpm docs:build` exit 0 (12페이지 + 랜딩 2종 렌더, `:::` 잔존 0). 상세는 sprints/20260710-docs-site/dev-notes.md.

## 3. 주의사항

- KO 파일 이동은 일반 `mv`로 수행 — git 스테이징(D + ??)은 사용자 전담. 커밋 시 rename으로 인식되도록 `git add -A docs/` 권장.
- 실제 Pages 배포 URL(`https://guksu.github.io/wvkit/docs/`) 검증은 main 머지 후에만 가능. README·homepage에 사이트 URL 심기는 plan 범위 제외(배포 확인 후 후속 백로그).
- changeset 없음 — packages/* 런타임 무변경.
- 워킹트리의 `site/`는 AC-10 로컬 재현 산출물(gitignore 대상)이며 삭제 무방.
- CLAUDE.md 로드맵 갱신은 리더 소관(plan 범위 제외).
