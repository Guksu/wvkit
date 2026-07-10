# dev-notes — three-decouple (B-02 + B-13)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 입력 | plan.md (subpath 분리 + minor bump — 리더 dispatch로 승인 간주) |
| 브랜치 | sprint/20260710-three-decouple |

## 변경 파일 목록

### 신규
- `scripts/verify-three-decouple.mjs` — T-01 검증 하네스 (격리 CJS/ESM 스모크 + 인리포 subpath + 어댑터 external 검사, `WVKIT_VERIFY_TMPDIR` env로 임시 디렉토리 오버라이드 가능)
- `packages/core/src/scroll-container.ts` — `@guksu/wvkit-core/scroll-container` subpath 엔트리 (값 + 타입 3종)
- `packages/core/src/__tests__/subpath-entry.test.ts` — TC-B02-1/2
- `packages/react/src/scroll-container.ts` — `@guksu/wvkit-react/scroll-container` 엔트리
- `packages/vue/src/scroll-container.ts` — `@guksu/wvkit-vue/scroll-container` 엔트리
- `.changeset/20260710-three-decouple.md` — core/react/vue 3패키지 **minor**, breaking 명시

### 수정
- `packages/core/src/index.ts` — `createScrollContainer` 값 export 제거 (타입 4종은 type-only로 잔존)
- `packages/core/src/components/scroll-container/scroll-container.ts` — `scrollTo`/`zoomTo` 첫 줄 `if (destroyed) return;` 가드 (B-13)
- `packages/core/src/components/scroll-container/__tests__/scroll-container.test.ts` — 껍데기 테스트("subsequent scrollTo/zoomTo after destroy are silent") → TC-B13-1/2/3 명시 단언으로 교체 (non-throw 단언은 TC-B13-1/2에 포함 유지)
- `packages/core/tsup.config.ts` · `packages/react/tsup.config.ts` · `packages/vue/tsup.config.ts` — entry에 `src/scroll-container.ts` 추가
- `packages/core/package.json` · `packages/react/package.json` · `packages/vue/package.json` — exports에 `./scroll-container` (types/import/require) 추가
- `packages/react/src/index.ts` · `packages/vue/src/index.ts` — `useScrollContainer` 값 export 제거 (코어 배럴 기반 type re-export 블록 유지)
- `packages/react/src/components/scroll-container/use-scroll-container.ts` · `packages/vue/src/components/scroll-container/use-scroll-container.ts` — 값·타입 import를 `@guksu/wvkit-core/scroll-container`로 통일
- `examples/react-example/src/ScrollContainerDemo.tsx` — `useScrollContainer` import를 `@guksu/wvkit-react/scroll-container`로 변경 (`ScrollContainerDirection` 타입 import는 배럴 유지 — 배럴 type 잔존 계약의 소비자 실증)
- 문서: `docs/components/scroll-container/index.md`(3곳) · `index.ko.md`(3곳) · `README.md:188` · `README.ko.md:188` · `CLAUDE.md`(Core :98 / React :124) — import 샘플 subpath 경로로 갱신

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 생산자 | 계약 | 소비자 | 검증 |
|--------|------|--------|------|
| `packages/core/src/scroll-container.ts` | `@guksu/wvkit-core/scroll-container` — `createScrollContainer` 값 + 타입 3종 | react/vue `use-scroll-container.ts`(값+타입), 문서 Core 샘플 | AC-4/AC-6, 스크립트 검사 3a/3b |
| `packages/core/src/index.ts` (배럴) | three 무참조 — 값은 non-three 5종 + `WebviewHeadlessError`, ScrollContainer 타입만 | three 미설치 CJS/ESM 소비자, react/vue 배럴 type re-export, 데모의 `ScrollContainerDirection` | AC-1b 검사 1a/2a, AC-2/AC-3, TC-B02-2 |
| `packages/react/src/scroll-container.ts` / `packages/vue/src/scroll-container.ts` | `@guksu/wvkit-{react,vue}/scroll-container` — `useScrollContainer` | `ScrollContainerDemo.tsx`, 문서 React/Vue 샘플 | AC-7/AC-10/AC-14, 스크립트 검사 4b(코어 인라인 방지) |
| 데모(react-example) | e2e 픽스처 구동 UI 불변 | `e2e/specs/scroll-container.*.spec.ts` 4종 | AC-11 (45 passed) |
| `scroll-container.ts` destroyed 가드 | destroy 후 scrollTo/zoomTo 완전 no-op (상태·콜백·DOM 불변) | react/vue 어댑터 언마운트 후 명령형 메서드 | AC-13b (TC-B13-1~3) |

