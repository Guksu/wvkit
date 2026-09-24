---
'@guksu/wvkit-core': minor
'@guksu/wvkit-react': minor
'@guksu/wvkit-vue': minor
---

ScrollContainer: 다시 마운트하지 않고 패널·옵션 바꾸기 — `setPanels(panels)`, `setOptions(changes)`.

- core: 인스턴스에 `setPanels`·`setOptions` 추가 (새 타입 `ScrollContainerOptionsUpdate`). `direction` 을 포함해 모든 옵션을 바꿀 수 있다 (`initialIndex` 는 마운트 때만). `undefined` 를 주면 기본값으로.
  - 보던 패널이 남아 있으면 화면에 그대로(줌·pan 위치 포함), 번호가 바뀌면 `onIndexChange`. 지워졌으면 같은 번호 자리의 패널.
  - 남는 패널은 문서에서 떼지 않아 스크롤 위치가 유지된다. 빠진 패널은 떼고 인라인 스타일·ARIA 속성을 되돌린다.
  - 같은 값·새 콜백·같은 배치를 내는 새 함수면 아무 일도 하지 않는다. 바뀐 것이 있으면 진행 중인 제스처·애니메이션을 멈추고, 줌은 새 범위 안으로.
  - 잘못된 값이면 DOM 을 바꾸기 전에 `WebviewHeadlessError`. 같은 요소가 두 번 든 `panels` 는 생성 때도 오류.
  - 키보드를 켜고 끌 때만 호스트 `tabindex` 를 붙이고 떼어, 다른 옵션을 바꿔도 포커스를 잃지 않는다.
- react: `useScrollContainer` 가 렌더마다 옵션을 비교해 바뀐 키만 `setOptions` 로 넘긴다. 패널 배열은 요소 단위로 비교. 더 이상 `key` 로 다시 마운트할 필요가 없다.
- vue: `useScrollContainer` 가 `MaybeRefOrGetter<ScrollContainerOptions>` 를 받는다. `reactive`·`ref`·getter 를 넘기면 바뀐 키를 `setOptions` 로 넘긴다. 보통 객체는 이전처럼 마운트 때 한 번 읽는다.
- 번들: core brotli 7.15 kB → 7.71 kB. size-limit 한도 7.5 KB → 8 KB.
