# qa-report — Sprint 7 (20260710-docs-site)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 검증자 | qa |
| 판정 방식 | 전 AC 직접 재실행(exit code) + 소스 대조 경계면 교차검증 + preview 스팟체크 |
| 종합 | **PASS 14/14 — FAIL 0** |

## 1. 인수조건 판정 (전부 리포 루트에서 직접 재실행)

| AC | 명령 | 기대 | 실측 | 판정 |
|----|------|------|------|------|
| AC-01 | `pnpm install --frozen-lockfile` | exit 0 | exit 0 (lockfile up to date) | [PASS] |
| AC-02 | `pnpm docs:build` / `grep ignoreDeadLinks config.ts` | exit 0 / exit 1 | exit 0 (vitepress 1.6.4, 2.71s) / exit 1 (0건 — 데드링크 게이트 유지) | [PASS] |
| AC-03 | EN·KO 랜딩 + 컴포넌트 12페이지 dist 존재 | exit 0 | exit 0 (14 html 전부 존재) | [PASS] |
| AC-04 | `vp-code-group` 렌더 / `:::` HTML 잔존 | exit 0 / exit 1 | exit 0 / exit 1 (잔존 0건) | [PASS] |
| AC-05 | campaign·worklog·templates·qa·loops·reports dist 비노출 | exit 0 | exit 0 (+ digests도 부재 확인 — srcExclude 7종 실효) | [PASS] |
| AC-06 | `base: '/wvkit/docs/'` config + dist 반영 | exit 0 | exit 0 | [PASS] |
| AC-07 | KO 6파일 재배치 + `index.ko.md` 부재 + EN 원위치 + README 링크 | exit 0 | exit 0 | [PASS] |
| AC-08 | locales(root/`'/ko/'`) 정의 | exit 0 | exit 0 | [PASS] |
| AC-09 | 워크플로 `docs:build`·`site/docs`·`path: site` | exit 0 | exit 0 | [PASS] |
| AC-10 | `pnpm build && pnpm docs:build` + 합성 재현 + 3파일 존재 | exit 0 | exit 0 (데모 루트 + `/docs` 서브패스 공존) | [PASS] |
| AC-11 | `pnpm lint` | exit 0 | exit 0 (134 files, no fixes) | [PASS] |
| AC-12 | `pnpm typecheck` | exit 0 | exit 0 (6 tasks) | [PASS] |
| AC-13 | `pnpm test` | exit 0 | exit 0 (core 14 files / 250 tests 전부 pass, 커버리지 threshold 회귀 없음) | [PASS] |
| AC-14 | `grep -rn '@wvkit/' docs/components docs/ko docs/index.md` | exit 1 | exit 1 (0건 — 신규 랜딩 2종 포함 `@guksu/wvkit-*`만 사용) | [PASS] |

비고: AC-13은 turbo 캐시 히트로 재생됐으나 이번 스프린트가 `packages/*` 소스를 변경하지 않아(입력 해시 불변) 유효한 판정임.

## 2. 경계면 교차검증 (생산자 ↔ 소비자 소스 대조)

