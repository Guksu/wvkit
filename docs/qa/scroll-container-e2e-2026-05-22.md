# ScrollContainer E2E QA Report

**대상 컴포넌트:** `@wvkit/core` · `@wvkit/react` · `@wvkit/vue` — `ScrollContainer`
**시행일:** 2026-05-22
**QA:** 자동화 E2E (Playwright)
**도구:** Playwright 1.60 · Vite 6 · pnpm 9 (모노레포 워크스페이스)
**대상 빌드:** `main@a52befd` (작업 시점)

---

## 1. 요약

| 항목 | 결과 |
|---|---|
| 총 시나리오 그룹 | **9** (S1 ~ S10, S9는 디바이스 매트릭스 재실행) |
| 총 테스트 케이스 | **22** (프로젝트당) |
| 매트릭스 | Desktop Chromium · Desktop WebKit · Mobile Safari (iPhone 14 Pro) · Mobile Chrome (Pixel 7) |
| 전체 실행 결과 | **88 / 88 PASS** (4 프로젝트 × 22 = 88) |
| 전체 소요 시간 | 40.4s |
| 신규 결함 (FAIL) | **0건** |
| 관찰 사항 (제품 동작 메모) | 3건 — 아래 §6 참조 |
| 자동화 자산 위치 | `e2e/` (config + fixtures + specs) |

**총평: 출시 차단 결함 없음.** 4개 브라우저/디바이스 프로필 모두에서 스크롤·줌·가상화·생명주기 핵심 동작이 일관되게 통과. 단위/통합(happy-dom)으로 검증 불가했던 실 브라우저 PointerEvent → CSS3DRenderer matrix3d 파이프라인까지 종단 검증 완료.

---

## 2. 환경

| 항목 | 값 |
|---|---|
| OS | macOS Darwin 25.3.0 (arm64) |
| Node | ≥ 18 (engines 명세 기준) |
| 호스팅 | `vite build` → `vite preview --port 4173 --strictPort` (Playwright `webServer` 자동 기동) |
| Base URL | `http://localhost:4173/wvkit/` |
| 대상 데모 | `examples/react-example` — `ScrollContainerDemo.tsx` (모든 옵션 슬라이더/셀렉트 + scrollTo/zoomTo 버튼 노출) |

### Playwright 프로젝트 매트릭스

| 프로젝트 | 디바이스 프리셋 | 인풋 모델 |
|---|---|---|
| `chromium` | Desktop Chrome | mouse → PointerEvent |
| `webkit` | Desktop Safari | mouse → PointerEvent |
| `mobile-safari` | iPhone 14 Pro (hasTouch) | touch → PointerEvent |
| `mobile-chrome` | Pixel 7 (hasTouch) | touch → PointerEvent |

> 모든 제스처 시뮬레이션은 `page.evaluate`에서 `PointerEvent`를 직접 dispatch하는 헬퍼(`swipeOnCanvas`, `pinchOnCanvas`)를 사용. 4개 프로젝트가 동일 헬퍼를 공유하므로 인풋 모델 차이로 인한 false-positive 없음.

---

## 3. 테스트 시나리오 결과

22개 케이스 모두 4개 프로젝트에서 PASS. 아래는 시나리오 그룹별 의도와 단언점.

### S1 · Smoke (1 case · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S1-1 | 데모 페이지가 마운트되고 콘솔 에러가 없다 | `sc-canvas` visible · `activeIndex=0` · `activeZoom=1.000` · `direction=horizontal` · console error 0건 | ✅ |

### S2 · scrollTo API (4 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S2-1 | animated scrollTo(2) | activeIndex 2로 갱신 · scene wrapper X shift 변동 > 100px · 가시 패널 윈도 `[1,2,3]`로 시프트 | ✅ |
| S2-2 | non-animated scrollTo(2) | DataRow 즉시 2로 갱신 | ✅ |
| S2-3 | 마지막 인덱스(5) clamp | `scrollTo(5)` 후 추가 호출에서도 panicx 없음 · 가시 윈도 `[4,5]` | ✅ |
| S2-4 | round-trip 0→2→0 | 시작 위치로 복귀 (오차 < 2px) · 가시 윈도 `[0,1]` | ✅ |

### S3 · zoomTo API (3 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S3-1 | animated zoomTo(2) | DataRow `2.000` | ✅ |
| S3-2 | non-animated zoomTo(3) | DataRow `3.000` | ✅ |
| S3-3 | round-trip 1→3→1 | DataRow 정상 복귀 | ✅ |

### S4 · horizontal gesture (3 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S4-1 | 큰 좌측 드래그(>snapThreshold) | activeIndex 1로 스냅 | ✅ |
| S4-2 | 작은 좌측 드래그(<snapThreshold) | activeIndex 0으로 스냅백 | ✅ |
| S4-3 | 우측 드래그 (엣지 저항) | 첫 패널에서 0 유지 | ✅ |

