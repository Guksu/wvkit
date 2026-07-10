# qa-report — three-decouple (B-02 + B-13)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | qa |
| 입력 | plan.md 인수조건 AC-1a~AC-14 + dev-notes.md 경계면 매핑 |
| 판정 방식 | 전 항목 리포 루트에서 직접 재실행 (exit code 기준) + 소스 대조 교차검증 |
| 총평 | **전 항목 PASS (16/16)** — FAIL 0건 |

## 인수조건 판정

| # | 판정 | 근거 (qa 직접 재실행, 2026-07-10) |
|---|------|------|
| AC-1a (red) | [PASS] | 구현 후 재실행 불가(사전 게이트) — 사후 검증으로 대체: `git diff HEAD -- packages/core/src/index.ts`에서 HEAD 배럴에 `createScrollContainer` 값 export 존재 확인. 값 export가 있으면 스크립트 검사 1a/2a(`m.createScrollContainer === undefined` 단언)와 배럴 three require 로드가 결정적으로 실패 → red 성립. 구현자 기록(8건 실패, `Cannot find module 'three'`)과 정합 |
| AC-1b (green) | [PASS] | `pnpm build && node scripts/verify-three-decouple.mjs` → exit **0**, 12건 전부 ok (격리 CJS/ESM 스모크 1a~2b + 인리포 subpath 3a/3b + 어댑터 external 4a/4b×2) |
| AC-2 | [PASS] | `grep -E "require\((\"|')three" packages/core/dist/index.cjs` → exit **1** (무매치) |
| AC-3 | [PASS] | `grep -E "from\s*(\"|')three|import\((\"|')three" packages/core/dist/index.js` → exit **1** (무매치) |
| AC-4 | [PASS] | `node -e "...require('./packages/core/dist/scroll-container.cjs')..."` → exit **0** |
| AC-5 | [PASS] | `pnpm typecheck` → exit **0** (6 tasks) |
| AC-6 | [PASS] | `vitest run --reporter=verbose src/__tests__/subpath-entry.test.ts \| grep TC-B02` → exit **0**, TC-B02-1/2 각 ✓ 통과 표기 |
| AC-7 | [PASS] | core→react→vue 순차 build 후 react/vue test → exit **0** |
| AC-8 | [PASS] | `pnpm test` → exit **0** (6 tasks) |
| AC-9 | [PASS] | `pnpm --filter @guksu/wvkit-core exec vitest run --coverage` → exit **0** (threshold 파일 camera-control/ptr/stable-input 유지 — stable-input 99.2% 등) |
| AC-10 | [PASS] | `pnpm --filter @wvkit/react-example build` → exit **0** (vite build 성공) |
| AC-11 | [PASS] | `pnpm test:e2e:chromium` → exit **0**, **45 passed / 4 skipped**(mobile-only) — scroll-container 스펙 4종 포함, 데모 subpath 이행 후 UI 불변 실증 |
| AC-12 | [PASS] | `.changeset/20260710-three-decouple.md` 존재, core/react/vue 3패키지 **minor** + 본문 BREAKING 명시 → exit **0** |
| AC-13a (red) | [PASS] | 구현 후 재실행 불가(사전 게이트) — 사후 검증: `git diff HEAD`로 HEAD의 `scrollTo`/`zoomTo`에 `if (destroyed) return;` 부재 확인. 가드 없으면 destroy 후 `activeIndex` 갱신 + `onIndexChange` 발화가 그대로 진행되어 TC-B13-1(`toHaveBeenCalledTimes(0)`·`getActiveIndex()===0`)/TC-B13-2가 결정적으로 실패 → red 성립 |
| AC-13b (green) | [PASS] | `vitest run --reporter=verbose src/components/scroll-container/__tests__/scroll-container.test.ts \| grep TC-B13` → exit **0**, TC-B13-1/2/3 각 ✓ 통과 표기 |
| AC-14 | [PASS] | 전자 grep -c: index.md 3 / index.ko.md 3 / README.md 1 / README.ko.md 1 / CLAUDE.md 2 (각 ≥1, exit 0). 후자 grep: 유일 매치가 `sprints/20260710-three-decouple/plan.md:114` — **AC 정의문의 자기 인용**(grep 패턴이 자기 자신에 걸림). `--exclude-dir=campaign` 시 exit **1** — 사용자 문서(docs/components·README·CLAUDE.md) 배럴 경로 샘플 잔존 **0** 확인. 구현자 판정(캠페인 산출물 제외)에 동의 |

추가: `pnpm lint` → exit **0** (Biome 130 files).

## 경계면 교차검증 (dev-notes 매핑 기반 소스 대조)

