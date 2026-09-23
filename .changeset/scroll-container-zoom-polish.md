---
'@guksu/wvkit-core': minor
---

ScrollContainer: 줌 마무리 — 줌 상태 교차 축 pan, 더블탭 줌(`doubleTapZoom`), min/max 줌 고무줄, 핀치 앵커 좌표 수정.

- 줌 상태(zoom > 1)에서 한 손가락 pan이 교차 축(horizontal이면 Y)으로도 움직인다. 범위는 패널의 교차 축 반폭 `(crossSize/2)(1 − 1/zoom)`, 밖은 엣지 저항, 릴리스 시 관성 투영을 범위 안으로 잘라 감속. zoom ≤ 1이면 기존처럼 고정.
- 새 옵션 `doubleTapZoom?: number | false` (기본 `false`): 더블탭으로 `minZoom` ↔ 지정 레벨 토글. 확대는 탭한 지점 고정, 축소는 패널 중심. `(minZoom, maxZoom]` 밖이면 `WebviewHeadlessError`.
- 핀치가 `minZoom`/`maxZoom`을 넘으면 `applyZoomResistance`(배율 공간, `resistance` 지수)로 감쇠해 따라가다 마지막 손가락을 떼면 경계로 복귀. `onZoomChange`는 항상 범위 안 값. `resistance: 0`이면 기존 하드 클램프.
- 수정: 핀치·더블탭 앵커가 `clientX/Y`를 그대로 써서 호스트가 페이지 (0,0)에 있지 않으면 확대 중심이 어긋났다. 제스처 시작 시 호스트 rect를 읽어 로컬 좌표로 계산한다.
- 수정: 줌 트윈(`zoomTo`·더블탭)이 탭으로 끊기면 줌이 중간값에 남았다. 릴리스가 마지막으로 정한 줌으로 이어간다.
