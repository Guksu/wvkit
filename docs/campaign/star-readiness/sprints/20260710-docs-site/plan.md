# Sprint 7 — 문서 사이트 실물화 (docs-site)

| 항목 | 내용 |
|------|------|
| 슬러그 | 20260710-docs-site |
| 백로그 | B-04 (L) |
| 근거 | audit-docs-dx.md P0-1(VitePress 사이트 실존하지 않음, :13) + P2(소스오브트루스 불일치, :37) + P2(homepage 앵커, :43 — 범위 제외로만 참조) |
| 브랜치 | chore/quality-sprint-1 (git 변경 명령은 사용자 전담) |

## 방침 결정 — VitePress 실물화 채택 (GFM 다운그레이드 기각)

백로그 B-04는 두 갈래(VitePress 스캐폴드 vs 순수 GFM 다운그레이드)를 제시한다. **VitePress 실물화**를 채택한다.

1. CLAUDE.md(단일 출처)가 문서 스택을 "VitePress 문서 (EN + KO)"로 명시 — GFM 다운그레이드는 단일 출처와 정면 충돌.
2. audit-docs-dx.md 강점 항목(:51)이 "렌더링·배포·경로만 고치면 즉시 자산화 가능"으로 판정 — 콘텐츠 12파일은 이미 VitePress 문법(`::: code-group` 등)으로 완성돼 있어 스캐폴드 추가가 다운그레이드보다 손실이 없다.
3. `pnpm-workspace.yaml`이 이미 `docs`를 워크스페이스로 등록해 둔 상태(package.json 부재로 현재 무시됨) — 스캐폴드가 원설계 방향.

**사전 확인 완료 사실 (계획 근거):**

- docs/components/ 12파일(EN 6 + KO 6, `index.md`/`index.ko.md` 병치) 전부 VitePress 컨테이너 문법 사용.
- 12파일 내 상대경로 마크다운 링크 0건(외부 https 링크만) → 이동·빌드 시 데드링크 리스크 낮음. `index.ko.md`를 참조하는 파일 0건 → KO 파일 이동 안전.
- 문서 import 경로는 B-03(Sprint 3)에서 `@guksu/wvkit-*`로 정정 완료 — 회귀 가드만 필요.
- 데모는 `base: '/wvkit/'`(examples/react-example/vite.config:6)로 GitHub Pages 루트에 배포 중(deploy-demo.yml). 문서는 **동일 Pages의 `/wvkit/docs/` 서브패스**로 합성 배포한다(데모 URL 불변 — README·npm에 이미 노출된 진입로 보호).

## 목표

1. **B-04**: VitePress 스캐폴드(docs 워크스페이스 + config + 랜딩)로 고아 마크다운 12파일을 빌드 가능한 사이트로 실물화한다.
2. i18n: `index.ko.md` 병치 구조를 VitePress 로케일 라우팅(루트=EN, `/ko/`=KO)으로 재배치한다.
3. 배포: deploy-demo.yml에 docs 빌드 + 스테이징 합성 스텝을 추가해 main 머지 시 `https://guksu.github.io/wvkit/docs/`로 자동 배포되게 한다.

## 태스크

### T-01 (B-04) — VitePress 스캐폴드

**신규/수정 파일:**

