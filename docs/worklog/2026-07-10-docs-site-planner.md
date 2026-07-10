# Sprint 7 (docs-site) 계획 수립 — B-04 문서 사이트 실물화

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | planner |
| 관련 경로 | docs/campaign/star-readiness/sprints/20260710-docs-site/plan.md, docs/campaign/star-readiness/backlog.md, docs/campaign/star-readiness/audit-docs-dx.md |

## 1. 개요

star-readiness 캠페인 Sprint 7 계획. 백로그 B-04(고아 VitePress 마크다운 12파일의 실물화)를 대상으로, audit-docs-dx.md P0-1 근거를 재확인한 뒤 VitePress 스캐폴드+i18n+배포 잡 통합으로 구현 가능한 계획을 작성했다. 인수조건은 전부 기계 검증(명령 + 기대 exit code) 형태다.

## 2. 작업내용

- `docs/campaign/star-readiness/sprints/20260710-docs-site/plan.md` 신규 작성 — 태스크 3건(T-01 VitePress 스캐폴드 / T-02 i18n 로케일 재구조 / T-03 deploy-demo.yml 배포 잡 통합), 인수조건 14건(AC-01~AC-14).
- 방침 결정: B-04의 양자택일에서 **VitePress 실물화 채택, GFM 다운그레이드 기각** — CLAUDE.md 단일 출처가 VitePress를 명시하고, audit 강점 항목이 "렌더·배포·경로만 고치면 자산화 가능"으로 판정했으며, pnpm-workspace.yaml에 docs 워크스페이스가 이미 등록돼 있음을 근거로 기록.
- 사전 확인 수행: 12파일의 상대경로 링크 0건(데드링크 리스크 낮음), `index.ko.md` 참조 0건(KO 이동 안전), 데모 `base: '/wvkit/'` 확인 → 문서는 `/wvkit/docs/` 서브패스 합성 배포로 결정(데모 URL 불변), biome `noDefaultExport: error` → `**/.vitepress/**` override 필요 식별, docs 스크립트를 `docs:build`로 명명해 turbo `build` 태스크 비편입(기존 파이프라인 불변) 결정.
- 범위 제외 명시: README/homepage 사이트 URL 반영(첫 배포 확인 후 후속), B-16(Vue 데모), 문서 본문 개정, CLAUDE.md 정정(리더 소관), 검색/사이트 고도화, docs e2e.

## 3. 주의사항

- vitepress 버전은 `^1.6.3`으로 핀할 것 — 2.x alpha가 latest일 수 있음.
- `ignoreDeadLinks` 옵션 사용 금지(AC-02가 옵션 부재를 grep으로 검증) — 데드링크 게이트가 링크 무결성 게이트를 겸함.
- EN 문서(`docs/components/*/index.md`)는 이동 금지 — Sprint 6이 README에 심은 링크가 깨진다. 이동은 KO 6파일만(`mv`, `git mv` 금지).
- `srcExclude`로 campaign/worklog/templates/qa/loops/reports를 반드시 제외 — 내부 산출물의 사이트 노출 방지 + 해당 파일들의 깨진 링크가 빌드를 실패시키는 것 방지.
- 실제 Pages 배포는 main 머지 시에만 검증 가능 — qa는 AC-10 로컬 재현 + `pnpm docs:preview` 수동 스팟체크로 대체.
- CLAUDE.md 로드맵·문서 스택 서술 갱신과 homepage URL 반영은 미해결 후속 — 리더가 스프린트 종료 시 처리 필요.
