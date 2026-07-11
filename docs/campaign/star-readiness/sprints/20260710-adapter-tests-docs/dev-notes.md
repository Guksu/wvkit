# dev-notes — Sprint 6 (20260710-adapter-tests-docs)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 백로그 | B-09 (어댑터 실질화) · B-14b (README 문서 진입로) · B-15 (커뮤니티 헬스) |
| 브랜치 | sprint/20260710-adapter-tests-docs |

## 변경 파일

### T-01 (B-09) — React 어댑터 실질화 테스트 8건 (A1~A8)

- `packages/react/src/components/scroll-container/__tests__/use-scroll-container.test.tsx` — A1(StrictMode renderer DOM 1세트), A5(rerender 콜백 최신화)
- `packages/react/src/components/pull-to-refresh/__tests__/use-pull-to-refresh.test.tsx` — A2(StrictMode 리스너 1세트), A4(rerender 콜백 최신화), A6(unmount 리스너 제거 + overscrollBehavior 복원)
- `packages/react/src/components/stable-input/__tests__/use-stable-input.test.tsx` — A3(StrictMode 인풋 2개), A7(unmount 인풋 0개)
- `packages/react/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts` — A8(add/remove 짝 맞춤, visualViewport 경로 + window 폴백 경로)

### T-02 (B-09) — Vue 어댑터 실질화 테스트 4건 (A9~A12)

- `packages/vue/src/components/pull-to-refresh/__tests__/use-pull-to-refresh.test.ts` — A9(unmount 후 제스처 미발화 + overscrollBehavior 복원)
- `packages/vue/src/components/stable-input/__tests__/use-stable-input.test.ts` — A10(unmount 후 인풋 0개)
- `packages/vue/src/components/scroll-container/__tests__/use-scroll-container.test.ts` — A11(unmount 후 scrollTo noop — onIndexChange 미발화, activeIndex ref 불변)
- `packages/vue/src/components/virtual-keyboard/__tests__/use-virtual-keyboard.test.ts` — A12(add/remove 짝 맞춤, vv + window 폴백)

### T-03 (B-14b) — README 문서 진입로

- `README.md` — `## Features`와 `## Installation` 사이 `## Documentation` 신설(6종 테이블, 리포 상대 경로), `## Development` 말미 CONTRIBUTING.md 링크 1줄. 기존 섹션 무변경(추가만).
- `README.ko.md` — 동일 위치 `## 문서` + CONTRIBUTING.md 링크.

### T-04 (B-15) — 커뮤니티 헬스 4종 (신규)

- `CONTRIBUTING.md` — 셋업/빌드/테스트(test:e2e + playwright install)/린트·타입/PR-기반 changeset 흐름(d69ff57)/코드 컨벤션/`@guksu/wvkit-*` 실패키지명/TESTING.md 링크
- `.github/ISSUE_TEMPLATE/bug_report.yml` — issue form (패키지 드롭다운·버전·환경·재현·기대/실제)
- `.github/ISSUE_TEMPLATE/feature_request.yml` — issue form (문제 배경·제안 API·대안)
- `.github/PULL_REQUEST_TEMPLATE.md` — 체크리스트(테스트·lint·typecheck·changeset·문서)

## 생산자 ↔ 소비자 매핑 (qa 교차검증 입력)

| 경계면 | 생산자 | 소비자(테스트 관측점) | 검증 케이스 |
|--------|--------|----------------------|-------------|
| core destroy ↔ react effect cleanup | `packages/core/src/components/*/` destroy | renderer DOM 수(A1), overscrollBehavior + onPull 호출 수(A2/A6), input 수(A3/A7) | A1~A3, A6~A7 |
| react optionsRef ↔ 사용자 콜백 | `use-pull-to-refresh.ts:40-42`, `use-scroll-container.ts:34-36` | rerender 후 신/구 vi.fn 호출 수 | A4, A5 |
| core listeners 배열 ↔ virtual-keyboard 훅 | core `virtual-keyboard.ts` addListener/destroy | vv 목 add/remove 콜 짝 맞춤 + window 'resize' 폴백 | A8, A12 |
| core destroy ↔ vue onUnmounted | 동일 core | unmount 후 제스처/scrollTo 미발화, input 0개 | A9~A11 |
| README ↔ docs/components | README 양본 Documentation 섹션 | 6종 `docs/components/{slug}/index.md` 실존 확인(AC-05/06 스크립트) | AC-05, AC-06 |
| CONTRIBUTING ↔ 개발 인프라 | CONTRIBUTING.md | CLAUDE.md 주요 커맨드·PR-기반 changeset 흐름과 일치 | AC-08 |

## 실행한 검증 명령과 결과

| AC | 명령 | 결과 |
|----|------|------|
| AC-01 | `pnpm test` | exit 0 |
| AC-02 | react vitest verbose + `grep -c '\[B-09\]'` | 8 (≥8) |
| AC-03 | `pnpm --filter @guksu/wvkit-vue test` | exit 0 |
| AC-04 | vue vitest verbose + `grep -c '\[B-09\]'` | 4 (≥4) |
| AC-05/06 | README 섹션 + 6종 링크 + 실존 검사 | exit 0 |
| AC-07~10 | 커뮤니티 파일 실존 + 내용 grep | exit 0 |
| AC-11 | `pnpm lint` | exit 0 |
| AC-12 | `pnpm typecheck` | exit 0 |
| (추가) | `pnpm build` | exit 0 |

## 트레이드오프 / 특기사항

1. **A1 셀렉터 교체**: 착수 시점에 A1이 `querySelectorAll(':scope > div')`로 실패(Red) 상태였음 — happy-dom이 `:scope` 셀렉터를 미지원해 0을 반환. 단언 의도(renderer DOM 정확히 1세트)를 유지한 채 `children` 직접 순회 + tagName 필터로 교체(Green). 구현 결함 아님.
2. **A8/A12 window 폴백 노이즈 회피**: window spy는 React/Vue 내부 리스너가 섞이므로 core가 사용하는 `'resize'` 타입만 필터해 짝 맞춤. visualViewport 목 경로는 전체 (type, handler) 짝 맞춤 + 수량 일치까지 단언.
3. **A9/A11 사전 계약 확인**: unmount 전 제스처/scrollTo가 실제 콜백을 발화함을 먼저 단언(껍데기 단언 방지 — "원래부터 안 불리는" 위양성 차단).
4. **changeset 없음**: 변경은 테스트 + 문서 + 커뮤니티 파일만 — 배포 패키지 런타임 동작 무변경.
5. **잔여 smoke**: SafeArea·ScrollLock 어댑터의 `not.toThrow` 잔존은 B-22 소관(범위 제외 준수).
6. **테스트가 드러낸 core/어댑터 결함 없음** — 어댑터·core 소스 수정 0건.