## AC별 결과 (2026-07-10 실행, 리포 루트)

| # | 결과 | 비고 |
|---|------|------|
| AC-1a (red) | ✅ exit 1 | 구현 전 8건 실패 — 배럴 `Cannot find module 'three'` 검출 (P0 재현) |
| AC-1b (green) | ✅ exit 0 | 12건 전부 ok |
| AC-2 | ✅ exit 1 (무매치) | dist/index.cjs에 `require('three')` 부재 |
| AC-3 | ✅ exit 1 (무매치) | dist/index.js에 three import 부재 |
| AC-4 | ✅ exit 0 | subpath CJS에서 createScrollContainer 함수 |
| AC-5 | ✅ exit 0 | pnpm typecheck 6 tasks |
| AC-6 | ✅ exit 0 | TC-B02-1/2 통과 표기 (--reporter=verbose) |
| AC-7 | ✅ exit 0 | core→react→vue 순차 빌드 후 어댑터 테스트 |
| AC-8 | ✅ exit 0 | pnpm test 전 패키지 |
| AC-9 | ✅ exit 0 | coverage threshold 유지 (camera-control/ptr/stable-input) |
| AC-10 | ✅ exit 0 | react-example vite build |
| AC-11 | ✅ exit 0 | e2e chromium 45 passed / 4 skipped (mobile-only) |
| AC-12 | ✅ exit 0 | `.changeset/20260710-three-decouple.md` 3패키지 minor |
| AC-13a (red) | ✅ exit 1 | 가드 구현 전 TC-B13-1/2/3 3건 실패 (onIndexChange 발화·index 갱신 누수 재현) |
| AC-13b (green) | ✅ exit 0 | TC-B13-1/2/3 통과 표기 (--reporter=verbose) |
| AC-14 | ✅ | 전자 각 파일 ≥1 (1/3/1/3/2건). 후자: 유일 매치가 `sprints/20260710-three-decouple/plan.md:114` — **AC 정의문이 grep 패턴을 자기 인용**한 것. `--exclude-dir=campaign` 시 exit 1(잔존 0), react/vue 배럴 샘플도 잔존 0 |

추가: `pnpm lint` exit 0 (Biome 130 files).

## 트레이드오프·결정

1. **AC-14 자기참조**: plan.md의 AC 명령 문자열 자체가 grep 패턴에 걸린다. 스프린트 산출물(campaign)은 사용자 문서가 아니므로 제외 판정 — plan.md는 planner 산출물이라 수정하지 않았다.
2. **verify 스크립트 임시 디렉토리**: `os.tmpdir()` 기본 + `WVKIT_VERIFY_TMPDIR` env 오버라이드. 샌드박스/CI 환경에서 tmpdir 쓰기 제한 시 탈출구.
3. **격리 스모크의 성공/실패 판정**: 자식 프로세스 exit code 3분류(0=로드+단언 성공 / 1=로드 실패 / 2=단언 실패)로 "three 없어 실패"와 "배럴 값 잔존"을 구분해 오탐 방지.
4. **react/vue subpath 엔트리는 값만 export** (plan 스펙 그대로) — ScrollContainer 타입은 어댑터 배럴 type re-export로 기존 경로 유지 (데모가 실증).
5. **어댑터 tsup external**: `'@guksu/wvkit-core'` 항목이 subpath까지 포괄함을 스크립트 검사 4b로 실증 — external 배열 무변경.

## 다음 작업자 참고

- **B-21 상향 제안**(plan 범위 제외 절): 신규 exports 서브패스가 생겼으므로 publint/attw 검증 우선순위 상향을 리더에게 전달 요망.
- CI 순서: turbo `test.dependsOn: ["^build"]`로 코어 빌드 선행 보장 확인 완료.
- 배럴 `dist/index.d.ts`가 scroll-container 타입 파일을 참조하는 것은 정상 (type-only, 런타임 무관).