| 파일 | 내용 |
|------|------|
| `docs/package.json` (신규) | `{ "name": "@guksu/wvkit-docs", "private": true }` + devDependency `vitepress@^1.6.3`(2.x alpha 금지) + scripts `"docs:dev": "vitepress dev ."` / `"docs:build": "vitepress build ."` / `"docs:preview": "vitepress preview ."` — 스크립트명을 `build`가 아닌 `docs:build`로 두어 **turbo `build` 태스크에 편입되지 않게** 한다(`pnpm build`·deploy의 기존 출력 불변) |
| `package.json` (루트, 수정) | scripts 추가: `"docs:dev": "pnpm --filter @guksu/wvkit-docs docs:dev"`, `"docs:build": "pnpm --filter @guksu/wvkit-docs docs:build"` |
| `docs/.vitepress/config.ts` (신규) | `export default defineConfig({...})`. 필수 설정: ① `base: '/wvkit/docs/'` ② `srcExclude: ['campaign/**', 'worklog/**', 'templates/**', 'qa/**', 'loops/**', 'reports/**', 'digests/**']`(내부 산출물 비공개 — 데드링크 게이트 오염 방지 겸용) ③ `ignoreDeadLinks` **설정 금지**(기본 데드링크 실패 = 링크 무결성 게이트) ④ title/description, themeConfig(socialLinks GitHub `https://github.com/Guksu/wvkit`, nav에 Demo → `https://guksu.github.io/wvkit/`) ⑤ 로케일·사이드바는 T-02 명세 |
| `docs/index.md` (신규) | VitePress home 레이아웃(frontmatter `layout: home`) — hero(설치 커맨드는 `@guksu/wvkit-*`만 사용) + features 6종 각 `/components/{slug}/` 절대 사이트 경로 링크 |
| `.gitignore` (수정) | `docs/.vitepress/dist/`, `docs/.vitepress/cache/`, `/site/`(T-03 스테이징) 추가 — biome `vcs.useIgnoreFile: true`라 lint 대상에서도 자동 제외됨 |
| `biome.json` (수정) | overrides의 noDefaultExport off `include` 배열에 `**/.vitepress/**` 추가(VitePress config는 default export 필수 — 기존 tsup/vite config와 동일한 예외 방식) |
| `pnpm-lock.yaml` (갱신) | `pnpm install` 재실행으로 vitepress 반영 — 이후 `--frozen-lockfile` 통과 필수(AC-01) |

`pnpm-workspace.yaml`은 이미 `docs`를 포함하므로 수정하지 않는다.

**완료 기준:** AC-01, AC-02, AC-05, AC-06, AC-11~AC-14 exit 0.

### T-02 (B-04) — i18n 로케일 재구조 (EN 루트 + /ko/)

**파일 이동(6건 — `git mv` 아닌 일반 `mv` 사용, 스테이징은 사용자 전담):**

```
docs/components/{slug}/index.ko.md → docs/ko/components/{slug}/index.md
(slug = scroll-container, stable-input, pull-to-refresh, virtual-keyboard, safe-area, scroll-lock)
```

**신규:** `docs/ko/index.md` — KO 랜딩(home 레이아웃, `/ko/components/{slug}/` 링크).

**config.ts locales 명세:**

- `root`: `{ label: 'English', lang: 'en' }` — 사이드바: "Components" 그룹에 6종(`/components/{slug}/`).
- `ko`: `{ label: '한국어', lang: 'ko', link: '/ko/' }` — 사이드바: 동일 6종(`/ko/components/{slug}/`), 그룹명 "컴포넌트".

**주의:** EN 문서(`docs/components/{slug}/index.md`)는 **이동하지 않는다** — Sprint 6(B-14b)이 README EN/KO 양쪽에 심은 `docs/components/{slug}/index.md` 링크가 깨지지 않아야 한다(AC-07 전제). 이동은 KO 6파일만. 콘텐츠 본문 개정 금지(이동·frontmatter 최소 추가만 허용).

**완료 기준:** AC-03, AC-07, AC-08 exit 0. VitePress 로케일 스위처가 nav에 자동 노출(locales 정의 시 기본 동작 — 수동 검증은 qa의 `pnpm docs:preview` 확인 항목).

### T-03 (B-04) — 배포 잡 통합 (deploy-demo.yml)

**수정 파일:** `.github/workflows/deploy-demo.yml`

기존 단일 Pages 배포(데모 루트)를 유지하면서 docs를 서브패스로 합성한다. "Build packages and demo"(`pnpm build`) 스텝 뒤에 추가:

```yaml
- name: Build docs
  run: pnpm docs:build

- name: Compose site (demo at root + docs at /docs)
  run: |
    rm -rf site
    mkdir -p site/docs
    cp -R examples/react-example/dist/. site/
    cp -R docs/.vitepress/dist/. site/docs/
```

그리고 `Upload artifact` 스텝의 `path:`를 `examples/react-example/dist` → `site`로 변경. 워크플로 `name`은 `Deploy Demo & Docs`로 갱신(선택). trigger(`push: main`)·permissions·concurrency는 변경 금지.

**완료 기준:** AC-09(워크플로 정적 검사), AC-10(합성 커맨드 로컬 재현 — 워크플로와 동일 커맨드여야 함) exit 0.

## 인수조건 (기계 검증 — 명령 + 기대 exit code)

