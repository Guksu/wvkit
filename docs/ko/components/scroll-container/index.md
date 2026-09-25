# ScrollContainer

## 문제 배경

네이티브 앱은 동일한 높이의 패널을 나란히 배치하고, 각 패널이 독립적인 세로 스크롤을 가지며, 상위 가로 제스처로 뷰포트를 전환합니다 — 그 위에 핀치 줌도 자주 요구됩니다. CSS `overflow-x` / `overflow-y`만으로는 WebView에서 이를 안정적으로 구현할 수 없습니다. 대각 스크롤 방지, 축 정렬 스냅, 핀치 줌과 pan의 합성 같은 정밀 제어가 표준 스크롤 프리미티브로는 불가능합니다.

`ScrollContainer`는 사용자가 *보는* 영역(viewport)과 *콘텐츠 평면*(scene)을 카메라 추상화로 분리해 이 문제를 해결합니다.

## 아키텍처

작은 부품 셋으로 이루어지고 의존성이 없습니다:

- **카메라 모델** — 위치 `(x, y)`와 `zoom`. 월드 1단위 = zoom 1에서 CSS 1px.
- **패널 렌더러** — 패널을 *scene* 요소 하나 안에 절대 배치하고, 카메라를 CSS transform 한 줄로 씁니다: `translate(width/2 − x·zoom, height/2 + y·zoom) scale(zoom)`. 패널 DOM은 건드리지 않아 접근성·상호작용이 보존되고, 프레임마다 바뀌는 transform은 하나뿐입니다.
- **CameraControl** — pointer 입력을 모두 받아 카메라를 직접 움직입니다: **축 제약 pan**, **스냅**, **엣지 저항**, **핀치 줌**.
- 가상화: `activeIndex ± overscan` 범위 밖 패널은 `display:none`으로 숨깁니다. 한 번도 보이지 않은 패널은 문서에 붙이지 않으므로 lazy 이미지가 요청되지 않습니다.

0.5 이전 버전은 같은 모델을 Three.js `CSS3DRenderer`로 렌더링했습니다. 그 의존성을 제거하면서 공개 API는 바뀌지 않았습니다.

`direction` 옵션의 의미는 "스와이프 방향"이 아니라 **카메라가 pan할 수 있는 축 제약**입니다:

- `horizontal`: X 축 pan만 — 가로 패널 전환
- `vertical`: Y 축 pan만 — 세로 패널 전환
- `both`: **사용 중단.** `horizontal` 과 똑같이 동작하고 1.0 에서 제거합니다. `horizontal` 을 쓰세요.

## 설치

core 에는 의존성이 없습니다. React/Vue 어댑터는 `@guksu/wvkit-core`에 의존합니다. React 패키지는 peer dependency 로 `react` 와 `react-dom` 18 이상도 필요합니다(컴포넌트가 `createPortal` 로 패널을 그림).

::: code-group
```sh [npm]
npm install @guksu/wvkit-core
# 프레임워크에 따라 @guksu/wvkit-react 또는 @guksu/wvkit-vue 추가
```
```sh [pnpm]
pnpm add @guksu/wvkit-core
```
:::

## 기본 사용법

::: code-group

```js [Vanilla JS]
import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';

const root = document.getElementById('viewport');
const panels = Array.from({ length: 5 }, (_, i) => {
  const el = document.createElement('div');
  el.textContent = `Panel ${i}`;
  return el;
});

const sc = createScrollContainer(root, {
  direction: 'horizontal',
  panels,
  initialIndex: 0,
  overscan: 1,
  snapThreshold: 0.3,
  resistance: 0.2,
  enablePinchZoom: true,
  minZoom: 1,
  maxZoom: 3,
  onIndexChange: (i) => console.log('active panel', i),
  onZoomChange: (z) => console.log('zoom', z),
});

sc.scrollTo(2, { animated: true });
sc.zoomTo(2.0, { animated: true });
sc.destroy();
```

```tsx [React]
import { useMemo } from 'react';
import { useScrollContainer } from '@guksu/wvkit-react/scroll-container';

function Carousel() {
  const panels = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const el = document.createElement('div');
        el.textContent = `Panel ${i}`;
        return el;
      }),
    [],
  );

  const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
    direction: 'horizontal',
    panels,
  });

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 400, position: 'relative', touchAction: 'none' }}
    />
  );
}
```

```vue [Vue]
<script setup>
import { useScrollContainer } from '@guksu/wvkit-vue/scroll-container';

const panels = Array.from({ length: 5 }, (_, i) => {
  const el = document.createElement('div');
  el.textContent = `Panel ${i}`;
  return el;
});

const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
  direction: 'horizontal',
  panels,
});
</script>
<template>
  <div
    ref="containerRef"
    style="width: 100%; height: 400px; position: relative; touch-action: none"
  />
</template>
```

:::

::: tip
호스트 컨테이너에 `touch-action: none`을 주어 브라우저 기본 스크롤/줌이 pointer 파이프라인과 경쟁하지 않게 하세요. ScrollContainer가 핀치 줌을 단독으로 처리하길 원하면 페이지 viewport meta에 `user-scalable=no, maximum-scale=1.0`도 함께 설정하세요. 패널이 자체 스크롤을 가지면 규칙이 하나 더 필요합니다 — 다음 절을 보세요.
:::

## 컴포넌트 (`ScrollContainer` · `ScrollPanel`)

React·Vue 패키지는 컴포넌트 두 개도 내보냅니다. 패널을 자식으로 쓰므로 `HTMLElement` 배열을 직접 만들지 않아도 됩니다. Swiper 의 `<Swiper>` + `<SwiperSlide>` 와 같은 방식입니다.

::: code-group

```tsx [React]
import { useRef, useState } from 'react';
import {
  ScrollContainer,
  ScrollPanel,
  type ScrollContainerHandle,
} from '@guksu/wvkit-react/scroll-container';

function Tabs({ tabs }) {
  const sc = useRef<ScrollContainerHandle>(null);
  const [index, setIndex] = useState(0);

  return (
    <>
      <ScrollContainer
        ref={sc}
        direction="horizontal"
        gap={12}
        onIndexChange={setIndex}
        style={{ height: 560 }}
      >
        {tabs.map((tab) => (
          <ScrollPanel
            key={tab.id}
            label={tab.title}
            style={{ overflowY: 'auto', touchAction: 'pan-y' }}
          >
            <Feed tab={tab} />
          </ScrollPanel>
        ))}
      </ScrollContainer>
      <button onClick={() => sc.current?.scrollTo(index + 1)}>다음</button>
    </>
  );
}
```

