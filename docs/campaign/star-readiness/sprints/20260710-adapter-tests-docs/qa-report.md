# qa-report — Sprint 6 (20260710-adapter-tests-docs)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 검증자 | qa |
| 브랜치 | sprint/20260710-adapter-tests-docs (실측 — plan.md 표기는 chore/quality-sprint-1, 아래 특기사항 참조) |
| 판정 | **전 항목 PASS (12/12)** — FAIL 0건 |

## 1. 인수조건 판정 (전부 직접 재실행 — exit code 기준)

| AC | 내용 | 실행 결과 | 판정 |
|----|------|-----------|------|
| AC-01 | `pnpm test` 전 패키지 + core 커버리지 threshold | 최초 실행은 turbo FULL TURBO(6/6 cached) → **`turbo run test --force`로 캐시 무시 재실행: 6 tasks 성공, exit 0** | **[PASS]** |
| AC-02 | React B-09 케이스 ≥8 존재·통과 | `vitest run --reporter=verbose` exit 0, `grep -c '\[B-09\]'` = **8** (A1~A8 전부 ✓ 통과 타이틀 확인) | **[PASS]** |
| AC-03 | `pnpm --filter @guksu/wvkit-vue test` | vitest 직접 실행 exit 0 | **[PASS]** |
| AC-04 | Vue B-09 케이스 ≥4 존재·통과 | verbose grep = **4** (A9~A12 전부 ✓), exit 0 | **[PASS]** |
| AC-05 | README.md `## Documentation` + 6종 링크 + 링크 대상 실존 | plan 스크립트 그대로 실행, exit 0 | **[PASS]** |
| AC-06 | README.ko.md `## 문서` + 6종 링크 | plan 스크립트 그대로 실행, exit 0 | **[PASS]** |
| AC-07 | 커뮤니티 파일 4종 실존 | exit 0 | **[PASS]** |
| AC-08 | CONTRIBUTING 필수 내용 (TESTING.md/changeset/test:e2e/@guksu/wvkit) | exit 0 | **[PASS]** |
| AC-09 | 이슈 템플릿 issue form 구조 (`name:`/`body:`) | exit 0 | **[PASS]** |
| AC-10 | PR 템플릿 changeset + `- [ ]` 체크리스트 | exit 0 | **[PASS]** |
| AC-11 | `pnpm lint` | biome 132 files, exit 0 | **[PASS]** |
| AC-12 | `pnpm typecheck` | exit 0 | **[PASS]** |

## 2. 껍데기 단언 판정 (B-09 신규 12건 전수 소스 리뷰)

**전부 load-bearing.** 판정 근거:

| 케이스 | 관측점 (수치/부수효과 단언) | 판정 |
|--------|------------------------------|------|
| A1 (react SC StrictMode) | `containerDiv.children.length === 1` + DIV 필터 `toHaveLength(1)` — 이중 attach면 2 | 실질 |
| A2 (react PTR StrictMode) | `onPull` 정확히 1회 + `'pulling'` 전이 정확히 1회 — 이중 등록이면 2회 | 실질 |
| A3 (react SI StrictMode) | container 내 input 1 + body 직접 자식 input 1 + `document.querySelectorAll('input')` 총 2 — 누수면 4 | 실질 |
| A4 (react PTR rerender) | 신 콜백 호출 + 구 콜백 `toHaveBeenCalledTimes(0)` ×2 — stale closure 직접 검출 | 실질 |
| A5 (react SC rerender) | 신 `onIndexChange(1)` + 구 콜백 0회 | 실질 |
| A6 (react PTR unmount) | `overscrollBehavior === ''` 복원 + unmount 후 제스처에 콜백 0회 (unmount 전 'contain' 사전 단언) | 실질 |
| A7 (react SI unmount) | unmount 전 input 2 → 후 0 수치 단언 | 실질 |
| A8 (react VK unmount) | (type, handler) 짝 맞춤 + `vvRemoved.length === vvAdded.length` 수량 일치 + 등록 ≥2 사전 단언 + window 'resize' 폴백 경로 별도 검증 | 실질 |
| A9 (vue PTR unmount) | unmount 전 제스처 발화 사전 단언(위양성 차단) → mockClear → unmount 후 0회 + `''` 복원 | 실질 |
| A10 (vue SI unmount) | 전 2개 → 후 0개 수치 단언 | 실질 |
| A11 (vue SC noop) | unmount 전 `scrollTo(2)` 발화 확인 → unmount 후 `scrollTo(1)` 콜백 0회 + `activeIndex.value === 2` 불변 | 실질 |
| A12 (vue VK unmount) | A8과 동일한 짝 맞춤 + 수량 일치 + 폴백 경로 | 실질 |

공통 강점: A2/A9/A11은 "원래부터 안 불리는" 위양성을 사전 단언으로 차단(dev-notes 특기사항 3 소스로 확인). A8/A12는 등록 자체가 ≥2임을 먼저 단언해 목이 빈 상태로 통과하는 껍데기를 방지.

