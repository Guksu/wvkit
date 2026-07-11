# dev-notes — Sprint 7 (20260710-docs-site)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 브랜치 | sprint/20260710-docs-site |
| 방식 | TDD — AC-02/07/09 red 확인 후 구현, 전 AC green 확인 |

## 변경 파일

### 신규
- `docs/package.json` — `@guksu/wvkit-docs` private 워크스페이스. `vitepress@^1.6.3`(설치 실물 1.6.4), scripts `docs:dev`/`docs:build`/`docs:preview` (turbo `build` 태스크 미편입 위해 `build` 명명 회피).
- `docs/.vitepress/config.ts` — `base: '/wvkit/docs/'`, `srcExclude` 7종(campaign/worklog/templates/qa/loops/reports/digests), locales(root=EN, ko=`/ko/`) + 로케일별 nav(Demo → `https://guksu.github.io/wvkit/`)·사이드바 6종, socialLinks GitHub. `ignoreDeadLinks` 미사용(데드링크 게이트 유지).
- `docs/index.md` — EN home 랜딩 (hero tagline에 `@guksu/wvkit-*` 설치 커맨드, features 6종 → `/components/{slug}/`).
- `docs/ko/index.md` — KO home 랜딩 (features 6종 → `/ko/components/{slug}/`).

### 이동 (일반 mv — 스테이징은 사용자 전담)
- `docs/components/{slug}/index.ko.md` → `docs/ko/components/{slug}/index.md` × 6 (scroll-container, stable-input, pull-to-refresh, virtual-keyboard, safe-area, scroll-lock). 본문 무개정.

### 수정
- `package.json`(루트) — scripts `docs:dev`/`docs:build`/`docs:preview` 추가 (`pnpm --filter @guksu/wvkit-docs ...`).
- `.gitignore` — `/site/` 추가 (dist/cache는 기존재).
- `biome.json` — noDefaultExport off override include에 `**/.vitepress/**` 추가.
- `.github/workflows/deploy-demo.yml` — name `Deploy Demo & Docs`, `Build docs`(`pnpm docs:build`) + `Compose site` 스텝 추가(plan 명세 커맨드 그대로), upload `path: site`. trigger/permissions/concurrency 불변.
- `pnpm-lock.yaml` — vitepress 반영 (`--frozen-lockfile` 재설치 exit 0).

## 생산자 ↔ 소비자 매핑 (plan 경계면 대응)
| 생산자 | 소비자 | 검증 |
|--------|--------|------|
| `docs/components/**`, `docs/ko/**`, `docs/index.md` | `vitepress build` | AC-02/03/04 |
| `docs/{campaign,worklog,templates,qa,loops,reports}` | `srcExclude` | AC-05 |
| `docs/.vitepress/dist` | deploy-demo.yml 합성 스텝(`site/docs`) | AC-09/10 (커맨드 동일 문자열) |
| `config.ts base` | Pages 서브패스 `/wvkit/docs/` | AC-06 |
| `docs/package.json`(docs:build 명명) | turbo build/test 파이프라인 | AC-10 전반부·AC-13 (turbo 태스크 6개 불변) |
| README `docs/components/*/index.md` 링크 | EN 파일 비이동 | AC-07 |
| `.gitignore`/biome override | `pnpm lint` | AC-11 |

## AC별 결과 (전부 리포 루트 실행)
| AC | 결과 |
|----|------|
| AC-01 `pnpm install --frozen-lockfile` | exit 0 |
| AC-02 `pnpm docs:build` + ignoreDeadLinks grep | build exit 0 / grep exit 1 (0건) |
| AC-03 EN·KO 랜딩 + 12 컴포넌트 페이지 생성 | exit 0 |
| AC-04 `vp-code-group` 렌더 + `:::` 잔존 0 | exit 0 / exit 1 (잔존 0) |
| AC-05 내부 산출물 6종 dist 비노출 | exit 0 |
| AC-06 base `/wvkit/docs/` config+dist 일치 | exit 0 |
| AC-07 KO 재배치 + EN·README 불변 | exit 0 |
| AC-08 locales root/ko 정의 | exit 0 |
| AC-09 워크플로 docs:build·site/docs·path: site | exit 0 |
| AC-10 합성 로컬 재현 (site/, site/docs/, site/docs/ko/) | exit 0 |
| AC-11 `pnpm lint` | exit 0 (134 files) |
| AC-12 `pnpm typecheck` | exit 0 |
| AC-13 `pnpm test` | exit 0 (커버리지 threshold 회귀 없음) |
| AC-14 문서 소스 `@wvkit/` 0건 | exit 1 (0건) |

## Red 단계 기록
- AC-02: `pnpm docs:build` → ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL exit 254.
- AC-07: `docs/ko/components/scroll-container/index.md` 부재 exit 1.
- AC-09: 워크플로 `docs:build` grep exit 1.

## changeset
불필요 — packages/* 런타임 변경 없음 (docs 워크스페이스·CI·설정만).

## 트레이드오프 / 참고
- vitepress 1.6.4 설치 — peer 경고 없이 설치 완료(`glob@10.5.0` deprecated 서브의존성 WARN 1건뿐, 에러 승격 없음).
- `site/`는 AC-10 재현 산출물로 워킹트리에 남아 있음(.gitignore 처리됨). 삭제해도 무방.
- 랜딩 2종(docs/index.md, docs/ko/index.md)은 신규 문안 — 12파일 본문은 무개정(plan 범위 제외 준수).
- qa 수동 스팟체크 항목: `pnpm docs:preview`로 로케일 스위처·nav Demo 링크 확인 (plan :202).
