---
'@guksu/wvkit-core': minor
---

ScrollContainer: 릴리스 관성 — 스냅 트윈 시간이 놓는 속도에 이어지고, 줌 상태 pan은 감속 투영으로 멈출 위치를 정한다.

- 릴리스 트윈 시간 `snapDurationMs`: ease-out 초기 속도가 손가락 속도와 같도록 `3 × 거리 / 속도`, 120ms ~ 거리 비례 상한 400ms(줌 상태 자유 pan 800ms). 정지 릴리스·목표 반대 방향 속도는 상한 사용. 이전에는 항상 300ms 고정.
- 줌 상태(zoom > 1) 릴리스: 패널 안에서 놓으면 `projectInertia`(iOS 감속 0.998/ms, 이동거리 = 속도 × 500)로 구한 정지점까지 감속하되 그 패널 가장자리를 넘지 않는다 (관성만으로 페이지 전환 없음). 가장자리 밖(gap·저항 구간)에서 놓으면 기존처럼 방향·속도로 스냅.
- 페이저(zoom ≤ 1)의 목표 결정(`decideSnapTarget`, 한 제스처 최대 한 패널)은 그대로. `scrollTo`/`zoomTo`의 `animated: true`는 고정 300ms 유지.