## 3. 경계면 교차검증 (dev-notes 매핑 ↔ 소스 대조)

| 경계면 | 대조 결과 | 판정 |
|--------|-----------|------|
| react optionsRef 최신화 | `use-pull-to-refresh.ts:39-42`·`use-scroll-container.ts:33-36`에서 매 렌더 `optionsRef.current = options`, 콜백은 `optionsRef.current.onX?.()` 경유(:52,:56,:61,:66) — A4/A5 단언 대상과 일치 | **[PASS]** |
| StrictMode-안전 cleanup | 양 훅 effect cleanup에서 `instance.destroy()` + 동일 인스턴스 확인 후 null (`use-pull-to-refresh.ts:75-81`, `use-scroll-container.ts:66-72`) — A1~A3 관측점과 일치 | **[PASS]** |
| core stable-input destroy | `stable-input.ts` destroy: 리스너 전부 off + `displayInput.remove()` + `hiddenInput.remove()` — A3/A7/A10의 "input 0개" 단언이 실제 계약 | **[PASS]** |
| core virtual-keyboard 리스너 | `virtual-keyboard.ts:57-58` vv에 resize+scroll 2건, :60 window 'resize' 폴백, :15-16 add/remove 짝 저장 — A8/A12의 "≥2 + 짝 맞춤 + 폴백" 단언이 소스와 정확히 대응 | **[PASS]** |
| vue noop 가드 | `use-scroll-container.ts:60-63` `onUnmounted`에서 destroy + `instance = null`, `scrollTo`는 `instance?.` 가드(:65-67) — A11 단언 대상과 일치 | **[PASS]** |
| README ↔ docs/components | `## Documentation`(EN :43) / `## 문서`(KO :43) 모두 Features(:30)와 Installation/설치(:58) 사이 — plan 요구 위치 정확. 6종 링크 전부 실존 파일. CONTRIBUTING 링크는 Development/개발 섹션(:321) 내부 | **[PASS]** |
| CONTRIBUTING ↔ 개발 인프라 | 커맨드가 CLAUDE.md 주요 커맨드와 일치(pnpm install/build/dev/test/test:e2e/lint/typecheck), PR-기반 changeset 흐름(d69ff57) 정확 반영, `@guksu/wvkit-*` 실패키지명 사용, `TESTING.md` 실존 링크, 리포 URL은 origin(`github.com/Guksu/wvkit`)·homepage 필드와 일치 | **[PASS]** |
| 이슈/PR 템플릿 ↔ GitHub UI | bug_report.yml: 패키지 드롭다운(core/react/vue)·버전·환경(iOS Safari/WKWebView/Android WebView 등)·재현·기대/실제 전부 존재. feature_request.yml: 문제 배경·제안 API·대안. PR 템플릿: 테스트/lint/typecheck/changeset 체크박스 | **[PASS]** |

## 4. 컨벤션·범위 점검

- **기존 케이스 삭제 금지**: 테스트 파일 삭제 라인은 import 병합 1건뿐(`import { render }` → `import { render, act }`) — 기존 케이스 전부 보존. **[PASS]**
- **코드(비테스트) 변경 없음**: 어댑터/core 소스 diff 0건 — dev-notes 특기사항 6과 일치. 범위 제외(core 동작 변경 금지) 준수. **[PASS]**
- **changeset 불필요 판단 타당**: 런타임 무변경(테스트+문서+커뮤니티 파일만). **[PASS]**
- **범위 제외 준수**: SafeArea/ScrollLock의 `not.toThrow` 잔존은 B-22 소관으로 미착수 — plan과 일치. **[PASS]**

## 5. 특기사항 (FAIL 아님 — 리더 참고)

1. **브랜치 표기 불일치**: plan.md·공통 컨텍스트는 `chore/quality-sprint-1`, 실제 작업 브랜치는 `sprint/20260710-adapter-tests-docs`(dev-notes 표기와 일치). git 운영은 사용자 전담이므로 판정 외 — 머지 경로만 리더가 확인 요망.
2. **turbo 캐시**: `pnpm test`·`pnpm lint`·`pnpm typecheck`는 turbo 캐시 히트 가능 — 본 QA는 test를 `--force`로 강제 재실행해 판정했고, lint는 biome 직접 실행 로그(132 files) 확인.
3. **잔여 smoke(범위 외)**: vue stable-input 기존 케이스 "onChange 콜백이 위임된다"가 `if (hiddenInput)` 가드로 조건부 단언 — hiddenInput 미발견 시 아무것도 검증하지 않고 통과. B-22 전수 정리 시 우선 대상으로 추천.

## 6. 결론

Sprint 6 인수조건 12건 전부 PASS. 신규 테스트 12건은 껍데기 없이 전부 관측 가능한 부수효과를 수치로 단언하며, dev-notes의 경계면 매핑이 소스와 정확히 일치한다. 수정 요청 0건.