| 경계 | 판정 | 근거 |
|------|------|------|
| core subpath 엔트리 ↔ react/vue 소비자 | [PASS] | `packages/core/src/scroll-container.ts`가 `createScrollContainer` 값 + 타입 3종 export. `packages/react/src/components/scroll-container/use-scroll-container.ts:3-4` · `packages/vue/.../use-scroll-container.ts:2-3` 모두 값·타입을 `@guksu/wvkit-core/scroll-container`에서 import — 필드명·경로 일치 |
| core 배럴 three 무참조 ↔ react/vue 배럴 type re-export | [PASS] | `packages/core/src/index.ts` 값은 non-three 5종(`createSafeArea`/`createScrollLock`/`createVirtualKeyboard`/`createStableInput`/`createPullToRefresh`) + `WebviewHeadlessError`, ScrollContainer는 13-17행 type-only. react/vue `index.ts`의 `ScrollContainerDirection` 등 type re-export는 배럴(`@guksu/wvkit-core`) 경유 — 배럴 타입 잔존 계약과 정합. 격리 스모크(AC-1b 검사 1a/2a)가 런타임 무참조를 실증 |
| react/vue subpath ↔ 데모 | [PASS] | `examples/react-example/src/ScrollContainerDemo.tsx:2` 값 import는 `@guksu/wvkit-react/scroll-container`, :3 `ScrollContainerDirection` 타입 import는 배럴 `@guksu/wvkit-react` — 배럴 타입 잔존 계약의 소비자 실증. AC-10/AC-11 통과 |
| exports 맵 ↔ tsup entry | [PASS] | 3패키지 모두 `package.json` exports에 `./scroll-container`(types/import/require) 추가 + `tsup.config.ts:4` entry 2종 — dist 산출물(AC-4, 스크립트 3a/3b/4b)로 실증 |
| destroyed 가드 ↔ 어댑터 언마운트 계약 | [PASS] | `scroll-container.ts` scrollTo(:221)/zoomTo(:237) 첫 줄 `if (destroyed) return;` — 상태·콜백·DOM 불변을 TC-B13-1~3이 고정. `getActiveIndex`/`getZoom`은 plan대로 가드 없음(읽기 전용, 마지막 상태 반환) |

## 테스트 의미(껍데기 여부) 판정

- **TC-B02-1/2** (`packages/core/src/__tests__/subpath-entry.test.ts`): load-bearing — 함수 typeof 단언 + `'createScrollContainer' in barrel === false`(배럴 값 제거의 회귀 방지) + non-three 값 잔존 단언. 껍데기 아님.
- **TC-B13-1/2/3** (`scroll-container.test.ts:369-418`): load-bearing — 기존 껍데기(`not.toThrow()` 2건 + "implementation-defined" 주석, git diff로 확인)를 콜백 횟수 0·상태 불변·`style.display` 불변·정상 경로 비파괴(호출 수 1 유지)의 명시 단언으로 교체. 가드 제거 시 즉시 red가 되는 구조.
- **verify-three-decouple.mjs**: 자식 프로세스 exit code 3분류(0=로드+단언 성공/1=로드 실패/2=단언 실패)로 "three 미해석 실패"와 "단언 실패"를 구분 — 오탐 방지 설계 확인. 문자열 grep이 아닌 격리 런타임 스모크가 정본(plan 리스크 3 대응).

## 컨벤션 점검

- [PASS] named export만 사용 (신규 엔트리 3파일 전부).
- [PASS] SSR 가드·인라인 스타일·에러 처리 — 이번 변경 범위(엔트리 분리 + 가드 2줄)에 신규 위반 없음.
- [PASS] destroy 완전성 — 기존 destroy 로직 무변경, 가드는 destroy 이후 재변형만 차단.

## 특이사항 (FAIL 아님)

1. **AC-14 자기참조**: plan.md의 AC 명령 문자열이 grep 패턴에 자기 매치. 캠페인 산출물은 사용자 문서가 아니므로 제외 판정이 타당 — 향후 planner는 grep형 AC에 `--exclude-dir=campaign`을 명시할 것을 권고.
2. **red 게이트(AC-1a/AC-13a)의 QA 재실행 불가**: 사전 게이트 특성상 사후에는 diff 기반 논리 검증만 가능. TDD 게이트를 QA가 독립 재현하려면 구현 커밋 분리(테스트 커밋 → 구현 커밋)가 필요 — 커밋은 사용자 전담이므로 현 diff 검증으로 갈음.
3. **B-21 상향 제안 동의**: 신규 exports 서브패스가 생겼으므로 publint/attw 검증(B-21) 우선순위 상향 필요 — dev-notes 제안에 qa도 동의.
