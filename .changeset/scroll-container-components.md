---
'@guksu/wvkit-react': minor
'@guksu/wvkit-vue': minor
---

ScrollContainer: React·Vue 컴포넌트 `ScrollContainer` + `ScrollPanel` 추가 — `panels` 배열 대신 패널을 자식으로 쓴다.

- 패널 순서는 코드에 쓴 순서. 조건부 패널·감싼 컴포넌트도 그 순서를 따른다. 패널을 넣고 빼면 `setPanels` 와 같게 보던 패널과 남는 패널의 스크롤 위치가 유지된다.
- `panels` 를 뺀 모든 옵션이 prop. 바뀐 prop 은 `setOptions` 로 넘겨 다시 마운트하지 않는다. `initialIndex` 는 첫 패널이 생길 때 한 번 읽는다.
- `ScrollContainer` 의 속성은 호스트 요소에, `ScrollPanel` 의 속성은 패널 안 내용 요소(`height: 100%`)에 붙는다. `ScrollPanel` 의 `label` 은 패널 요소의 `aria-label`.
- `ref` 핸들 `ScrollContainerHandle`: `scrollTo`·`zoomTo`·`getActiveIndex`·`getZoom`. 제어형 `activeIndex` prop 은 없다 (`onIndexChange` / `@index-change` 로 상태를 들고 `scrollTo` 로 옮긴다).
- 패널이 없으면 인스턴스를 만들지 않는다. SSR 에서는 패널 내용을 그리지 않고 브라우저에서 마운트된 뒤 그린다.
- react: 패널 내용을 `createPortal` 로 그리므로 peer dependency 에 `react-dom` (>=18) 추가. vue: `Teleport` 사용.
- 번들 (size-limit, brotli, core·프레임워크 제외): React 컴포넌트 1.2 kB, Vue 컴포넌트 1.27 kB. 훅만 가져오면 컴포넌트 코드는 들어가지 않는다 (React 훅 526 B, Vue 훅 548 B).
