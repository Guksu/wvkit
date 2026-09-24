---
'@guksu/wvkit-core': minor
---

ScrollContainer: 드래그 시작 여유와 방향 잠금. 새 옵션 `dragThreshold` (기본 10px, `0`이면 이전 동작).

- 포인터가 `dragThreshold`를 넘게 움직이기 전에는 페이저가 움직이지 않는다. 넘는 순간 우세 축(45° 기준)으로 방향을 한 번 정한다 (Android ViewPager 의 `xDiff > mTouchSlop && xDiff > yDiff` 와 같은 규칙).
- zoom ≤ 1 에서 교차 축이 우세하면 그 제스처는 페이저가 무시한다. zoom > 1 은 양 축 자유 pan.
- 터치·펜은 누른 요소의 실제 `touch-action`(가장 가까운 스크롤 컨테이너까지)을 계산해, 정한 방향을 브라우저가 pan 할 터치면 움직이지 않고 `pointercancel`을 기다린다 (`pan-y` 패널의 세로 터치, `pan-x pan-y` 칩 줄의 가로 터치).
- 시작점을 여유만큼 당겨 잡아 튀지 않는다 (ViewPager 의 `mInitialMotionX ± mTouchSlop`). 핀치 뒤 남은 손가락 pan 은 여유 없이 이어간다.
- 포인터 캡처는 드래그가 시작된 뒤에만 잡는다 — 몇 px 흔들린 마우스 클릭도 아래 버튼에 닿는다.
- 실측(실제 터치, Pixel 7 에뮬레이션): 46°·55°·70° 스와이프와 4px 떨린 탭의 가로 흔들림 13.9 / 11.5 / 6.8 / 4px → 모두 0px.
- 번들: brotli 5.81 kB → 6.25 kB. size-limit 한도 6 KB → 6.5 KB.
