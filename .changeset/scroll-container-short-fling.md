---
'@guksu/wvkit-core': patch
---

ScrollContainer: 짧고 빠른 플릭으로 한 칸 넘기기 (Android ViewPager 의 플릭 조건).

- zoom ≤ 1 에서 손가락이 누른 지점부터 25px 넘게 움직였고 놓는 속도가 0.4px/ms(400dp/s)를 넘으면, 끈 거리와 상관없이 플릭 방향으로 한 칸 넘긴다. 끌던 방향과 반대로 튕기면 제자리 (ViewPager `determineTargetPage` 와 같음).
- 조건을 넘지 못하면 이전처럼 `snapThreshold` 거리 비율(+ 속도 가중치)로 정한다. 한 제스처에 한 칸은 그대로.
- 실측(실제 터치, Pixel 7 에뮬레이션, 412px): 30px·0.45px/ms, 40px·0.6px/ms, 60px·0.9px/ms 플릭이 제자리 → 한 칸. 40px·0.24px/ms 는 그대로 제자리. 이전에는 약 130px 를 움직여야 넘어갔다.