> 인수조건 = 테스트 케이스 (TDD). 구현 전 AC-02~AC-10은 실패(red)해야 하고, 구현 후 전부 exit 0(green).
> 모든 명령은 리포 루트에서 실행.

```bash
# AC-01 — 락파일 동기화 (vitepress 의존성 반영 후 frozen 설치 성공 — CI 전제)
pnpm install --frozen-lockfile
# 기대: exit 0

# AC-02 — 문서 사이트 빌드 성공 + 데드링크 게이트 무력화 금지
pnpm docs:build
# 기대: exit 0 (VitePress 기본 동작상 데드링크 존재 시 exit 1 — 이 게이트를 유지해야 함)
grep -n 'ignoreDeadLinks' docs/.vitepress/config.ts
# 기대: exit 1 (매치 0건 — 옵션 자체를 쓰지 않음)

# AC-03 — 빌드 산출물: EN/KO 랜딩 + 컴포넌트 12페이지 전부 생성
test -f docs/.vitepress/dist/index.html && test -f docs/.vitepress/dist/ko/index.html && \
for c in scroll-container stable-input pull-to-refresh virtual-keyboard safe-area scroll-lock; do
  test -f "docs/.vitepress/dist/components/$c/index.html" && \
  test -f "docs/.vitepress/dist/ko/components/$c/index.html" || exit 1
done
# 기대: exit 0

# AC-04 — VitePress 컨테이너 문법이 실제 렌더됨 (고아 상태 해소의 핵심 증거)
grep -q 'vp-code-group' docs/.vitepress/dist/components/scroll-container/index.html
# 기대: exit 0 (::: code-group → 탭 UI로 변환)
grep -rl ':::' --include='*.html' docs/.vitepress/dist
# 기대: exit 1 (원문 컨테이너 마커가 HTML에 잔존하지 않음)

# AC-05 — 내부 산출물(campaign/worklog 등) 사이트 비공개
for d in campaign worklog templates qa loops reports; do
  test ! -e "docs/.vitepress/dist/$d" || exit 1
done
# 기대: exit 0

# AC-06 — base 경로가 Pages 서브패스와 일치
grep -q "base: '/wvkit/docs/'" docs/.vitepress/config.ts && \
grep -q '/wvkit/docs/' docs/.vitepress/dist/index.html
# 기대: exit 0

# AC-07 — KO 소스 재배치 완료 + EN 소스·README 링크 불변
for c in scroll-container stable-input pull-to-refresh virtual-keyboard safe-area scroll-lock; do
  test -f "docs/ko/components/$c/index.md" && \
  test ! -e "docs/components/$c/index.ko.md" && \
  test -f "docs/components/$c/index.md" || exit 1
done && grep -q 'docs/components/scroll-container/index.md' README.md
# 기대: exit 0

# AC-08 — 로케일 2종(root=EN, ko) 정의
grep -q 'locales' docs/.vitepress/config.ts && grep -q "'/ko/'" docs/.vitepress/config.ts
# 기대: exit 0

# AC-09 — 배포 워크플로: docs 빌드·합성 스텝 존재 + 업로드 경로가 합성 디렉토리
grep -q 'docs:build' .github/workflows/deploy-demo.yml && \
grep -q 'site/docs' .github/workflows/deploy-demo.yml && \
grep -q 'path: site' .github/workflows/deploy-demo.yml
# 기대: exit 0

# AC-10 — 워크플로 합성 커맨드 로컬 재현 (업로드 직전 스테이징과 동일해야 함)
pnpm build && pnpm docs:build && rm -rf site && mkdir -p site/docs && \
cp -R examples/react-example/dist/. site/ && cp -R docs/.vitepress/dist/. site/docs/ && \
test -f site/index.html && test -f site/docs/index.html && test -f site/docs/ko/index.html
# 기대: exit 0 (데모 루트 + 문서 서브패스 공존)

# AC-11 — 린트 그린 유지 (.vitepress default export 예외 + dist/cache 제외 처리 실효)
pnpm lint
# 기대: exit 0

# AC-12 — 타입 체크 그린 유지
pnpm typecheck
# 기대: exit 0

# AC-13 — 단위 테스트·커버리지 threshold 회귀 없음
pnpm test
# 기대: exit 0

# AC-14 — 패키지명 회귀 가드 (B-03 재발 방지 — 신규 랜딩 포함 전 문서 소스에 @wvkit/* 0건)
grep -rn '@wvkit/' docs/components docs/ko docs/index.md
# 기대: exit 1 (매치 0건)
```

