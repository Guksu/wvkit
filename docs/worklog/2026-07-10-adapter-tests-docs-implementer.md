# Sprint 6 구현 — 어댑터 실질화 테스트 + README 문서 진입로 + 커뮤니티 헬스

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-10 |
| 작성 | implementer |
| 관련 경로 | packages/react/src/components/*/__tests__/, packages/vue/src/components/*/__tests__/, README.md, README.ko.md, CONTRIBUTING.md, .github/ |

## 1. 개요

star-readiness 캠페인 Sprint 6 (B-09·B-14b·B-15). react/vue 어댑터 테스트가 smoke(`not.toThrow`) 수준이라는 감사 지적(audit-unit-tests P1)에 따라 StrictMode 이중 마운트·rerender 콜백 최신화·unmount destroy 실효를 관측 가능한 부수효과로 단언하는 테스트 12건을 추가하고, README 문서 진입로(EN/KO)와 GitHub 커뮤니티 헬스 파일 4종을 신설했다.

## 2. 작업내용

- React B-09 테스트 8건(A1~A8) — scroll-container(A1/A5)·pull-to-refresh(A2/A4/A6)·stable-input(A3/A7)·virtual-keyboard(A8) 기존 테스트 파일에 `[B-09]` 태그 describe 블록 추가(기존 케이스 무삭제). 착수 시점 A1이 happy-dom의 `:scope` 셀렉터 미지원으로 Red — 단언 의도 유지한 채 children 순회로 교체해 Green.
- Vue B-09 테스트 4건(A9~A12) — unmount 후 destroy 실효(리스너 제거·DOM 정리·명령형 메서드 noop) 검증. Vue는 StrictMode/rerender 개념 없음(plan 명시)이라 destroy 계약으로 한정.
- `README.md`/`README.ko.md` — `## Documentation`/`## 문서` 섹션 신설(docs/components 6종 리포 상대 링크 테이블), Development 섹션에 CONTRIBUTING.md 링크 추가. 기존 섹션 무변경.
- 신규: `CONTRIBUTING.md`(셋업·빌드·테스트·e2e·PR-기반 changeset 흐름·컨벤션·실패키지명), `.github/ISSUE_TEMPLATE/bug_report.yml`·`feature_request.yml`(issue form), `.github/PULL_REQUEST_TEMPLATE.md`(체크리스트).
- 검증: AC-01~AC-12 전부 exit 0 + `pnpm build` 통과. 상세는 sprints/20260710-adapter-tests-docs/dev-notes.md.

## 3. 주의사항

- changeset 미작성 — 테스트·문서·커뮤니티 파일만 변경, 배포 패키지 런타임 무변경.
- SafeArea·ScrollLock 어댑터의 잔여 smoke 단언은 B-22 소관(이번 범위 제외).
- A8/A12의 window 폴백 짝 맞춤은 프레임워크 내부 리스너 노이즈 회피를 위해 `'resize'` 타입만 필터 — core가 window에 다른 타입을 추가하면 테스트도 갱신 필요.
- B-09 grep 검증은 반드시 `--reporter=verbose`(non-TTY에서 기본 리포터는 통과 타이틀 미출력).
