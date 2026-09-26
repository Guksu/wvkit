# 이미지 뷰어

[`ScrollContainer`](/ko/components/scroll-container/)로 만든 전체 화면 사진 뷰어입니다. 옆으로 쓸어 사진을 넘기고, 핀치나 더블탭으로 확대합니다. 위에 `2 / 6` 번호가 보입니다.

휴대폰에서 열어 보세요: [바닐라 JS](https://guksu.github.io/wvkit/recipes/image-viewer/vanilla.html) · [React](https://guksu.github.io/wvkit/recipes/image-viewer/react.html) · [Vue](https://guksu.github.io/wvkit/vue/recipes/image-viewer/vue.html)

## 하는 일

- 패널 하나에 사진 하나. 사진은 화면에 맞게 줄여서 보여 줍니다.
- 핀치로 4배까지 확대합니다. 더블탭하면 1배와 2.5배를 오갑니다.
- 확대한 채로 사진 끝을 넘어 끌면 다음 사진으로 갑니다. 다음 사진은 1배로 시작합니다.
- 화면의 사진과 양옆 사진 한 장씩만 불러옵니다. 사진 2로 넘기면 사진 3을 불러옵니다.

## 코드

아래 코드는 위 예제 페이지의 소스 그대로입니다. e2e 테스트가 그 페이지를 열어 [하는 일](#하는-일)의 항목을 하나씩 확인합니다.

::: code-group

<<< @/../examples/react-example/src/recipes/image-viewer/image-viewer.ts [바닐라 JS]

<<< @/../examples/react-example/src/recipes/image-viewer/ImageViewer.tsx [React]

<<< @/../examples/vue-example/src/recipes/image-viewer/ImageViewer.vue [Vue]

:::

CSS 는 셋이 같습니다.

<<< @/../examples/react-example/src/recipes/image-viewer/image-viewer.css

이렇게 씁니다.

```ts
// 바닐라 JS: 요소를 채우고, 뷰어를 없애는 함수를 돌려준다
const close = createImageViewer(document.getElementById('viewer'), photos, 0);
```

```tsx
// React·Vue: 뷰어가 나올 자리에 그린다
<ImageViewer photos={photos} startIndex={0} />
```

페이지 viewport 에 `user-scalable=no, maximum-scale=1.0` 을 넣으세요. 그래야 브라우저의 페이지 확대가 핀치와 겹치지 않습니다 ([기본 사용법](/ko/components/scroll-container/#기본-사용법) 참고).

## 각 부분이 필요한 이유

### 사진이 바뀌면 줌을 되돌린다

줌은 사진 한 장이 아니라 페이저 전체의 것입니다. `ScrollContainer` 는 모든 패널을 카메라 하나로 봅니다. 되돌리지 않으면, 확대한 채로 넘긴 다음 사진이 2.5배로, 가까운 쪽 끝에서 보입니다.

`onIndexChange` 에서 `zoomTo(1)` 을 부릅니다. 스냅 애니메이션 도중이라 카메라가 아직 이전 사진에 더 가까워도 새 사진에 멈춥니다. `@guksu/wvkit-core` 0.6.0 이하는 이 경우 이전 사진으로 돌아가 멈춥니다.

`getZoom() > 1` 확인은 보통의 넘기기에서 호출을 건너뜁니다. `zoomTo` 는 늘 300 ms 로 움직이므로, 1배에서 부르면 손가락 속도를 따르는 넘기기 스냅을 덮어씁니다.

### 사진은 필요하기 직전에 불러온다

렌더 창은 화면의 사진과 양옆 `overscan` 장입니다. 뷰어는 패널이 이 창에 들어올 때 그 사진을 불러옵니다.

- **바닐라 JS**: `<img>` 를 `src` 없이 만듭니다. `<img>` 는 문서에 붙지 않아도 `src` 가 생기면 바로 불러오기 시작합니다 ([HTML 명세: updating the image data](https://html.spec.whatwg.org/multipage/images.html#updating-the-image-data)). `onPanelVisibilityChange` 가 패널이 처음 창에 들어올 때 `src` 를 넣습니다.
- **React·Vue**: `lazy` 는 패널이 처음 창에 들어올 때 그 패널 내용을 마운트합니다. 이때 `<img>` 가 만들어지고 바로 불러옵니다. 가까이 가지 않은 패널은 마운트되지 않습니다.

`loading="lazy"` 만으로는 모든 크기에서 다음 사진을 미리 불러오지 못했습니다. Playwright 의 Chromium 으로 재 보니, 다음 패널의 `loading="lazy"` 이미지를 뷰어 폭 400 px·800 px 에서는 페이지를 연 직후 요청했지만 1280 px 에서는 요청하지 않았습니다. `src` 를 직접 넣으면 브라우저의 지연 로딩 거리와 상관없습니다.

### 패널에 폭을 준다

`panelWidth` 옵션이 없으면 `ScrollContainer` 는 패널 폭을 앱 CSS 에 맡깁니다. 폭이 없는 패널은 사진 크기로 줄어들고, 아직 불러오지 않은 사진은 크기가 없습니다 (재 보니 폭 0 px). 그래서 `.image-viewer-photo` 에 `width: 100%` 를 줍니다.

### 작은 것들

- 이미지의 `draggable = false`: 데스크톱에서 이미지 위에서 시작한 마우스 드래그는 브라우저의 드래그 앤 드롭을 시작해 넘기기를 끊습니다.
- `-webkit-touch-callout: none`: iOS 에서 이미지를 길게 누르면 "이미지 저장" 메뉴가 뜹니다.
- 페이저의 `aria-label="Photos"`: 라이브러리는 페이저에 `aria-roledescription="carousel"` 을 주지만 이름은 지어 내지 않습니다. 사진마다 이미 `n / N` 이름이 있으므로, 화면의 번호는 `aria-hidden` 입니다.

## 확대한 채로 넘기기

끄는 거리가 사진을 바꿀지 정합니다. 2.5배에서 화면은 손가락의 1/2.5 만큼 움직입니다. 사진 가운데에서 시작하면:

1. 화면이 0.3 × 화면 폭을 움직이면 사진의 오른쪽 끝이 화면 오른쪽 끝에 닿습니다.
2. 거기서 0.4 × 화면 폭 + `gap` 을 더 움직이면 다음 사진의 왼쪽 끝이 화면 왼쪽 끝에 닿습니다.

2 단계의 30% (`snapThreshold`) 넘게 끌면 다음 사진으로 갑니다. 덜 끌면 끝으로 돌아옵니다. 튕기기(플릭)만으로는 사진이 바뀌지 않습니다. [핀치 줌과 줌 상태 pan](/ko/components/scroll-container/#핀치-줌과-줌-상태-pan)을 참고하세요.

## 제한사항

- **줌은 모든 사진이 함께 씁니다.** 사진으로 돌아왔을 때 확대 상태가 남아 있게 할 수 없습니다.
- **열고 닫는 애니메이션이 없습니다.** 썸네일에서 전체 화면으로 커지는 애니메이션도, 아래로 쓸어 닫기도 없습니다.
- **줌은 보이는 이미지를 키웁니다.** 4배에서도 선명하려면 원본 이미지 폭이 1배로 보일 때 폭의 약 4배 (곱하기 기기 픽셀 비율) 여야 합니다.
- **기기가 아니라 브라우저에서 테스트했습니다.** e2e 테스트는 Chromium, WebKit, Playwright 의 iPhone·Android 에뮬레이션에서 돕니다. 실제 iOS·Android 기기에서는 돌리지 않았습니다.

## 다른 라이브러리

이 레시피보다 많은 기능이 필요하면 갤러리 전용 라이브러리가 더 맞을 수 있습니다.

- [PhotoSwipe](https://photoswipe.com/) 는 "JavaScript image gallery and lightbox" 입니다. 썸네일에서 여닫는 애니메이션을 돌릴 수 있고, 확대하면 `srcset` 의 더 큰 이미지를 불러옵니다.
- [Swiper](https://swiperjs.com/swiper-api#zoom) 에는 Zoom 모듈이 있습니다. 확대할 이미지를 `swiper-zoom-container` 요소로 감싸고, 더블탭하면 그 슬라이드가 확대됩니다.

앱의 다른 `ScrollContainer` 페이저와 코드·제스처 동작을 같이 쓰고 싶을 때 이 레시피를 고르세요.
