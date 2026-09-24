---
'@guksu/wvkit-core': minor
---

ScrollContainer: 패널 폭·간격·정렬 옵션. 새 옵션 `panelWidth`, `gap`, `align`. 주지 않으면 이전과 같은 배치·동작.

- `panelWidth`: 가로 패널 폭. `(0, 1]`은 호스트 폭 비율, 1 초과는 px, 함수 `(index) => number`는 패널마다. 각 패널의 인라인 `width`에 쓰고 `destroy()` 때 원래 값으로 되돌린다. 1보다 작게 주면 양옆 패널이 가장자리에 보인다(피킹).
- `gap`: 이웃 패널 사이 간격(px). 가로·세로 모두.
- `align: 'center' | 'start'` (기본 `'center'`): 활성 패널을 가운데에 두거나, 시작 가장자리를 호스트 시작 가장자리에 붙인다.
- 한 제스처에 한 칸은 그대로. `snapThreshold`와 플릭 가중치는 호스트 폭 대신 두 정착 위치 사이 거리(패널 폭 + `gap`)로 잰다.
- 가상화는 활성 패널이 멈춘 위치에서 화면에 보이는 패널 + 양쪽 `overscan`을 붙인다. 전폭 패널이면 이전과 같다.
- 잘못된 `panelWidth`(0 이하·유한하지 않음, 함수가 돌려준 값 포함)와 `gap`(음수·유한하지 않음)은 생성 시 `WebviewHeadlessError`. `panelWidth` 함수 검사는 DOM 을 바꾸기 전에 한다.
- 번들: brotli 6.25 kB → 6.83 kB. size-limit 한도 6.5 KB → 7 KB.