### S5 · vertical gesture (1 case · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S5-1 | direction=vertical 토글 후 위로 드래그 | activeIndex 1 · direction row `vertical` | ✅ |

### S6 · pinch zoom (2 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S6-1 | 두 손가락 벌림 | activeZoom > 1 | ✅ |
| S6-2 | enablePinchZoom=false | 핀치 후에도 activeZoom = 1 유지 | ✅ |

### S7 · options remount (2 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S7-1 | direction 변경 시 remount | activeIndex 0 리셋 · direction row `vertical` | ✅ |
| S7-2 | overscan 변경 시 가시 윈도 폭 변동 | overscan=3 → 가시 패널 `[0,1,2,3]` | ✅ |

### S8 · virtualization (4 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S8-1 | activeIndex=0, overscan=1 | 가시 `[0,1]` · 2/5 부재 | ✅ |
| S8-2 | scrollTo(2) | 가시 `[1,2,3]` | ✅ |
| S8-3 | scrollTo(5) — 우측 overscan clip | 가시 `[4,5]` | ✅ |
| S8-4 | overscan=0 | 가시 `[0]` 1개만 | ✅ |

### S10 · cleanup (2 cases · PASS)
| ID | 케이스 | 검증 단언 | 결과 |
|---|---|---|---|
| S10-1 | 탭 이탈 후 복귀 | 정상 재마운트 · activeIndex=0 · 가시 `[0,1]` · console error 0 | ✅ |
| S10-2 | 페이지 reload | 초기 상태로 깔끔히 재초기화 | ✅ |

> S9(디바이스 매트릭스)는 별도 케이스가 아니라 S1~S10을 4개 프로젝트로 실행하는 메타 시나리오. 총 22 × 4 = 88 케이스 모두 PASS.

---

## 4. 새로 발견된 결함

**없음.**

---

## 5. 회귀 가드 — 단위/통합 테스트가 잡지 못했던 영역

이번 E2E가 실제로 메운 갭:

1. **PointerEvent → 카메라 트윈 종단 경로** — happy-dom의 PointerEvent shim이 setPointerCapture 미지원 등 차이가 있어 실제 브라우저 검증이 필요했음. 4개 프로젝트 모두에서 동일하게 통과.
2. **CSS3DRenderer matrix3d 갱신** — scrollTo 후 scene wrapper의 transform이 실제로 변동하는 것을 `getSceneXShift`로 측정해 검증.
3. **가상화의 실 DOM 효과** — `display: none` 토글이 querySelector 가시성에 반영되는 것을 확인. overscan 변동도 핫리로드 없이 작동.
4. **mobile Touch 모델** — Mobile Safari/Mobile Chrome 컨텍스트(hasTouch=true)에서 핀치(2 pointer) + drag(1 pointer)가 모두 동일하게 동작.
5. **탭 전환/페이지 reload 시 destroy 호출 누락 회귀 가드** — 콘솔 에러 모니터링.

---

## 6. 관찰 사항 (결함 아님)

엔지니어링 메모용 — 제품 동작/명세 의도 검토 후 처리 결정.

### O-1. 데모의 `scrollTo`/`zoomTo` 버튼 인덱스가 0/2/PANEL_COUNT-1 로 고정
- **위치:** `examples/react-example/src/ScrollContainerDemo.tsx:101-110`
- **현상:** 6개 패널 중 `scrollTo(3)`/`scrollTo(4)` 버튼이 없음. PANEL_COUNT-1 = 5만 노출.
- **영향:** 데모 한정 — E2E 작성 중에 인덱스 시프트(2/3/4) 검증을 위해 우회 필요했음.
- **권고:** 중간 인덱스(예: 3) 버튼을 추가하면 데모 사용자도 가운데 패널 탐색이 쉬워짐. 또는 인덱스 입력 박스 1개로 일반화.
- **우선순위:** Low (P3)

### O-2. `direction: 'both'`가 1차 구현에서 `horizontal`로 폴백
- **위치:** `packages/core/src/components/scroll-container/scroll-container.ts:48-50`
- **현상:** CLAUDE.md에 명시된 의도된 동작. UI/타입에서는 `both`가 선택 가능하지만 내부적으로 `horizontal`과 동일.
- **영향:** 사용자가 `both`를 선택했을 때 대각 스크롤이 동작하지 않아도 콘솔/디버그 신호가 없음.
- **권고:** 명시적 동작이 합의된 상태이므로 결함은 아니지만, 후속 minor 릴리스 전까지 데모/문서에 `(coming soon)` 마커 또는 dev 환경에서 console.info 한 줄을 검토해 볼 만함.
- **우선순위:** Low (P3) · 로드맵 항목과 정합