| 경계면 | 대조 결과 | 판정 |
|--------|-----------|------|
| 문서 마크다운 ↔ VitePress 빌더 | 12파일 + 랜딩 2종 렌더 통과, `:::` 원문 잔존 0 (AC-02/03/04 실측) | [PASS] |
| 내부 산출물 ↔ srcExclude | config.ts:16-24 srcExclude 7종 = dist 부재 실측 7종 일치 | [PASS] |
| docs 빌드 산출 ↔ 배포 워크플로 | deploy-demo.yml:47-51 합성 커맨드 4줄이 AC-10/plan 명세와 **문자열 동일** (`rm -rf site` / `mkdir -p site/docs` / `cp -R examples/react-example/dist/. site/` / `cp -R docs/.vitepress/dist/. site/docs/`), upload `path: site`(:59). trigger·permissions·concurrency 불변 확인 | [PASS] |
| base ↔ Pages URL | config.ts:15 `base: '/wvkit/docs/'` — 데모 `base: '/wvkit/'`(vite.config) 서브패스 정합, dist asset 경로 `/wvkit/docs/assets/*` 실측 | [PASS] |
| docs 워크스페이스 ↔ 루트 파이프라인 | docs/package.json 스크립트 `docs:build` 명명(`build` 아님) → `pnpm build` 시 turbo build 태스크 5개 실행(docs 미편입), turbo.json에 docs 참조 0건 | [PASS] |
| README ↔ EN 문서 경로 | EN 6파일 비이동 + README `docs/components/scroll-container/index.md` 링크 잔존 (AC-07) | [PASS] |
| biome/.gitignore ↔ 신규 산출물 | biome.json:35-43 override include에 `**/.vitepress/**` 존재(default export 허용), .gitignore:36-40에 dist/cache/`/site/` — lint 134파일 그린 | [PASS] |

**KO 본문 무개정 검증(plan T-02 계약):** 이동된 6파일을 `git show HEAD:docs/components/{slug}/index.ko.md`와 바이트 단위 diff — 6/6 identical. [PASS]

## 3. 수동 스팟체크 (plan :202 — qa 위임 항목)

`pnpm docs:preview` 기동 후 curl 검증:

| 항목 | 실측 | 판정 |
|------|------|------|
| EN 랜딩 `/wvkit/docs/` | HTTP 200 | [PASS] |
| KO 랜딩 `/wvkit/docs/ko/` | HTTP 200 | [PASS] |
| 컴포넌트 페이지 `/wvkit/docs/components/scroll-container/` | HTTP 200 | [PASS] |
| 로케일 스위처 | `VPNavBarTranslations` + `한국어` 라벨 렌더 확인 | [PASS] |
| nav Demo 링크 | `https://guksu.github.io/wvkit/` 노출 확인 | [PASS] |
| 자산 경로 | `/wvkit/docs/assets/app.*.js` HTTP 200 | [PASS] |

## 4. 테스트 껍데기(load-bearing) 판정

이번 스프린트는 docs 워크스페이스·CI·설정만 변경하고 **신규 단위/e2e 테스트를 추가하지 않음**(plan 범위 제외 "docs 사이트 e2e" 준수). 판정 대상 신규 테스트 없음 — 대신 AC-02~10 자체가 기계 검증 게이트로 기능하며, 특히 AC-04(컨테이너 렌더 증거)와 ignoreDeadLinks 금지(AC-02)는 껍데기가 아닌 load-bearing 게이트임을 확인. [PASS]

## 5. 컨벤션 점검

- named export 예외: VitePress config의 default export는 biome override로 명시 처리(기존 tsup/vite config와 동일 방식) — 컨벤션 위반 아님. [PASS]
- 런타임 코드 변경 없음 → SSR 가드·destroy·인라인 스타일 점검 대상 없음. changeset 불필요 판단(dev-notes) 타당 — packages/* 버전 영향 없음. [PASS]

## 6. 관찰 사항 (FAIL 아님 — 참고)

1. dev-notes.md:35 "turbo 태스크 6개 불변"은 부정확 — 실측 turbo build 태스크는 5개(docs는 build 스크립트 부재로 스코프 6개 중 실행 제외). 계약 의도(turbo 미편입·출력 불변)는 충족되므로 판정 영향 없음.
2. `site/` 디렉토리가 AC-10 재현 산출물로 워킹트리에 잔존(.gitignore 처리됨) — 커밋 오염 없음.
3. 실제 Pages 배포 검증은 main 머지 후에만 가능(plan 명시) — 첫 배포 후 `https://guksu.github.io/wvkit/docs/` 실효 확인 및 README/homepage 링크 반영(범위 제외 항목)을 후속 스프린트로 리더에게 이관.

## 종합 판정

**PASS — 인수조건 14/14 그린, 경계면 계약 7/7 일치, 수동 스팟체크 6/6 통과, 미해결 이슈 0.**
