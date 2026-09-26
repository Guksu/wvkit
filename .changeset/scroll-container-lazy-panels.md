---
'@guksu/wvkit-core': minor
'@guksu/wvkit-react': minor
'@guksu/wvkit-vue': minor
---

ScrollContainer: 패널이 렌더 창에 들어오고 나갈 때 알리는 `onPanelVisibilityChange`, 컴포넌트의 지연 마운트 `lazy`.

- core: 옵션 `onPanelVisibilityChange(index, visible, panel)` 추가. 패널이 렌더 창(쉴 때 화면에 보이는 패널 + 양쪽 `overscan`)에 들어오면 `true`, 나가면 `false`. 한 번도 들어온 적 없는 패널은 들어올 때까지 알리지 않고, `setPanels` 로 빠진 패널도 알리지 않는다. 콜백만 바꾸면 다시 배치하지 않는다.
- react·vue 훅: 같은 콜백을 최신 값으로 부른다 (바꿔도 `setOptions` 를 부르지 않는다).
- react·vue 컴포넌트: `<ScrollContainer lazy>` — 각 패널 내용을 그 패널이 처음 렌더 창에 들어올 때 마운트하고 그 뒤로 유지한다. 기본값 `false` 는 지금과 같다(모든 패널 내용을 처음부터 마운트). React 는 `onPanelVisibilityChange` prop, Vue 는 `@panel-visibility-change` 이벤트.
- 문서: 창 밖 패널이 "문서에서 떼어진다"는 틀린 설명을 바로잡는다 (한 번도 보인 적 없는 패널만 떼어져 있고, 나머지는 `display: none`).