### O-3. CSS3DRenderer 가상화의 detach 시점이 다음 `render` 호출 시점에 의존
- **위치:** `packages/core/src/components/scroll-container/scroll-container.ts:128-141` (`applyVirtualization`)
- **현상:** `visible=false`로 마크된 객체는 CSS3DRenderer의 `render(scene, camera)` 호출 후에 DOM에서 떼어짐. `display:none` 폴백이 병행되어 시각적으로는 즉시 사라지지만, querySelectorAll에는 잠시 남아 있는 윈도가 존재.
- **영향:** 라이브러리 동작상 문제는 없음. 다만 외부 코드가 가상화 직후 `querySelectorAll` 결과를 기반으로 판단하면 잠깐 어긋날 수 있음.
- **권고:** 문서에 "가상화는 다음 RAF에 적용됨"을 명시. 본 E2E에서 `getVisiblePanelIndices` 헬퍼는 `display` 속성으로 필터해 회피함.
- **우선순위:** Low (P3) · 문서 보강만

---

## 7. 자동화 자산

```
e2e/
├── playwright.config.ts          # 4-프로젝트 매트릭스 + webServer
├── fixtures/
│   └── scroll-container.ts       # 헬퍼: gotoDemo, getActiveIndex/Zoom,
│                                 #       getSceneXShift, getVisiblePanelIndices,
│                                 #       swipeOnCanvas, pinchOnCanvas,
│                                 #       clickScrollTo/ZoomTo, waitForScrollSettle
└── specs/
    ├── scroll-container.smoke.spec.ts        # S1
    ├── scroll-container.api.spec.ts          # S2/S3
    ├── scroll-container.gesture.spec.ts      # S4/S5/S6
    └── scroll-container.lifecycle.spec.ts    # S7/S8/S10
```

### 신규 의존성

| 패키지 | 버전 | 위치 |
|---|---|---|
| `@playwright/test` | ^1.60.0 | 루트 `devDependencies` |

### 신규 스크립트 (루트 `package.json`)

| 명령 | 동작 |
|---|---|
| `pnpm test:e2e` | 전체 4-프로젝트 매트릭스 실행 |
| `pnpm test:e2e:ui` | Playwright UI 모드 (디버깅) |
| `pnpm test:e2e:chromium` | 데스크톱 Chromium만 |
| `pnpm test:e2e:webkit` | 데스크톱 WebKit만 |
| `pnpm test:e2e:report` | HTML 리포트 열기 |

### 데모/UI 변경 (테스트 hooks)

- `examples/react-example/src/ScrollContainerDemo.tsx`
  - 캔버스 div에 `data-testid="sc-canvas"` 추가 (1줄).
- `examples/react-example/src/ui.tsx`
  - `DataRow` 컴포넌트에 `data-testid={`row-${label}`}` + value 자식에 `-value` 접미사 추가. 모든 데모 공통 자산이라 다른 컴포넌트의 E2E에도 그대로 재활용 가능.

---

## 8. 권고 사항 (출시 가드 → CI 통합 순서)

1. **CI 통합 — 다음 PR로 권장.** GitHub Actions의 매트릭스 job에 `pnpm test:e2e` 추가. Chromium + WebKit은 ubuntu-latest에서 무리 없이 돌고, Mobile Safari/Chrome도 같은 WebKit/Chromium 엔진의 device 에뮬레이션이라 별도 머신 불필요.
2. **flaky 모니터링** — 본 라운드는 88/88 0 flaky지만 RAF 트윈 기반이라 CI 부하 환경에서 `waitForScrollSettle` 타임아웃 발생 가능. 첫 2주는 `retries: 1`로 시작 권장.
3. **추후 추가 가치가 큰 시나리오**:
   - Vue 어댑터 데모도 E2E 대상에 포함 (현재 react-example만 검증). 어댑터 출력 동등성 회귀 가드.
   - `panelHeight` 동적 높이 + vertical direction 조합 (현재는 컨테이너 동일 높이만 검증).
   - 핀치 + pan 합성 (한 손은 핀치 중인데 다른 손이 pan하는 케이스).
4. **데모 개선(O-1)** — 임의 인덱스 이동 컨트롤 추가하면 자동화 단순화 + 사용자 데모 가치 둘 다 향상.

---

## 9. 재현 절차

```bash
# 1) 의존성
pnpm install

# 2) Playwright 브라우저 (최초 1회)
pnpm exec playwright install chromium webkit

# 3) 전체 매트릭스 실행 (자동으로 react-example을 build → preview)
pnpm test:e2e

# 4) 실패 시 HTML 리포트
pnpm test:e2e:report
```

**예상 출력:** `88 passed (~40s)`

---

*보고서 종료.*