## 경계면 매핑 (생산자 ↔ 소비자 — qa 교차검증 입력)

| 경계면 | 생산자 | 소비자 | 이번 스프린트의 계약 |
|--------|--------|--------|----------------------|
| 문서 마크다운 ↔ VitePress 빌더 | `docs/components/**`, `docs/ko/**`, `docs/index.md` | `vitepress build`(데드링크·컨테이너 렌더) | 12파일 + 랜딩 2종이 렌더 통과, `:::` 원문 잔존 0 (AC-02/03/04) |
| 내부 산출물 ↔ 사이트 | `docs/{campaign,worklog,templates,qa,loops,reports}` | `srcExclude` | 캠페인·워크로그가 공개 사이트에 노출되지 않음 (AC-05) |
| docs 빌드 산출 ↔ 배포 워크플로 | `docs/.vitepress/dist` | deploy-demo.yml 합성 스텝 | 산출 경로 계약 `docs/.vitepress/dist` → `site/docs`, 워크플로 커맨드 = AC-10 커맨드 동일 (AC-09/10) |
| `base` ↔ GitHub Pages URL | `config.ts base: '/wvkit/docs/'` | 브라우저 자산 로드 | 데모 `base: '/wvkit/'`와 서브패스 정합 — 데모 URL 불변 (AC-06/10) |
| docs 워크스페이스 ↔ 루트 파이프라인 | `docs/package.json`(`docs:build` 명명) | turbo `build`·`pnpm dev`·CI | turbo 태스크에 미편입 — `pnpm build`/`pnpm test` 출력·시간 불변 (AC-10 전반부, AC-13) |
| README Documentation 섹션 ↔ EN 문서 경로 | Sprint 6 산출(README `docs/components/*/index.md` 링크) | GitHub/npm 방문자 | EN 파일 비이동으로 링크 유지, KO만 `/ko/` 재배치 (AC-07) |
| biome/.gitignore ↔ 신규 산출물 | `.gitignore`(dist/cache/site) + biome override | `pnpm lint` | 생성물 lint 미포집 + config.ts default export 허용 (AC-11) |

## 범위 제외

- **README·package.json `homepage`에 사이트 URL 반영** (audit-docs P2 :43) — 첫 배포는 main 머지 시에만 발생하므로 URL 실효 확인 전 링크 심기는 데드링크 리스크. 배포 확인 후 후속 스프린트(백로그 후보로 리더에게 보고).
- **B-16** Vue 데모 서브패스 배포·StackBlitz 링크 — 별도 백로그.
- **문서 본문 콘텐츠 개정** — audit이 본문 품질을 강점으로 판정(:51). 이동·frontmatter·랜딩 신설만 하고 12파일 본문은 손대지 않는다.
- **CLAUDE.md 로드맵/문서 스택 서술 갱신** — 캠페인 소스오브트루스 정정은 리더 소관(스프린트 완료 보고에 포함 요청).
- **검색(Algolia/local search)·sitemap·custom domain·다크모드 커스텀** — 사이트 고도화는 스타 전환에 2차적, 스캐폴드 최소셋 외.
- **docs 사이트 e2e** — 이번 게이트는 빌드·정적 검사(AC-02~10)까지. Playwright 스위트 추가 없음.
- **`index.ko.md` 하위 호환 리다이렉트** — 해당 경로를 참조하는 파일 0건 확인 완료, 불필요.

## 리스크·참고

- vitepress는 자체 vue를 끌고 옴 — `@guksu/wvkit-vue` 워크스페이스의 vue 3와 peer 경고가 뜰 수 있으나 docs는 private 워크스페이스라 무해. `pnpm install` 경고가 에러로 승격되면 리더에게 보고.
- vitepress 2.x(alpha)가 latest 태그일 수 있음 — 반드시 `^1.6.3`으로 핀.
- Sprint 1 교훈(vitest verbose)은 이번 스프린트 AC에 vitest grep이 없어 해당 없음. 커버리지 threshold는 AC-13(`pnpm test`)로 간접 보호.
- 실제 Pages 배포 검증은 main 머지 후에만 가능 — qa는 AC-10(로컬 재현) + `pnpm docs:preview` 수동 스팟체크(로케일 스위처·데모 nav 링크)로 대체한다.
