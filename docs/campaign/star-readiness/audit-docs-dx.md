# Audit — Docs · DX · npm 메타 · 발견성

**요약 (감사 범위: 문서/DX/npm/발견성)**
- npm 메타데이터는 이미 상위권 수준: 3패키지 모두 0.3.1 배포 완료, exports `types` 조건 선두, keywords/repository/homepage/bugs/license/files 완비, sideEffects false. **여기는 갭이 거의 없음.**
- 치명타 2건(P0): (1) CLAUDE.md가 약속한 **VitePress 문서 사이트가 실존하지 않음** — docs/는 VitePress 전용 문법을 쓰지만 렌더링/배포되지 않는 고아 마크다운. (2) 문서 12파일 전부 **`@wvkit/*` import 사용 → 실제 배포명 `@guksu/wvkit-*`와 불일치**, 복붙 시 404 설치 실패.
- 발견성 손실(P1): README에 docs 링크 없음, 제품 GIF/스크린샷 없음, 데모는 React 단독 배포, 커뮤니티 헬스 파일(CONTRIBUTING/이슈템플릿 등) 전무.
- 총 12건: **P0 2 · P1 5 · P2 5**. 스타 1000 관점에서 P0-2(설치 불가 코드)와 P1-2(히어로 GIF 부재)가 전환율에 가장 직접적.

---

## P0 — 즉시 수정 (신뢰/설치 자체를 깨는 것)

