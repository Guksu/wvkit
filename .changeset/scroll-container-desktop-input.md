---
'@guksu/wvkit-core': minor
---

ScrollContainer: 데스크톱 입력(휠·트랙패드·키보드)과 ARIA. 새 옵션 `wheel` · `keyboard` · `a11y` (모두 기본 `true`).

- 휠·트랙패드: 페이저 축 방향 휠 제스처(120ms 안에 이어지는 이벤트) 하나에 한 패널(누적 40px). 교차 축 성분이 더 크거나 그 방향으로 더 스크롤할 수 있는 중첩 스크롤러 위면 네이티브에 맡긴다. 줌 상태에서는 카메라 pan, `Ctrl` + 휠(트랙패드 핀치)은 커서 고정 줌. 소비한 휠만 `preventDefault`.
- 키보드: 호스트 자신에 포커스가 있을 때 축 방향 화살표(이전/다음), `Home`/`End`, `Escape`(줌 상태면 `minZoom`). 호스트에 `tabindex`가 없으면 `0`을 주고 destroy 시 제거.
- ARIA(APG 캐러셀 패턴): 호스트 `role="group"` + `aria-roledescription="carousel"`, 패널 `role="group"` + `aria-roledescription="slide"` + `aria-label="n / N"`, 비활성 패널 `aria-hidden` + `inert`. 이미 있는 속성은 유지, destroy 시 복원.
- 수정: 포인터 캡처를 down 즉시가 아니라 3px 움직인 뒤에 잡는다. 이전에는 캡처 때문에 호환 마우스 이벤트가 호스트로 향해 `click`이 호스트에서 발화했고, 패널 안 버튼을 마우스로 클릭할 수 없었다(터치 탭은 click을 따로 합성해 영향이 없었다).
- CameraControl에 `panBy(dx, dy)`·`zoomBy(factor, sx, sy)` 추가 (내부 API).
- 번들: brotli 4.58 kB → 5.75 kB. size-limit 한도를 5 KB → 6 KB로 올렸다.
