# Sprint 11 — 어댑터·설정 정리 (B-25) 구현

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-11 |
| 작성 | implementer |
| 관련 경로 | packages/core/src/components/{stable-input,scroll-lock}/, packages/react/, packages/vue/, .github/workflows/deploy-demo.yml, README*.md, docs/{components,ko}/scroll-container/, .changeset/ |

## 1. 개요

audit-code-ci P2 6건(B-25)을 닫는 Sprint 11 plan.md를 TDD로 구현했다. 어댑터의 non-callback 옵션 1회 고정 계약 문서화+핀 테스트, react-dom peer 제거, biome 억제 유효성 검증, deploy-demo paths 필터, ScrollLock 안전망 주석, StableInput 옵션 검증이 대상이다. 런타임 동작 변경은 StableInput validateOptions(T-06)뿐이다.

## 2. 작업내용

- T-06 (Red→Green): `packages/core/src/components/stable-input/__tests__/stable-input.test.ts`에 S1/S2 작성 → 2건 실패 확인 → `stable-input.ts`에 `validateOptions` 구현(SSR 가드 직후 호출, container/scrollAnchor 검사, 문자열 옵션 검증은 의도적 생략 주석) + `destroy()`에 `isFocused = false`. core changeset **minor**(throw 추가는 breaking-ish — CHANGELOG에 명시).
- T-05: `scroll-lock.ts` scrollY 저장·복원부에 "안전망" 의도 주석(동작 변경 0) + L1 핀 테스트(lock 시점 scrollY=120 → 위치 변동 모사 → unlock이 `scrollTo(0, 120)` 호출 단언).
- T-01: README.md/README.ko.md API Reference 서두에 어댑터 공통 Reactivity note(marker: `captured once at mount` / `마운트 시점에 1회 고정`), docs EN/KO scroll-container 페이지에 `::: warning` caveat, react/vue `use-scroll-container.ts` JSDoc에 "재마운트" 안내. 핀 테스트 R1(react rerender로 panels/minZoom 교체 → renderer DOM 동일 참조)·V1(vue options mutate → 동일 참조) 추가.
- T-02: `packages/react/package.json` peerDependencies에서 react-dom 삭제(devDep은 @testing-library/react용으로 유지). `pnpm install` 실행 결과 락파일 변경 없음 — 워크스페이스 패키지 자신의 peerDependencies는 lockfile importers에 기록되지 않음. `--frozen-lockfile` exit 0 확인.
- **T-03 판정: 잔존 억제 2곳 모두 유효(load-bearing) — 소스 변경 0.** 각각 임시 제거 후 `pnpm exec biome lint packages` 실행: `use-scroll-lock.ts:14` 제거 시 `useExhaustiveDependencies` 에러(options.allowScrollWithin), `use-virtual-keyboard.ts:14` 제거 시 동일 에러(options.threshold) → 둘 다 복원. 현재 lint 경고 0·suppress 출력 0건으로 AC-09/10 충족. 감사 시점 무효 억제 3곳은 이전 스프린트에서 이미 해소된 상태.
- T-04: `deploy-demo.yml`에 plan 명세 그대로 `paths:` 9개 + `workflow_dispatch` 추가. `docs/` 직하위 실측(ls) 결과 사이트 빌드 입력(components/ko/index.md/package.json/.vitepress)이 전부 필터에 포함됨을 확인.
- T-07: changeset 2건(`.changeset/20260710-adapter-config-cleanup-{core,react}.md` — core minor / react patch).
- 검증: AC-01~AC-22 전부 통과. 전역 게이트 lint/typecheck/build/test exit 0 (core 271 / react 35 / vue 30 pass). 커버리지 사전 확인 — stable-input branches 93.33(≥90)/functions 86.66(≥85).

## 3. 주의사항

- `deploy-demo.yml`에는 `docs/worklog` 리터럴을 어떤 형태(주석 포함)로도 넣지 말 것 — AC-12가 macOS BSD grep `-vq`로 문자열 부재를 단언한다(최초 주석에 넣었다가 실패 → 리워딩으로 해결).
- StableInput은 이제 무효 container/scrollAnchor에 throw한다 — 어댑터(useStableInput)는 effect/onMounted 내부에서 create하므로 throw가 effect 내부에서 발생. 어댑터에 무효 옵션을 주입하는 테스트는 plan 범위 외(core 단위 검증으로 충족).
- R1/V1/L1은 기존 동작을 고정하는 characterization 테스트라 Red 단계가 없음(신규 동작인 S1/S2만 Red 확인).
- `pnpm-lock.yaml` 무변경은 정상(위 T-02 근거). 커밋·푸시는 사용자 전담.