- [P0] **VitePress 문서 사이트가 존재하지 않음 (약속만 있고 실물 없음)** — CLAUDE.md와 로드맵은 "VitePress 문서 (EN+KO)"를 P0 완료로 표기하나, 리포에 `.vitepress/`·config·docs용 package.json·배포 워크플로가 전무(`find docs -name config*` 무결과, `grep -rl vitepress` 무결과). docs/components/*/index.md 12파일은 `::: code-group` / `::: tip` 등 **VitePress 전용 컨테이너 문법**을 사용(scroll-container/index.md:28,40,125)하는데, 렌더러가 없어 GitHub에서 원문 그대로 깨져 보이고 어디에도 사이트로 배포되지 않음. 유저 입장에서 "문서 6종"은 사실상 부재. 제안: docs/에 VitePress 스캐폴드(config.ts + 사이드바 + i18n EN/KO) 추가하고 deploy 워크플로에 docs 빌드/배포 잡을 추가하거나, VitePress를 접고 문서 문법을 순수 GitHub 마크다운으로 내려 README에서 직접 링크. 규모: L

- [P0] **모든 문서 코드샘플의 import 경로가 미배포 패키지명(`@wvkit/*`)** — docs/components 12파일 전부 `@wvkit/core` / `@wvkit/react` / `@wvkit/vue`를 사용(예: scroll-container/index.md:30,43,72,102). 실제 npm 배포명은 `@guksu/wvkit-core` 등(packages/core/package.json:2, `npm view @guksu/wvkit-core` → 0.3.1 확인). 문서를 그대로 복붙하면 `npm error 404 @wvkit/core`로 설치 실패 → 첫 5분 경로가 즉시 붕괴. 근본 원인은 CLAUDE.md가 `@wvkit/*` 사용을 명령("모든 곳에서 @wvkit/* 형태를 사용")하는 반면 실배포는 `@guksu/wvkit-*`라는 점 — 소스오브트루스가 어긋나 있어 문서를 손볼 때마다 재발함. 제안: 문서 전부 `@guksu/wvkit-*`로 치환하고 CLAUDE.md의 네이밍 규칙 문구를 실배포명으로 정정. 규모: M

---

## P1 — 스타 전환율 직결 (발견성·첫인상)

- [P1] **README에 문서 링크가 전혀 없음** — `grep -i docs README.md` 무결과. 컴포넌트별 심화 문서(문제/아키텍처/API/제한사항까지 README보다 상세)가 존재하는데 README·npm 어디서도 진입로가 없어 완전히 미발견 상태. 제안: README 상단에 Documentation 배지/섹션 추가, 배포된 docs 사이트(또는 docs/ 경로) 링크. 규모: S

- [P1] **제품 GIF/스크린샷 부재 — 첫 화면이 텍스트뿐** — README의 이미지 6건은 전부 shields.io 배지(README.md:5-10)이고 실제 동작 GIF/스크린샷 0건. vaul·embla-carousel 등 스타 상위 헤드리스 라이브러리는 예외 없이 히어로 데모 GIF를 최상단에 배치하며 이것이 스타 전환의 최대 자산. "키보드 튐 방지", "핀치줌 페이저", "PTR" 같은 동작은 글보다 GIF 3초가 압도적. 제안: 실기기/시뮬레이터 캡처로 컴포넌트 3~4종 GIF 제작 후 README 최상단 배치. 규모: M

- [P1] **라이브 데모가 React 단독 + 심화 진입점 없음** — deploy-demo.yml은 `examples/react-example/dist`만 업로드(deploy-demo.yml Upload 스텝). Vue 데모(examples/vue-example)는 존재하나 미배포. 데모 앱 자체는 6종 전부 커버(ScrollContainer/StableInput/PullToRefresh/VirtualKeyboard/SafeArea/ScrollLock 모두 데모 파일 존재) — 배포만 React로 한정됨. 또 StackBlitz/CodeSandbox "Open in" 같은 제로설치 시험 링크 없음. 제안: Vue 데모도 서브패스로 배포하거나 프레임워크 토글 제공, README에 StackBlitz 임베드 링크 추가. 규모: M

- [P1] **커뮤니티 헬스 파일 전무** — CONTRIBUTING.md·CODE_OF_CONDUCT.md·SECURITY.md·.github/ISSUE_TEMPLATE·PULL_REQUEST_TEMPLATE.md·FUNDING.yml 모두 부재(ls 확인). GitHub 커뮤니티 프로필 체크리스트가 미완이라 기여자 신뢰·이슈 트리아지 효율이 떨어짐. 제안: 최소 CONTRIBUTING(빌드/테스트/changeset 흐름) + 버그/기능 이슈 템플릿 2종 + PR 템플릿 추가. 규모: S~M

- [P1] **README 배지 라벨이 `@wvkit/core`로 표기되나 링크는 `@guksu/wvkit-core`** — 배지 label=`%40wvkit%2Fcore`(README.md:5-7)가 시각적으로 `@wvkit/core`를 노출하지만 실제 패키지·링크는 `@guksu/wvkit-core`. 방문자가 같은 패키지의 두 이름을 보게 되어 P0-2의 혼동을 강화. 제안: 배지 label을 실배포명으로 통일. 규모: S

---

## P2 — 품질 신호·정합성 (있으면 좋음)

- [P2] **CI가 e2e(Playwright)를 돌리지 않음** — ci.yml은 lint/typecheck/build/test만 수행(`grep e2e ci.yml` 무결과). git 로그상 PTR/StableInput/ScrollLock/SafeArea/VirtualKeyboard e2e 스위트가 추가됐지만 CI 게이트에 없어 "e2e passing" 그린 신호를 만들지 못함. 제안: CI에 Chromium+WebKit e2e 잡 추가(또는 별도 워크플로). 규모: S

- [P2] **소스오브트루스(CLAUDE.md/로드맵)가 현실과 불일치** — 네이밍(@wvkit vs @guksu/wvkit)·VitePress 실존 여부에서 CLAUDE.md가 사실과 어긋나 있어, 문서를 편집할 때마다 P0 두 건이 재생성됨. 제안: CLAUDE.md 네이밍 규칙·문서 스택 서술을 실제 상태로 정정(캠페인의 다른 산출물과 함께 일괄). 규모: S

- [P2] **publint / 배포 아티팩트 검증이 파이프라인에 없음** — exports 맵은 수동 확인상 정상(types 선두, import/require 정렬 정확)이나 자동 검증 부재. (본 감사에서 publint는 설치 프롬프트 회피 위해 미실행 — 갭으로만 기록.) 제안: CI에 `publint` + `@arethetypeswrong/cli` 스텝 추가로 회귀 방지. 규모: S

- [P2] **루트 TESTING.md가 어디에서도 링크되지 않음** — 테스트 전략 문서가 root에 있으나 README/문서에서 진입로 없음. 제안: CONTRIBUTING 또는 README Development 섹션에서 링크. 규모: S

- [P2] **`homepage`가 README 앵커(#readme)로만 연결** — 3패키지 모두 homepage가 `github.com/Guksu/wvkit#readme`(packages/*/package.json). 데모/문서 사이트가 배포되면 npm 방문자를 데모로 유도하는 편이 스타 전환에 유리. 제안: docs 사이트 배포 후 homepage를 사이트 URL로 갱신. 규모: S

---

## 강점 (유지할 것 — 갭 아님)

- npm 메타: 3패키지 name/description/keywords/repository(+directory)/homepage/bugs/license/author/files/publishConfig 모두 완비. exports는 `types → import → require` 정순, sideEffects:false, three는 optional peer로 정확히 선언.
- README(EN/KO 병행): "Why wvkit?" 문제 제기 → Features 표 → 설치 → Quick Start(JS/React/Vue) → API 표 → 브라우저 매트릭스 → 제한사항까지 구조 충실. README 자체의 import 경로는 `@guksu/wvkit-*`로 정확(문서와 달리 여기는 맞음).
- 컴포넌트 문서 본문 품질은 높음(아키텍처/제한사항/번들사이즈까지) — 렌더링·배포·경로만 고치면 즉시 자산화 가능.
- 배포 상태 양호: 3패키지 0.3.1 npm 게시 확인, Changesets PR 기반 릴리즈 워크플로 구축.
