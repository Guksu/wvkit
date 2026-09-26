---
'@guksu/wvkit-core': patch
---

ScrollContainer: 스냅 애니메이션 도중에 부른 `zoomTo` 가 활성 패널에 멈춘다.

- 이전에는 그 순간 카메라에 가장 가까운 패널을 기준으로 했다. 그래서 `onIndexChange` 안에서 `zoomTo(1)` 을 부르거나 `scrollTo(i)` 바로 뒤에 `zoomTo` 를 부르면, `activeIndex` 는 새 패널인데 화면은 이전 패널에 멈췄다. 이제 `zoomTo` 는 항상 활성 패널(`getActiveIndex()`) 범위 안으로 카메라를 옮긴다.
- 문서: 새 "레시피" 메뉴와 이미지 뷰어 레시피 (바닐라·React·Vue). 레시피 코드는 예제 페이지의 소스 그대로이고, e2e 가 그 페이지를 Chromium·WebKit·모바일 에뮬레이션에서 확인한다.
