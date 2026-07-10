# Sprint 4 three 분리 구현 (B-02 subpath 분리 + B-13 destroy 가드)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 관련 경로 | packages/{core,react,vue}/src/scroll-container.ts, packages/core/src/index.ts, packages/core/src/components/scroll-container/, scripts/verify-three-decouple.mjs, docs/campaign/star-readiness/sprints/20260710-three-decouple/ |

## 1. 개요

`@guksu/wvkit-core` 배럴이 three를 정적 로드해 three 미설치 CJS/ESM 소비자가 non-three 컴포넌트(StableInput 등)조차 못 쓰는 P0(audit-code-ci)를 subpath export 분리로 해소했다. 동시에 destroy 이후 `scrollTo`/`zoomTo`가 상태를 갱신하고 콜백을 발화하던 누수(B-13)를 `destroyed` 가드로 차단하고 껍데기 테스트를 명시 단언으로 교체했다. plan.md의 TDD 게이트(AC-1a/AC-13a red 선확인) 준수.

## 2. 작업내용

- `scripts/verify-three-decouple.mjs` 신규 — three 미설치 임시 디렉토리 격리 CJS/ESM 런타임 스모크(정본 판정) + 인리포 subpath 기능 + 어댑터 external 보존 검사. 구현 전 exit 1(red, 8건 실패) → 구현 후 exit 0(green, 12건 ok).
- ScrollContainer 값 export를 배럴에서 제거하고 `@guksu/wvkit-{core,react,vue}/scroll-container` subpath로 이동 — 3패키지 각 `src/scroll-container.ts` 엔트리 신설, tsup entry·package.json exports 추가. 배럴에는 타입만 type-only 잔존.
- react/vue `use-scroll-container.ts`의 코어 import를 `@guksu/wvkit-core/scroll-container`로 통일, 데모(`ScrollContainerDemo.tsx`)·문서(docs 2종 각 3곳, README 2종, CLAUDE.md 2곳) import 샘플 subpath로 갱신.
- `scroll-container.ts` `scrollTo`/`zoomTo` 첫 줄 `if (destroyed) return;` 가드 추가, 기존 껍데기 테스트를 TC-B13-1/2/3(콜백 미발화·상태 불변·DOM 불변·정상 경로 보존)으로 교체. red(3건 실패) → green 확인.
- `.changeset/20260710-three-decouple.md` — core/react/vue 3패키지 minor, breaking 명시.
- 검증: AC-1a~AC-14 전부 기대값 충족 + `pnpm test`/`typecheck`/`lint`/`test:e2e:chromium` exit 0. 상세는 sprints/20260710-three-decouple/dev-notes.md.

## 3. 주의사항

- **breaking**: `createScrollContainer`/`useScrollContainer`는 이제 배럴이 아닌 `<pkg>/scroll-container`에서 import해야 한다 (1.0 이전 breaking=minor 규칙 적용, changeset에 명시).
- AC-14 후자 grep의 유일 매치는 plan.md:114 — AC 정의문의 자기 인용이며 실제 문서 잔존 아님(`--exclude-dir=campaign` 시 무매치).
- 신규 exports 서브패스가 생겼으므로 publint/attw 검증(B-21) 우선순위 상향을 리더에게 제안함.
- 어댑터 테스트는 코어 dist의 exports 서브패스를 경유하므로 코어 빌드 선행 필수 (turbo `^build` 의존으로 CI 보장 확인).