```vue [Vue]
<script setup lang="ts">
import { ref } from 'vue';
import {
  ScrollContainer,
  ScrollPanel,
  type ScrollContainerHandle,
} from '@guksu/wvkit-vue/scroll-container';

defineProps<{ tabs: { id: string; title: string }[] }>();
const sc = ref<ScrollContainerHandle | null>(null);
const index = ref(0);
</script>
<template>
  <ScrollContainer
    ref="sc"
    direction="horizontal"
    :gap="12"
    style="height: 560px"
    @index-change="index = $event"
  >
    <ScrollPanel
      v-for="tab in tabs"
      :key="tab.id"
      :label="tab.title"
      style="overflow-y: auto; touch-action: pan-y"
    >
      <Feed :tab="tab" />
    </ScrollPanel>
  </ScrollContainer>
  <button @click="sc?.scrollTo(index + 1)">다음</button>
</template>
```

:::

- **패널 순서는 코드에 쓴 순서입니다.** 조건부 패널(`{show && <ScrollPanel>}`, `v-if`)이나 직접 만든 컴포넌트로 감싼 패널도 그 순서를 따릅니다. 패널마다 바뀌지 않는 `key` 를 주세요. 패널을 넣고 빼면 [`setPanels`](#실행-중에-패널·옵션-바꾸기) 와 같게 동작합니다. 보던 패널은 그대로 남고, 남는 패널의 스크롤 위치도 유지됩니다.
- **`panels` 를 뺀 모든 옵션이 prop 입니다.** 바뀐 prop 은 `setOptions` 로 넘기므로 다시 마운트하지 않습니다. `initialIndex` 는 첫 패널이 생길 때 한 번 읽습니다.
- **`ScrollContainer` 의 속성은 호스트 요소에 붙습니다.** 호스트에는 이미 `position: relative`, `overflow: hidden`, `touch-action: none` 이 있고, 직접 준 `style` 이 이를 덮어씁니다. 높이를 꼭 주세요.
- **`ScrollPanel` 의 속성은 패널 안의 내용 요소에 붙습니다.** 패널 요소 자체에는 붙지 않습니다. 패널 요소는 라이브러리가 관리합니다(`transform`, `display`, ARIA 속성을 씀). 내용 요소는 `height: 100%` 이므로, 스크롤되는 패널이면 `overflow-y: auto` 와 `touch-action: pan-y` 를 `ScrollPanel` 에 주세요.
- **`label`** 은 패널 요소의 `aria-label` 이 됩니다. 없으면 `a11y` 가 패널마다 `"n / N"` 을 붙입니다.
- **명령형 제어는 `ref` 로 합니다.** `scrollTo`, `zoomTo`, `getActiveIndex`, `getZoom` 을 씁니다([컴포넌트 prop 과 핸들](#컴포넌트-prop-과-핸들) 참고). 제어형 `activeIndex` prop 은 없습니다. `onIndexChange`(React)나 `@index-change`(Vue)로 상태를 직접 들고, 옮길 때는 `scrollTo` 를 부르세요.
- **패널이 없으면 인스턴스도 없습니다.** 첫 패널이 생길 때 만들고, 마지막 패널이 빠지면 정리합니다. 그 전에는 `scrollTo`·`zoomTo` 가 아무 일도 하지 않습니다.
- **서버 렌더링(SSR)**: 서버는 호스트와 패널마다 숨은 표시 요소 하나만 그립니다. 패널 내용은 브라우저에서 마운트된 뒤 그립니다. 내용이 들어갈 패널 요소가 브라우저에서만 생기기 때문입니다. 그래서 패널 안 내용은 서버 HTML 에 없습니다.
- **React 는 `react-dom` 이 필요합니다** (패널 내용을 `createPortal` 로 그림). `@guksu/wvkit-react` 의 peer dependency 입니다. 다른 React 포털과 같이 context 와 이벤트는 그대로 동작합니다. Vue 는 `Teleport` 를 쓰므로 `provide` / `inject` 도 동작합니다.
- **세로 페이저**: `direction="vertical"` 에 `panelHeight` 를 주면 패널 요소가 그 높이가 됩니다. `panelHeight` 가 없으면 패널마다 호스트 높이입니다. 세로 페이저의 패널은 세로로 스크롤되면 안 됩니다([지원하지 않음](#지원하지-않음-세로-페이저-세로로-스크롤되는-패널)).

이미 DOM 요소가 있으면(예: 다른 라이브러리가 만든 패널) 훅(`useScrollContainer`)을 쓰세요. 패널이 React·Vue 내용이면 컴포넌트를 쓰세요.

## 스크롤되는 패널 (피드·리스트·긴 콘텐츠)

패널이 각자 세로로 스크롤되는 가로 페이저에는 규칙이 하나 더 있습니다. **스크롤되는 패널마다 반드시 `touch-action: pan-y`를 주세요** (호스트 컨테이너는 그대로 `touch-action: none`).

```js
const panel = document.createElement('div');
panel.style.overflowY = 'auto'; // 패널이 자기 콘텐츠를 스크롤
panel.style.touchAction = 'pan-y'; // 세로 터치는 네이티브 스크롤, 가로 터치는 ScrollContainer로
```

이유: 브라우저는 터치한 요소부터 가장 가까운 *스크롤 가능한* 조상까지의 `touch-action`만 보고 터치 처리를 결정합니다. 그 조상이 패널 자신이라 호스트의 `touch-action: none`은 아예 참조되지 않습니다. 패널이 기본값 `auto`(또는 `manipulation`)이면 브라우저가 가로 터치까지 가져가 `pointercancel`을 내고, 페이저는 절대 넘어가지 않습니다. `pan-y`를 주면 세로 터치는 관성까지 네이티브 스크롤로, 가로 터치는 페이저로 전달되고, 대각 터치는 네이티브 페이저처럼 큰 축 쪽으로 정리됩니다.

- `direction: 'vertical'` 은 세로로 스크롤되는 패널을 지원하지 않습니다. [지원하지 않음: 세로 페이저 + 세로로 스크롤되는 패널](#지원하지-않음-세로-페이저-세로로-스크롤되는-패널)을 보세요.
- 패널 안 이미지에는 `loading="lazy"`를 주세요. `overscan` 창 밖의 패널은 문서에서 떼어져 있어, lazy 이미지는 패널이 보일 때까지 요청되지 않습니다.
- 데스크톱: `<img>` 위에서 시작한 마우스 드래그는 네이티브 drag-and-drop을 시작해 제스처를 취소합니다. 패널 안 이미지에 `draggable="false"`를 주세요.

### 지원하지 않음: 세로 페이저 + 세로로 스크롤되는 패널

`direction: 'vertical'` 은 세로로 스크롤되는 패널(`overflow-y: auto`)과 함께 동작하지 않습니다. 페이저와 패널이 같은 세로 스와이프를 원하기 때문입니다. 헤드리스 Chromium 에서 640px 세로 페이저에 내용 높이 3,000px 인 패널을 넣고 잰 결과입니다:

| 입력 | 결과 |
| --- | --- |
| 터치 스와이프 | 패널이 스크롤됩니다. 패널을 끝까지 내려도 스와이프로는 어느 방향으로도 패널이 넘어가지 않습니다. 브라우저가 터치를 가져가고(`pointercancel`), 페이저도 `pan-y` 패널 위의 터치를 받지 않습니다. |
| 휠·트랙패드 | 패널이 스크롤됩니다. 패널이 끝에 닿으면 휠이 다음 패널로 넘깁니다. |
| 마우스 드래그 | 다음 패널로 넘어갑니다. 패널은 스크롤되지 않습니다. |
| 키보드(`ArrowDown`) | 다음 패널로 넘어갑니다. |

그래서 휴대폰에서는 스와이프로 다른 패널에 갈 수 없습니다. 대신 아래 중 하나를 쓰세요:

- 스크롤되는 패널을 **가로** 페이저에 넣기 (위에서 설명한 구성).
- 세로 페이저에는 **스크롤되지 않는 패널** 쓰기: 높이가 고정된 카드, 전체 화면 이미지·영상.
- 페이지마다 스크롤도 되는 세로 피드라면 브라우저 기본 **CSS scroll snap** 쓰기 (바깥 스크롤 요소에 `scroll-snap-type: y mandatory`). 안쪽 스크롤이 끝에 닿으면 브라우저가 스크롤을 바깥으로 넘깁니다("scroll chaining", MDN 의 [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior) 참고). 같은 스와이프 안에서 넘어가는지는 브라우저마다 다릅니다.

다른 페이저도 기본 상태로는 이 경우를 처리하지 않습니다. Android ViewPager2 문서에는 "같은 방향의 중첩 스크롤 뷰를 기본으로 지원하지 않는다"고 적혀 있고, `requestDisallowInterceptTouchEvent()` 를 쓰는 우회 방법이 나옵니다([Android 문서](https://developer.android.com/develop/ui/views/animations/vp2-migration#nested-scrollables)). Swiper 슬라이드 안의 스크롤 요소에 대해서는, Swiper 관리자가 그 요소를 "Scroll container" 설정의 Swiper 로 한 번 더 감싸 보라고 제안합니다([토론](https://github.com/nolimits4web/swiper/discussions/4314)). Jetpack Compose `VerticalPager` 는 Compose 의 [중첩 스크롤](https://developer.android.com/develop/ui/compose/touch-input/scroll/nested-scroll-modifiers)로 이를 처리합니다.

## 실행 중에 패널·옵션 바꾸기

`setPanels(panels)` 와 `setOptions(바꿀 옵션)` 은 마운트된 인스턴스를 다시 마운트하지 않고 바꿉니다. `setOptions` 에는 바꿀 옵션만 넘기며, `panels` 도 넘길 수 있습니다. 옵션에 `undefined` 를 주면 기본값으로 돌아갑니다.

```js
const sc = createScrollContainer(host, { direction: 'horizontal', panels, gap: 0 });

sc.setPanels([newTab, ...panels]); // 보던 패널이 화면에 그대로 남는다
sc.setOptions({ gap: 12, panelWidth: 0.85 }); // 같은 인스턴스에서 다시 배치
sc.setOptions({ panelWidth: undefined }); // 전폭 패널로 되돌리기
```

- **보던 패널은 그대로 남습니다.** 활성 패널이 새 목록에도 있으면 화면에 그대로 둡니다(줌·pan 상태도 유지). 번호가 바뀌면 새 번호로 `onIndexChange` 가 불립니다. 활성 패널이 지워졌으면 같은 번호 자리의 패널이 활성이 됩니다.
- **남는 패널은 문서에서 떼지 않습니다.** 그래서 스크롤 위치가 유지됩니다. 빠진 패널은 떼어지고 인라인 스타일과 ARIA 속성이 원래대로 돌아옵니다.
- **바뀐 것이 없으면 아무 일도 하지 않습니다.** 같은 값, 새 콜백, 같은 배치를 내는 새 함수(렌더마다 새로 만드는 `panelHeight: () => 300`)가 여기에 해당합니다. 바뀐 것이 있으면 진행 중인 제스처·애니메이션은 멈춥니다. 줌은 새 `minZoom`~`maxZoom` 범위 안으로 유지하고, 줌이 바뀌면 `onZoomChange` 가 불립니다.
- **잘못된 값이면 아무것도 바꾸지 않습니다.** DOM 을 건드리기 전에 `WebviewHeadlessError` 를 던집니다. 생성할 때와 같은 검사에, 빈 목록과 같은 요소 두 번이 더해집니다.
- `initialIndex` 는 마운트 때만 씁니다.

**React.** `useScrollContainer` 는 렌더마다 옵션을 비교해서 바뀐 키만 `setOptions` 로 넘깁니다. 패널 배열은 요소를 하나씩 비교하므로, 렌더마다 같은 요소로 새 배열을 만들어도 됩니다.

**Vue.** `useScrollContainer` 에 `reactive` 객체·`ref`·getter 를 넘기면 같은 방식으로 반영합니다. 보통 객체는 마운트 때 한 번 읽습니다.

## 패널 안 캐러셀 (Swiper·Embla·네이티브 스크롤)

가로 페이저의 패널 안에는 가로로 움직이는 내용이 따로 있는 경우가 많습니다. 히어로 배너 캐러셀이나 칩 줄 같은 것입니다. 두 종류가 있습니다.

- **네이티브 가로 스크롤**(`overflow-x: auto`, 흔히 `scroll-snap` 과 함께)은 그대로 동작합니다. `touch-action: pan-x pan-y` 를 주세요. 그러면 그 위의 가로 터치는 브라우저 몫이 되고 페이저는 움직이지 않습니다. 데모의 칩 줄이 이렇게 만들어져 있습니다.
- **JS 캐러셀**(Swiper, Embla 등)은 `noDragSelector` 가 필요합니다. 이런 캐러셀도 포인터 이벤트로 슬라이드를 움직입니다. 그래서 이 옵션이 없으면 한 번 밀 때 캐러셀과 페이저가 함께 움직입니다. 예를 들어 Swiper 14 는 가로 캐러셀에 `touch-action: pan-y` 를 줍니다(`swiper.css`). 그래서 브라우저가 가로 터치를 스크립트에 맡깁니다. 또 `pointermove` 를 `document` 에서 받는데, 이것은 호스트의 리스너보다 늦게 실행됩니다.

```js
createScrollContainer(host, {
  direction: 'horizontal',
  panels,
  noDragSelector: '.swiper', // Swiper 안에서 시작한 제스처는 Swiper 몫
});
```

- `noDragSelector` 에 맞는 요소 안에서 시작한 제스처는 그 요소의 것입니다. 페이저는 그 제스처로 끌기·핀치·더블탭 줌을 하지 않고, 그 제스처에 더해지는 손가락도 무시합니다. 다른 곳에서 시작한 제스처는 두 번째 손가락이 캐러셀에 닿아도 그대로 동작합니다.
- 그 요소 위의 휠은 그 요소에 맡깁니다(페이지 넘김과 줌 상태 pan 모두). `Ctrl` + 휠 줌은 그대로 동작합니다.
- 캐러셀의 첫 장이나 마지막 장에서 더 밀어도 패널은 넘어가지 않습니다. Android `ViewPager` 는 안쪽 뷰가 더 스크롤할 수 없으면 바깥 페이저에 넘깁니다(`canScroll`). ScrollContainer 는 JS 캐러셀이 어디에 있는지 모르므로 이렇게 하지 않습니다.
- 호스트 안의 요소만 셉니다. 선택자가 호스트나 그 조상에도 맞아도 페이저가 꺼지지 않습니다.

데모의 Swiper 배너를 왼쪽으로 180px 밀어 실제 터치로 쟀습니다 (Chrome DevTools Protocol, Pixel 7 에뮬레이션).

| | 배너 | 페이저 | 미는 동안 카메라 |
| --- | --- | --- | --- |
| `noDragSelector: '.swiper'` | 1 → 2 장 | 그대로 | 한 번도 안 움직임 |
| 옵션 없음 | 1 → 2 장 | 0 → 1 로 같이 넘어감 | 움직임 |

## 패널 폭·간격·정렬 (피킹)

기본값에서는 패널 하나가 호스트 폭과 같습니다. `horizontal` 페이저에서는 옵션 세 개로 이것을 바꿔 양옆 패널이 가장자리에 조금 보이게 할 수 있습니다. 이커머스 배너나 카드 줄에서 흔히 쓰는 "피킹" 배치입니다.

```js
createScrollContainer(host, {
  direction: 'horizontal',
  panels,
  panelWidth: 0.85, // 호스트 폭의 85 %. 1보다 크면 px.
  gap: 12, // 패널 사이 간격 (px)
  align: 'center', // 또는 'start'
});
```

- **`panelWidth`.** `(0, 1]` 안의 숫자는 호스트 폭에 대한 비율입니다. 1보다 크면 px 입니다. 함수 `(index) => number` 를 주면 패널마다 폭을 같은 단위로 정합니다. 페이저는 각 패널의 인라인 `style.width` 에 폭을 쓰고, `destroy()` 때 원래 값으로 되돌립니다. `panelWidth` 를 주지 않으면 이전처럼 패널 폭을 건드리지 않습니다. 비율 폭은 호스트 크기가 바뀌면 따라 바뀌고, px 폭은 그대로입니다.
- **`gap`.** 이웃 패널 사이 간격(px)입니다. `vertical` 페이저에서도 동작합니다.
- **`align: 'center'`**(기본값)는 활성 패널을 가운데에 둡니다. 그래서 양쪽 이웃이 보입니다. **`align: 'start'`** 는 활성 패널의 시작 가장자리를 호스트의 시작 가장자리에 붙입니다. 그래서 다음 패널만 보입니다.
- **페이지 넘김은 여전히 제스처 한 번에 한 칸입니다.** `snapThreshold` 와 플릭 가중치는 호스트 폭이 아니라 두 정착 위치 사이 거리(패널 폭 + `gap`)를 기준으로 잽니다. 400px 호스트에서 `panelWidth: 0.85`, `gap: 12` 면 한 칸은 352px 입니다.
- **가상화는 화면에 보이는 패널을 셉니다.** 활성 패널이 멈춘 위치에서 호스트와 겹치는 패널을 붙여 두고, 그 양쪽으로 `overscan` 장을 더 붙입니다. `panelWidth: 0.85`, `overscan: 0` 이면 가운데 패널에서는 세 장이 붙어 있습니다. 활성 패널과 양쪽 이웃입니다.
- **줌.** 줌 상태에서 카메라는 활성 패널 안에서만 움직입니다. 호스트보다 좁은 패널은 줌이 호스트 폭 ÷ 패널 폭보다 커져야 움직일 공간이 생깁니다 (`panelWidth: 0.85` 면 약 1.18).

## 드래그 시작 여유와 방향 잠금

포인터가 `dragThreshold`(기본 10px)보다 많이 움직여야 페이저가 움직입니다. 그 순간 우세 축(|dx|와 |dy| 중 큰 쪽, 45° 기준)으로 방향을 한 번 정하고, 손을 뗄 때까지 유지합니다. Android `ViewPager`와 같은 규칙입니다(`xDiff > mTouchSlop && xDiff > yDiff`).

- **페이저 축이 우세** → 페이저가 드래그합니다. 시작점을 여유만큼 당겨 잡아 콘텐츠가 튀지 않습니다. 30px 끌면 20px 움직입니다(`ViewPager`의 `mInitialMotionX ± mTouchSlop`).
- **교차 축이 우세, zoom ≤ 1** → 그 제스처 전체를 페이저가 무시합니다. 나중에 옆으로 틀어도 마찬가지입니다. zoom > 1에서는 대신 양 축 자유 pan입니다.
- **브라우저가 가져갈 터치** → 터치·펜이면 페이저가 브라우저처럼 누른 요소의 실제 `touch-action`을 계산합니다(누른 요소부터 가장 가까운 스크롤 컨테이너까지). 정한 방향의 pan이 허용되면 페이저는 움직이지 않고 브라우저의 `pointercancel`을 기다립니다. 예를 들어 `pan-y` 패널의 세로 터치, `pan-x pan-y` 칩 줄의 가로 터치가 그렇습니다. 마우스는 `touch-action`과 상관없습니다.
- 여유보다 작게 떨린 탭은 여전히 탭입니다. 페이저를 움직이지 않고, 더블탭 줌도 그대로 인식합니다.
- 핀치가 끝나고 남은 손가락은 이미 움직이는 중이므로 여유 없이 바로 pan을 이어갑니다.
- 포인터 캡처는 드래그가 시작된 뒤에만 잡습니다. 몇 px 흔들린 마우스 클릭도 아래 버튼에 닿습니다.
- `dragThreshold: 0`이면 이전 동작입니다. 첫 move부터 따라가고 방향 잠금이 없습니다.

실제 터치(Chrome DevTools Protocol, Pixel 7 에뮬레이션, `pan-y` 피드 패널)로 바꾸기 전후를 쟀습니다:

| 제스처 | 이전 가로 흔들림 | 이후 |
| --- | --- | --- |
| 가로 기준 46° 스와이프 (브라우저가 패널을 스크롤) | 13.9px | 0px |
| 55° 스와이프 | 11.5px | 0px |
| 70° 스와이프 | 6.8px | 0px |
| 4px 떨린 탭 | 4px | 0px |
| 옆으로 6px 흔들리며 시작한 세로 스크롤 | 6px | 0px |
| zoom 2에서 곧은 세로 스와이프 (브라우저가 패널을 스크롤) | 화면 기준 세로 20px | 0px |

Chromium도 스스로 같은 45°로 나눴습니다. 44°는 페이지에 맡겼고, 46°는 패널을 스크롤하며 약 20px 뒤에 `pointercancel`을 보냈습니다.

## 핀치 줌과 줌 상태 pan

- 줌은 손가락 아래 지점을 고정한 채(앵커 보정, 호스트 좌상단 기준) 확대되고, 손을 뗀 자리에 카메라가 그대로 머뭅니다 — 패널 중심으로 되돌아가지 않습니다.
- 줌 상태의 한 손가락 pan은 페이저 축을 따라 패널 가장자리까지 갑니다. pan 경계가 양쪽으로 `(panelSize / 2) × (1 − 1 / zoom)`만큼 넓어집니다.
- **교차 축.** 줌 상태에서는 같은 pan이 반대 축(`horizontal`이면 Y)으로도 움직입니다. 범위는 패널의 교차 축 반폭 `(crossSize / 2) × (1 − 1 / zoom)`입니다. 세로로 긴 상품 사진을 위아래로 살펴볼 수 있습니다. 그 범위 밖은 고무줄처럼 늘어났다 놓으면 돌아오고, 교차 축 플릭도 페이저 축과 같은 방식으로 감속합니다. 줌 1에서는 교차 축이 고정되어 대각 드래그가 여전히 페이저만 움직입니다. `touch-action: pan-y`를 준 패널은 세로 터치를 자체 네이티브 스크롤에 넘기므로, 교차 축 pan은 그 축으로 스크롤하지 않는 패널(이미지 뷰어·카드)에서만 동작합니다.
- 줌 상태에서 페이지 넘기기: 패널 가장자리를 지나 다음 패널 앞의 간격(gap)으로 끌면 됩니다. 그 간격의 `snapThreshold` 비율을 넘게 끌면 다음 패널의 가까운 가장자리로 스냅되고 `onIndexChange`가 발화합니다. 못 넘기면 출발한 가장자리로 돌아갑니다. 관성만으로는 페이지가 넘어가지 않습니다: 패널 안에서 놓은 플릭은 감속(iOS와 같은 0.998/ms)하다가 많아야 패널 가장자리에서 멈춥니다. 네이티브 사진 뷰어와 같습니다. 줌 상태에서 페이지를 넘기려면 손가락이 실제로 가장자리를 지나야 합니다.
- 브라우저가 터치를 가져가면(`pointercancel`, 예: `pan-y` 패널의 세로 터치가 네이티브 스크롤로 바뀔 때) pan은 취소됩니다. 그때까지의 이동을 유지하지 않고 제스처 시작 위치로 부드럽게 되돌아가므로 콘텐츠가 두 번 움직이지 않습니다.
- **줌 고무줄.** 핀치가 `minZoom`이나 `maxZoom`을 넘어도 손가락을 계속 따라가되 줌을 배율 공간에서 감쇠하고(`min × (raw / min)^resistance`), 마지막 손가락을 떼면 경계로 돌아옵니다. iOS의 `bouncesZoom`과 같습니다. `onZoomChange`는 항상 `[minZoom, maxZoom]` 안의 값만 냅니다. 딱 멈추게 하려면 `resistance: 0`을 주세요.
- **더블탭 줌**은 선택 사항입니다. `doubleTapZoom: 2`를 주면 더블탭(300ms·40px 안의 두 탭, 각 탭은 300ms 미만·10px 미만 이동)으로 `minZoom`과 2배를 오갑니다. 확대할 때는 탭한 지점이 고정되고, 축소할 때는 패널 중심으로 갑니다. 패널 안 버튼을 더블탭해도 클릭은 두 번 그대로 일어나니, 더블탭에 다른 뜻을 둔 패널이면 켜지 마세요.

## 데스크톱 입력과 접근성

WebView 팀도 데스크톱 브라우저에서 개발하고 QA하므로, 터치 화면이 없어도 페이저가 움직입니다. 터치 기기에서는 이 이벤트가 오지 않아 비용이 없습니다.

- **휠·트랙패드** (`wheel: true`, 기본). 페이저 축 방향 휠 제스처 하나에 한 패널이 움직입니다. 델타를 제스처(120ms 안에 이어지는 이벤트) 단위로 누적해 40px을 넘으면 한 번 넘기고, 그 제스처의 나머지는 무시합니다. 그래서 트랙패드 관성이 여러 패널을 건너뛰지 않습니다. 그 나머지가 새 패널 안의 요소를 스크롤하지도 않습니다. 교차 축 성분이 더 큰 휠(가로 페이저에서의 세로 스크롤)은 손대지 않습니다. 그 방향으로 더 스크롤할 수 있는 중첩 스크롤러(`overflow-x: auto` 칩 줄) 위에서도 네이티브에 맡깁니다. 단, 그 제스처로 이미 패널을 넘겼다면 맡기지 않습니다. 줌 상태에서는 휠이 페이지를 넘기지 않고 패널 안에서 카메라를 움직입니다. `Ctrl` + 휠(트랙패드 핀치가 페이지에 이렇게 옵니다)은 커서를 중심으로 줌합니다. 소비한 휠만 `preventDefault` 하므로 Chromium의 macOS 가로 스와이프 뒤로가기도 막힙니다. Safari에서는 페이지에 `overscroll-behavior-x: none`이 따로 필요합니다.
- **키보드** (`keyboard: true`, 기본). 호스트 자신에 포커스가 있을 때: 페이저 축 방향 화살표로 한 패널 이동, `Home` / `End`로 첫/끝 패널, 줌 상태에서 `Escape`로 `minZoom` 복귀. 패널 안(인풋·버튼)에 포커스가 있으면 키를 건드리지 않아 패널 콘텐츠의 키보드 동작이 그대로입니다. 호스트에 `tabindex`가 없으면 `tabindex="0"`을 줍니다. `:focus-visible` 스타일은 직접 주세요.
- **ARIA** (`a11y: true`, 기본). WAI-ARIA APG 캐러셀 패턴을 따릅니다. 호스트에 `role="group"`과 `aria-roledescription="carousel"`, 각 패널에 `role="group"`, `aria-roledescription="slide"`, `aria-label="n / N"`, 활성이 아닌 패널에는 `aria-hidden="true"`와 `inert`를 줘서 화면 밖 패널이 스크린리더와 Tab 순서에서 빠집니다. 이미 있는 속성은 건드리지 않고, 접근 가능한 이름은 만들어 내지 않습니다. 호스트에 `aria-label`을 주세요. `inert`는 모르는 브라우저(Chrome 102 미만 WebView, iOS 15.5 미만)에서 무시되고 `aria-hidden`만 남습니다.

## 스냅과 관성

- 손을 떼면 항상 패널(zoom ≤ 1) 또는 투영된 정지점·가장자리·gap 목표(zoom > 1)로 스냅합니다. 정착 시간은 손가락 속도에 이어집니다: ease-out 곡선이 놓는 순간 속도로 시작하도록 `duration = 3 × 거리 / 속도`로 정하고, 120ms와 거리 비례 상한 400ms(줌 상태 자유 pan은 800ms) 사이로 자릅니다. 멈춘 채 놓으면 상한을 쓰고, 목표 반대 방향 속도(고무줄 복귀)는 무시합니다.
- 한 제스처에 한 패널. Android `ViewPager` 와 같은 방법(`determineTargetPage`)으로 정합니다.
  - **짧고 빠른 플릭.** 손가락이 누른 지점에서 25px 넘게 움직였고, 뗄 때 속도가 0.4px/ms(400dp/s)를 넘으면 드래그가 짧아도 플릭 방향으로 한 칸 넘깁니다. 끌던 방향과 반대로 튕기면 취소로 보고 제자리에 둡니다. 이 값은 `ViewPager` 의 `MIN_DISTANCE_FOR_FLING`(25dp)과 `MIN_FLING_VELOCITY`(400dp/s)입니다. WebView 의 CSS px 은 dp 와 같은 단위입니다.
  - **그 밖에는** 끈 거리로 정합니다. 다음 정착 위치까지 거리의 `snapThreshold` 보다 많이 끌면 한 칸 넘깁니다 (속도 가중치가 조금 더해집니다).
  - 플릭이 패널을 건너뛰지는 않습니다.

  짧은 플릭 규칙 전후를 실제 터치로 쟀습니다 (Chrome DevTools Protocol, Pixel 7 에뮬레이션, 호스트 412px). 헤드리스 Chromium 은 터치 이동을 33ms 마다 한 번 전달하므로, 속도는 마지막 이동 거리를 그 간격으로 나눈 값입니다.

  | 플릭 | 뗄 때 속도 | 전 | 후 |
  | --- | --- | --- | --- |
  | 20px | 한 번에 | 제자리 | 제자리 (25px 이하) |
  | 30px | 0.45px/ms | 제자리 | 다음 패널 |
  | 40px | 0.6px/ms | 제자리 | 다음 패널 |
  | 60px | 0.9px/ms | 제자리 | 다음 패널 |
  | 40px, 천천히 | 0.24px/ms | 제자리 | 제자리 |
  | 70px | 0.42px/ms | 제자리 | 다음 패널 |

  이 규칙 전에는 플릭이 약 130px(화면의 3분의 1)를 움직여야 넘어갔습니다.
- `scrollTo()` / `zoomTo()`의 `animated: true`는 고정 300ms ease-out입니다.
- `zoomTo()`는 새 줌 기준으로 활성 패널 범위 안(양 축)에 카메라를 넣습니다. 줌을 1로 되돌리면 패널 중심에 놓입니다.
- 줌 트윈 도중 탭으로 끊어도 줌이 중간값에 머물지 않습니다. 릴리스가 마지막으로 정한 줌(`zoomTo`·핀치·더블탭)으로 이어갑니다.

## API 레퍼런스

### 옵션

| Prop              | 타입                                       | 기본값         | 설명                                                                                                |
| ----------------- | ------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------- |
| `direction`       | `'horizontal' \| 'vertical' \| 'both'`     | _(필수)_       | 카메라 pan 축 제약. `'both'` 는 사용 중단 — `'horizontal'` 과 같게 동작하고 1.0 에서 제거합니다. |
| `panels`          | `HTMLElement[]`                            | _(필수)_       | scene에 `CSS3DObject`로 추가될 미리 만들어진 DOM 노드. 빈 배열은 throw.                             |
| `initialIndex`    | `number`                                   | `0`            | 마운트 시 활성 패널 인덱스. `[0, panels.length-1]`로 클램프.                                        |
| `panelHeight`     | `(index: number) => number`                | _(root 높이)_  | `vertical`용 패널별 픽셀 높이. 지정 안 하면 root 클라이언트 높이 사용.|
| `panelWidth`      | `number \| (index: number) => number`     | _(root 폭)_    | `horizontal` 패널 폭. `(0, 1]` 은 root 폭 비율, 1 초과는 px. 각 패널의 인라인 `width` 에 씁니다. [패널 폭·간격·정렬](#패널-폭·간격·정렬-피킹) 참고. |
| `gap`             | `number ≥ 0`                               | `0`            | 이웃 패널 사이 간격(px). 두 방향 모두.                                                              |
| `align`           | `'center' \| 'start'`                      | `'center'`     | 활성 패널이 멈추는 자리. root 가운데, 또는 시작 가장자리를 root 시작 가장자리에 붙임.                |
| `onIndexChange`   | `(index: number) => void`                  | —              | 활성 패널이 변경될 때 호출 (scrollTo 또는 pan 스냅).                                                |
| `overscan`        | `number`                                   | `1`            | 화면에 보이는 패널 양쪽으로 더 붙여 둘 패널 수. `0`이면 화면에 보이는 패널만 붙입니다(전폭 패널이면 활성 패널 하나). |
| `snapThreshold`   | `number ∈ (0, 1]`                          | `0.3`          | 천천히 놓을 때 다음 패널로 넘기기 위한 드래그 비율 (두 정착 위치 사이 거리 대비). 짧고 빠른 플릭(25px 초과, 0.4px/ms 초과)은 이 값과 상관없이 넘깁니다. |
| `dragThreshold`   | `number ≥ 0`                               | `10`           | 페이저가 움직이기 전에 포인터가 움직여야 하는 px. 이 순간 드래그 방향을 정합니다. `0`이면 첫 move부터 따라가고 방향 잠금이 없습니다. |
| `noDragSelector`  | `string`                                   | —              | 제스처를 스스로 처리하는 패널 안 요소의 CSS 선택자 (`'.swiper'` 같은 JS 캐러셀). [패널 안 캐러셀](#패널-안-캐러셀-swiper·embla·네이티브-스크롤) 참고. |
| `resistance`      | `number ∈ [0, 1]`                          | `0.2`          | 엣지 고무줄 계수. `0`은 hard stop, `1`은 저항 없음.                                                 |
| `enablePinchZoom` | `boolean`                                  | `true`         | 두 손가락 제스처로 핀치 줌을 수행할지 여부.                                                         |
| `minZoom`         | `number > 0`                               | `1.0`          | 최소 줌 레벨.                                                                                       |
| `maxZoom`         | `number ≥ minZoom`                         | `3.0`          | 최대 줌 레벨.                                                                                       |
| `doubleTapZoom`   | `number \| false`                          | `false`        | 더블탭 줌 목표. `(minZoom, maxZoom]` 안의 숫자를 주면 더블탭으로 `minZoom`과 그 레벨을 오갑니다. `enablePinchZoom`과 독립. |
| `onZoomChange`    | `(zoom: number) => void`                   | —              | 줌 레벨이 변경될 때 호출 (핀치 릴리스·더블탭·`Ctrl` + 휠·`zoomTo`).                                |
| `wheel`           | `boolean`                                  | `true`         | 휠·트랙패드 입력: 제스처당 한 패널, 줌 상태에서는 카메라 pan, `Ctrl` + 휠 줌.                      |
| `keyboard`        | `boolean`                                  | `true`         | 호스트에 포커스가 있을 때 화살표·`Home`/`End`·`Escape`. 호스트에 `tabindex`가 없으면 `0`을 줍니다.  |
| `a11y`            | `boolean`                                  | `true`         | 호스트·패널에 캐러셀 ARIA 역할, 비활성 패널에 `aria-hidden`과 `inert`.                              |

`resistance`는 핀치가 `minZoom` / `maxZoom`을 넘을 때의 줌 고무줄에도 쓰입니다.

잘못된 옵션 (`panels` 비어있음, `minZoom ≤ 0`, `maxZoom < minZoom`, `doubleTapZoom ∉ (minZoom, maxZoom]`, `snapThreshold ∉ (0,1]`, 음수이거나 유한하지 않은 `dragThreshold`·`gap`, 0 이하이거나 유한하지 않은 `panelWidth`(함수가 돌려준 값 포함), 올바른 CSS 선택자가 아닌 `noDragSelector`, `resistance ∉ [0,1]`) 은 생성 시점에 `WebviewHeadlessError`를 throw합니다.

### 인스턴스 메서드

| 메서드                                    | 반환     | 설명                                                                                                |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `scrollTo(index, { animated? })`          | `void`   | 지정 패널로 이동. `animated`는 기본값 `true` (easing 트윈).                                         |
| `getActiveIndex()`                        | `number` | 현재 활성 패널 인덱스 반환.                                                                         |
| `zoomTo(level, { animated? })`            | `void`   | 줌 레벨 설정 (클램프). `animated` 기본값 `true`.                                                    |
| `getZoom()`                               | `number` | 현재 줌 레벨 반환.                                                                                  |
| `setPanels(panels)`                       | `void`   | 다시 마운트하지 않고 패널 목록을 바꿉니다. [실행 중에 패널·옵션 바꾸기](#실행-중에-패널·옵션-바꾸기) 참고. |
| `setOptions(changes)`                     | `void`   | 다시 마운트하지 않고 옵션을 바꿉니다 (넘긴 키만. `undefined` 는 기본값으로). |
| `destroy()`                               | `void`   | 모든 pointer 리스너, renderer DOM 제거 + 숨겨진 패널 `display` 복원. 멱등성 보장.                   |

### 프레임워크 어댑터 반환값

| 필드           | 타입 (React)                            | 타입 (Vue)                              |
| -------------- | --------------------------------------- | --------------------------------------- |
| `containerRef` | `RefObject<HTMLDivElement>`             | `Ref<HTMLElement \| null>`              |
| `activeIndex`  | `number`                                | `Ref<number>`                           |
| `activeZoom`   | `number`                                | `Ref<number>`                           |
| `scrollTo`     | `(i, opts?) => void` (stable callback)  | `(i, opts?) => void`                    |
| `zoomTo`       | `(z, opts?) => void` (stable callback)  | `(z, opts?) => void`                    |

::: tip 옵션 변경은 다시 마운트하지 않고 반영됩니다
React 훅은 렌더마다 바뀐 옵션을 `setOptions` 로 넘깁니다(패널 배열은 요소 단위로 비교). Vue 컴포저블은 `reactive` 객체·`ref`·getter 를 넘기면 같게 동작하고, 보통 객체는 마운트 때 한 번 읽습니다. 콜백(`onIndexChange`, `onZoomChange`)은 항상 최신으로 유지됩니다.
:::

### 컴포넌트 prop 과 핸들

**`ScrollContainer`** 는 `panels` 를 뺀 모든 [옵션](#옵션)을 prop 으로 받습니다. 그 밖의 `div` 속성(`className` / `class`, `style`, `data-*`, `aria-*`)은 호스트 요소에 붙습니다. Vue 에서는 콜백 옵션 대신 `@index-change`, `@zoom-change` 로 듣습니다. 바뀐 prop 은 훅과 같게 다시 마운트하지 않고 반영합니다.

**`ScrollPanel`**

| Prop        | 타입     | 설명                                                                         |
| ----------- | -------- | ---------------------------------------------------------------------------- |
| `label`     | `string` | 패널 요소의 `aria-label`. 없으면 `a11y` 가 `"n / N"` 을 붙입니다.             |
| 그 밖의 속성 | —        | 패널 안 내용 요소(`height: 100%`)에 붙습니다. 패널 요소 자체에는 붙지 않습니다. |

**핸들** — `ScrollContainer` 의 `ref` (`ScrollContainerHandle`)

| 메서드                           | 반환     | 설명                                                                 |
| -------------------------------- | -------- | -------------------------------------------------------------------- |
| `scrollTo(index, { animated? })` | `void`   | 인스턴스 메서드와 같습니다. 패널이 없으면 아무 일도 하지 않습니다.    |
| `zoomTo(level, { animated? })`   | `void`   | 인스턴스 메서드와 같습니다. 패널이 없으면 아무 일도 하지 않습니다.    |
| `getActiveIndex()`               | `number` | 활성 패널 번호. 패널이 없으면 `initialIndex`(없으면 `0`).              |
| `getZoom()`                      | `number` | 현재 줌 레벨. 패널이 없으면 `1`.                                      |

## 브라우저 지원

| 환경                   | 지원   |
| ---------------------- | ------ |
| iOS Safari 16+         | ✅     |
| WKWebView (iOS)        | ✅     |
| Android Chrome 90+     | ✅     |
| Android WebView        | ✅     |
| Samsung Internet 14+   | ✅     |
| Desktop Chrome/Firefox | ✅     |

## 번들 사이즈

`ScrollContainer`에는 런타임 의존성이 없습니다. esbuild 0.25(`--bundle --minify`, gzip -9) 기준 측정:

| 번들 | Minified | Gzip |
| --- | --- | --- |
| `@guksu/wvkit-core/scroll-container` | 22.4 KB | 8.7 KB |

0.5 이전에는 같은 컴포넌트가 트리셰이킹된 Three.js 일부(minified 259 KB, gzip 60 KB)를 함께 가져왔습니다.

React·Vue 층은 CI 에서 `size-limit` 로 잽니다(minified, brotli, `@guksu/wvkit-core`·React·React DOM·Vue 제외). 훅은 약 0.5 KB, 컴포넌트(`ScrollContainer` + `ScrollPanel`)는 약 1.2~1.3 KB 입니다. 훅만 가져오면 컴포넌트 코드는 번들에 들어가지 않습니다.

## 알려진 제한사항

- **`direction: 'both'` 는 사용 중단입니다.** `horizontal` 과 똑같이 동작하고(패널은 X 축으로 한 줄, 넘기기도 X 축만) 1.0 에서 제거합니다. 두 축으로 넘기는 페이저는 없습니다. Swiper(`direction`), Embla(`axis`), Android ViewPager2(`orientation`)도 한 축으로만 넘깁니다.
- **core 와 훅은 `panels` 를 `HTMLElement[]` 로 받습니다.** DOM 노드를 직접 만들어 배열로 넘기거나, [컴포넌트](#컴포넌트-scrollcontainer-·-scrollpanel)로 패널을 React/Vue 자식으로 쓰세요.
- **컴포넌트는 서버에서 패널 내용을 그리지 않습니다.** 패널 내용은 브라우저에서 마운트된 뒤 나타납니다. 제어형 `activeIndex` prop 은 없습니다. `onIndexChange` 와 `ref` 핸들을 쓰세요.
- **가상화가 패널 루트의 `panel.style.display`를 토글합니다** (`position`, `transform`, `user-select`, `draggable`도 루트에 설정). 패널 콘텐츠가 루트에 같은 속성을 설정하면 충돌하니, 자체 스타일은 패널 루트가 아닌 자식 요소에 두세요.
- **옵션이나 패널 목록을 바꾸면 진행 중인 제스처가 멈춥니다.** `setOptions`·`setPanels`(와 이를 부르는 어댑터)는 실제로 바뀐 것이 있으면 진행 중인 끌기·핀치·스냅 애니메이션을 취소합니다. 터치가 움직일 때마다가 아니라 제스처 사이에 바꾸세요.
- **핀치 줌과 더블탭은 `PointerEvent`와 `touch-action: none` CSS 힌트에 의존**합니다. `PointerEvent`를 지원하지 않는 매우 오래된 WebView 빌드에서는 둘 다 조용히 무시됩니다.
- **`setPointerCapture`가 모든 WebView 빌드에서 사용 가능하진 않습니다.** 구현은 `try/catch`로 가드되어 있고, 캡처를 지원하지 않는 환경에서는 드래그 중 포인터가 root를 벗어나면 제스처가 일찍 종료될 수 있습니다.
- **패널 안의 `position: fixed`는 뷰포트에 고정되지 않습니다.** 패널이 CSS transform 되어 있어 `fixed` 자손이 패널 기준으로 잡히고 패널과 함께 스크롤됩니다. 고정 오버레이는 호스트 컨테이너 밖에 그리세요.
- **`<img>` 위에서 시작한 마우스 드래그는 네이티브 drag-and-drop을 시작해** 제스처를 취소합니다(데스크톱). 패널 안 이미지에 `draggable="false"`를 주세요.
- **세로 페이저에 세로로 스크롤되는 패널은 지원하지 않습니다.** 터치 기기에서는 패널 스크롤이 끝나도 스와이프로 패널을 전혀 넘길 수 없습니다. [지원하지 않음: 세로 페이저 + 세로로 스크롤되는 패널](#지원하지-않음-세로-페이저-세로로-스크롤되는-패널)을 보세요.
- **줌 상태 교차 축 pan은 그 축으로 스크롤하지 않는 패널에서만 됩니다.** `touch-action: pan-y`를 준 패널은 세로 터치를 자체 네이티브 스크롤에 넘기므로, `horizontal` 페이저에서는 스크롤 없는 패널(이미지 뷰어·카드)만 줌 상태에서 세로로 움직입니다.
- **휠 제스처 하나는 한 패널만 넘기고, 줌 상태에서는 페이지를 넘기지 못합니다.** 첫 이동 뒤의 트랙패드 관성은 무시되고, 마우스 휠을 빠르게 돌려도 120ms 쉬기 전까지는 한 제스처입니다. 줌 상태에서 휠은 패널 안을 움직이니, 패널을 바꾸려면 화살표를 쓰거나 줌을 풀어야 합니다.
- **키보드 단축키는 호스트에 포커스가 있을 때만 동작합니다.** 패널 안에 포커스가 있으면 그쪽 키 동작이 그대로입니다. 호스트의 포커스 링은 직접 스타일링해야 합니다.
- **비활성 패널의 `inert`는 포인터 이벤트도 막습니다.** `minZoom`이 1보다 작아 옆 패널이 보여도 활성이 되기 전에는 클릭할 수 없습니다. 필요하면 `a11y: false`로 끄세요.
- **드래그의 처음 `dragThreshold` px 동안은 페이저가 움직이지 않고, 방향은 한 번만 정합니다.** 세로로 시작한 제스처는 도중에 페이지 넘기기로 바뀌지 않습니다. 45° 근처에서 휘는 스와이프는 페이저와 브라우저가 다르게 판단할 수 있고, 그러면 둘 다 움직이지 않습니다. 더 빨리 시작하려면 `dragThreshold`를 낮추고, 이전 동작이 필요하면 `0`을 주세요.
- **플릭은 최대 한 패널만 넘깁니다.** 정착 시간은 놓는 속도에 따라 120~400ms로 달라지지만, 페이저 축에서 여러 패널을 지나가는 관성은 의도적으로 없습니다(네이티브 페이저와 같음).
- **패널 안 텍스트를 선택할 수 없습니다.** `CSS3DObject`가 모든 패널 요소에 `user-select: none`(과 `draggable="false"`)을 설정합니다. 패널 안 인풋은 동작합니다.
- **패널 DOM은 절대 언마운트되지 않습니다.** 가상화는 `overscan` 창 밖 패널을 떼어내거나 숨길 뿐이고, 모든 패널이 인스턴스가 살아 있는 동안 메모리에 남습니다. 긴 리스트는 패널 안에서 직접 가상화하세요.
- **스크롤되는 패널은 보이는 것마다 자기 컴포지터 레이어를 가집니다** (브라우저가 스크롤 컨테이너를 별도 레이어로 합성). `overscan: 1`이면 그런 레이어 3개가 동시에 살아 있습니다. 헤드리스 Chromium에서 이미지 150장 피드 패널은 412 × 47,773 px 레이어가 됐습니다. 저사양 기기에서는 `overscan`을 작게 두세요.
- **숨겨진 패널의 스크롤 위치는 Chromium에서는 유지되지만**(`display: none` 왕복 확인) **WebKit은 미검증입니다.** iOS에서 확인한 뒤 의존하세요.
- **줌 상태의 `scrollTo(index)`는 패널 중심으로 갑니다** (`align: 'start'` 면 시작 가장자리). 보고 있던 가장자리가 아닙니다.
- **패널 안 캐러셀은 끝에서 스와이프를 페이저에 넘기지 않습니다.** `noDragSelector` 를 쓰면 캐러셀 위에서 시작한 스와이프는 첫 장·마지막 장에서도 패널을 넘기지 않습니다. 핀치와 더블탭 줌도 그 위에서는 시작하지 않습니다.
- **옆에 보이는 이웃 패널은 누를 수 없습니다.** `a11y: true`(기본값)면 활성 패널을 뺀 모든 패널에 `inert` 가 붙습니다. 그래서 옆에 보이는 패널을 눌러도 아무 일도 없습니다. 스와이프로 넘기거나, `a11y: false` 로 끄고 탭을 직접 처리하세요.
- **좁은 패널이면 첫 패널과 마지막 패널 옆에 빈 공간이 생깁니다.** `align: 'center'` 는 첫 패널 앞과 마지막 패널 뒤에, `align: 'start'` 는 마지막 패널 뒤에 빈 공간이 보입니다. 양 끝을 호스트 가장자리에 붙이는 옵션은 아직 없습니다.
- **`panelWidth` 는 `horizontal` 에서만 씁니다.** `vertical` 페이저는 `panelHeight` 를 쓰고 `panelWidth` 는 무시합니다.
