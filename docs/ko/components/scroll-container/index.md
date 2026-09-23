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
- `both`: X+Y 자유 pan *(1.0에서는 `horizontal`로 폴백, 대각 스냅 정책은 후속 minor에서 정식 지원)*

## 설치

peer dependency가 없습니다. React/Vue 어댑터는 `@guksu/wvkit-core`에 의존합니다.

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

## 스크롤되는 패널 (피드·리스트·긴 콘텐츠)

패널이 각자 세로로 스크롤되는 가로 페이저에는 규칙이 하나 더 있습니다. **스크롤되는 패널마다 반드시 `touch-action: pan-y`를 주세요** (호스트 컨테이너는 그대로 `touch-action: none`).

```js
const panel = document.createElement('div');
panel.style.overflowY = 'auto'; // 패널이 자기 콘텐츠를 스크롤
panel.style.touchAction = 'pan-y'; // 세로 터치는 네이티브 스크롤, 가로 터치는 ScrollContainer로
```

이유: 브라우저는 터치한 요소부터 가장 가까운 *스크롤 가능한* 조상까지의 `touch-action`만 보고 터치 처리를 결정합니다. 그 조상이 패널 자신이라 호스트의 `touch-action: none`은 아예 참조되지 않습니다. 패널이 기본값 `auto`(또는 `manipulation`)이면 브라우저가 가로 터치까지 가져가 `pointercancel`을 내고, 페이저는 절대 넘어가지 않습니다. `pan-y`를 주면 세로 터치는 관성까지 네이티브 스크롤로, 가로 터치는 페이저로 전달되고, 대각 터치는 네이티브 페이저처럼 큰 축 쪽으로 정리됩니다.

- `direction: 'vertical'`은 세로 스크롤되는 패널과 함께 쓸 수 없습니다. 네이티브 스크롤이 항상 제스처를 가져갑니다. 세로 페이저에는 높이가 고정된, 스크롤되지 않는 패널을 쓰세요.
- 패널 안 이미지에는 `loading="lazy"`를 주세요. `overscan` 창 밖의 패널은 문서에서 떼어져 있어, lazy 이미지는 패널이 보일 때까지 요청되지 않습니다.
- 데스크톱: `<img>` 위에서 시작한 마우스 드래그는 네이티브 drag-and-drop을 시작해 제스처를 취소합니다. 패널 안 이미지에 `draggable="false"`를 주세요.

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

- **휠·트랙패드** (`wheel: true`, 기본). 페이저 축 방향 휠 제스처 하나에 한 패널이 움직입니다. 델타를 제스처(120ms 안에 이어지는 이벤트) 단위로 누적해 40px을 넘으면 한 번 넘기고, 그 제스처의 나머지는 무시합니다. 그래서 트랙패드 관성이 여러 패널을 건너뛰지 않습니다. 교차 축 성분이 더 큰 휠(가로 페이저에서의 세로 스크롤)은 손대지 않고, 그 방향으로 더 스크롤할 수 있는 중첩 스크롤러(`overflow-x: auto` 칩 줄) 위에서도 네이티브에 맡깁니다. 줌 상태에서는 휠이 페이지를 넘기지 않고 패널 안에서 카메라를 움직입니다. `Ctrl` + 휠(트랙패드 핀치가 페이지에 이렇게 옵니다)은 커서를 중심으로 줌합니다. 소비한 휠만 `preventDefault` 하므로 Chromium의 macOS 가로 스와이프 뒤로가기도 막힙니다. Safari에서는 페이지에 `overscroll-behavior-x: none`이 따로 필요합니다.
- **키보드** (`keyboard: true`, 기본). 호스트 자신에 포커스가 있을 때: 페이저 축 방향 화살표로 한 패널 이동, `Home` / `End`로 첫/끝 패널, 줌 상태에서 `Escape`로 `minZoom` 복귀. 패널 안(인풋·버튼)에 포커스가 있으면 키를 건드리지 않아 패널 콘텐츠의 키보드 동작이 그대로입니다. 호스트에 `tabindex`가 없으면 `tabindex="0"`을 줍니다. `:focus-visible` 스타일은 직접 주세요.
- **ARIA** (`a11y: true`, 기본). WAI-ARIA APG 캐러셀 패턴을 따릅니다. 호스트에 `role="group"`과 `aria-roledescription="carousel"`, 각 패널에 `role="group"`, `aria-roledescription="slide"`, `aria-label="n / N"`, 활성이 아닌 패널에는 `aria-hidden="true"`와 `inert`를 줘서 화면 밖 패널이 스크린리더와 Tab 순서에서 빠집니다. 이미 있는 속성은 건드리지 않고, 접근 가능한 이름은 만들어 내지 않습니다. 호스트에 `aria-label`을 주세요. `inert`는 모르는 브라우저(Chrome 102 미만 WebView, iOS 15.5 미만)에서 무시되고 `aria-hidden`만 남습니다.

## 스냅과 관성

- 손을 떼면 항상 패널(zoom ≤ 1) 또는 투영된 정지점·가장자리·gap 목표(zoom > 1)로 스냅합니다. 정착 시간은 손가락 속도에 이어집니다: ease-out 곡선이 놓는 순간 속도로 시작하도록 `duration = 3 × 거리 / 속도`로 정하고, 120ms와 거리 비례 상한 400ms(줌 상태 자유 pan은 800ms) 사이로 자릅니다. 멈춘 채 놓으면 상한을 쓰고, 목표 반대 방향 속도(고무줄 복귀)는 무시합니다.
- 한 제스처에 한 패널. 네이티브 페이저처럼 플릭이 패널을 건너뛰지 않습니다. `snapThreshold`와 속도 가중치가 "머물기"와 "한 칸 이동" 사이를 결정합니다.
- `scrollTo()` / `zoomTo()`의 `animated: true`는 고정 300ms ease-out입니다.
- `zoomTo()`는 새 줌 기준으로 활성 패널 범위 안(양 축)에 카메라를 넣습니다. 줌을 1로 되돌리면 패널 중심에 놓입니다.
- 줌 트윈 도중 탭으로 끊어도 줌이 중간값에 머물지 않습니다. 릴리스가 마지막으로 정한 줌(`zoomTo`·핀치·더블탭)으로 이어갑니다.

## API 레퍼런스

### 옵션

| Prop              | 타입                                       | 기본값         | 설명                                                                                                |
| ----------------- | ------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------- |
| `direction`       | `'horizontal' \| 'vertical' \| 'both'`     | _(필수)_       | 카메라 pan 축 제약. `'both'`는 1차 릴리스에서 `'horizontal'`로 폴백.                                |
| `panels`          | `HTMLElement[]`                            | _(필수)_       | scene에 `CSS3DObject`로 추가될 미리 만들어진 DOM 노드. 빈 배열은 throw.                             |
| `initialIndex`    | `number`                                   | `0`            | 마운트 시 활성 패널 인덱스. `[0, panels.length-1]`로 클램프.                                        |
| `panelHeight`     | `(index: number) => number`                | _(root 높이)_  | `vertical`/`both`용 패널별 픽셀 높이. 지정 안 하면 root 클라이언트 높이 사용.                       |
| `onIndexChange`   | `(index: number) => void`                  | —              | 활성 패널이 변경될 때 호출 (scrollTo 또는 pan 스냅).                                                |
| `overscan`        | `number`                                   | `1`            | 활성 패널 양쪽으로 유지할 패널 수. `0`이면 활성 패널만 노출.                                        |
| `snapThreshold`   | `number ∈ (0, 1]`                          | `0.3`          | 다음 패널로 스냅하기 위한 드래그 비율 (패널 크기 대비).                                              |
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

잘못된 옵션 (`panels` 비어있음, `minZoom ≤ 0`, `maxZoom < minZoom`, `doubleTapZoom ∉ (minZoom, maxZoom]`, `snapThreshold ∉ (0,1]`, `resistance ∉ [0,1]`) 은 생성 시점에 `WebviewHeadlessError`를 throw합니다.

### 인스턴스 메서드

| 메서드                                    | 반환     | 설명                                                                                                |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `scrollTo(index, { animated? })`          | `void`   | 지정 패널로 이동. `animated`는 기본값 `true` (easing 트윈).                                         |
| `getActiveIndex()`                        | `number` | 현재 활성 패널 인덱스 반환.                                                                         |
| `zoomTo(level, { animated? })`            | `void`   | 줌 레벨 설정 (클램프). `animated` 기본값 `true`.                                                    |
| `getZoom()`                               | `number` | 현재 줌 레벨 반환.                                                                                  |
| `destroy()`                               | `void`   | 모든 pointer 리스너, renderer DOM 제거 + 숨겨진 패널 `display` 복원. 멱등성 보장.                   |

### 프레임워크 어댑터 반환값

| 필드           | 타입 (React)                            | 타입 (Vue)                              |
| -------------- | --------------------------------------- | --------------------------------------- |
| `containerRef` | `RefObject<HTMLDivElement>`             | `Ref<HTMLElement \| null>`              |
| `activeIndex`  | `number`                                | `Ref<number>`                           |
| `activeZoom`   | `number`                                | `Ref<number>`                           |
| `scrollTo`     | `(i, opts?) => void` (stable callback)  | `(i, opts?) => void`                    |
| `zoomTo`       | `(z, opts?) => void` (stable callback)  | `(z, opts?) => void`                    |

::: warning 콜백이 아닌 옵션은 마운트 시점에 1회 고정
React 훅과 Vue 컴포저블은 콜백이 아닌 옵션(`panels`, `direction`, `minZoom` 등)을 인스턴스 생성 시점에 1회만 읽습니다 — 이후 변경은 조용히 무시됩니다. 콜백(`onIndexChange`, `onZoomChange`)만 렌더를 거쳐도 최신으로 유지됩니다. `panels` 등 non-callback 옵션을 교체하려면 재마운트를 강제하세요 — React는 호스트 컴포넌트의 `key` 변경, Vue는 `:key` / `v-if`를 사용합니다.
:::

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
| `@guksu/wvkit-core/scroll-container` | 16.4 KB | 6.5 KB |

0.5 이전에는 같은 컴포넌트가 트리셰이킹된 Three.js 일부(minified 259 KB, gzip 60 KB)를 함께 가져왔습니다.

## 알려진 제한사항

- **`direction: 'both'`**는 현재 `horizontal`로 폴백 — 패널은 X축 일렬 배치되고 pan도 X 축만 동작합니다. 대각 스냅 정책은 후속 minor 릴리스에서 정식 지원됩니다.
- **`panels`는 `HTMLElement[]`** 이며 React/Vue 자식 컴포넌트가 아닙니다. DOM 노드를 명령형(예: `document.createElement`)으로 만들어 배열로 전달하세요. 상위 레벨 render-prop / `<PanelGroup>` API는 로드맵에 있습니다.
- **가상화가 패널 루트의 `panel.style.display`를 토글합니다** (`position`, `transform`, `user-select`, `draggable`도 루트에 설정). 패널 콘텐츠가 루트에 같은 속성을 설정하면 충돌하니, 자체 스타일은 패널 루트가 아닌 자식 요소에 두세요.
- **옵션은 마운트 시점에 고정됩니다.** 런타임에 옵션(예: `direction`)을 바꾸려면 프레임워크 어댑터에서 컴포넌트를 재마운트해야 합니다 — wrapper에 `key` prop을 사용하세요.
- **핀치 줌과 더블탭은 `PointerEvent`와 `touch-action: none` CSS 힌트에 의존**합니다. `PointerEvent`를 지원하지 않는 매우 오래된 WebView 빌드에서는 둘 다 조용히 무시됩니다.
- **`setPointerCapture`가 모든 WebView 빌드에서 사용 가능하진 않습니다.** 구현은 `try/catch`로 가드되어 있고, 캡처를 지원하지 않는 환경에서는 드래그 중 포인터가 root를 벗어나면 제스처가 일찍 종료될 수 있습니다.
- **패널 안의 `position: fixed`는 뷰포트에 고정되지 않습니다.** 패널이 CSS transform 되어 있어 `fixed` 자손이 패널 기준으로 잡히고 패널과 함께 스크롤됩니다. 고정 오버레이는 호스트 컨테이너 밖에 그리세요.
- **`<img>` 위에서 시작한 마우스 드래그는 네이티브 drag-and-drop을 시작해** 제스처를 취소합니다(데스크톱). 패널 안 이미지에 `draggable="false"`를 주세요.
- **줌 상태 교차 축 pan은 그 축으로 스크롤하지 않는 패널에서만 됩니다.** `touch-action: pan-y`를 준 패널은 세로 터치를 자체 네이티브 스크롤에 넘기므로, `horizontal` 페이저에서는 스크롤 없는 패널(이미지 뷰어·카드)만 줌 상태에서 세로로 움직입니다.
- **휠 제스처 하나는 한 패널만 넘기고, 줌 상태에서는 페이지를 넘기지 못합니다.** 첫 이동 뒤의 트랙패드 관성은 무시되고, 마우스 휠을 빠르게 돌려도 120ms 쉬기 전까지는 한 제스처입니다. 줌 상태에서 휠은 패널 안을 움직이니, 패널을 바꾸려면 화살표를 쓰거나 줌을 풀어야 합니다.
- **키보드 단축키는 호스트에 포커스가 있을 때만 동작합니다.** 패널 안에 포커스가 있으면 그쪽 키 동작이 그대로입니다. 호스트의 포커스 링은 직접 스타일링해야 합니다.
- **비활성 패널의 `inert`는 포인터 이벤트도 막습니다.** `minZoom`이 1보다 작아 옆 패널이 보여도 활성이 되기 전에는 클릭할 수 없습니다. 필요하면 `a11y: false`로 끄세요.
- **플릭은 최대 한 패널만 넘깁니다.** 정착 시간은 놓는 속도에 따라 120~400ms로 달라지지만, 페이저 축에서 여러 패널을 지나가는 관성은 의도적으로 없습니다(네이티브 페이저와 같음).
- **패널 안 텍스트를 선택할 수 없습니다.** `CSS3DObject`가 모든 패널 요소에 `user-select: none`(과 `draggable="false"`)을 설정합니다. 패널 안 인풋은 동작합니다.
- **패널 DOM은 절대 언마운트되지 않습니다.** 가상화는 `overscan` 창 밖 패널을 떼어내거나 숨길 뿐이고, 모든 패널이 인스턴스가 살아 있는 동안 메모리에 남습니다. 긴 리스트는 패널 안에서 직접 가상화하세요.
- **스크롤되는 패널은 보이는 것마다 자기 컴포지터 레이어를 가집니다** (브라우저가 스크롤 컨테이너를 별도 레이어로 합성). `overscan: 1`이면 그런 레이어 3개가 동시에 살아 있습니다. 헤드리스 Chromium에서 이미지 150장 피드 패널은 412 × 47,773 px 레이어가 됐습니다. 저사양 기기에서는 `overscan`을 작게 두세요.
- **숨겨진 패널의 스크롤 위치는 Chromium에서는 유지되지만**(`display: none` 왕복 확인) **WebKit은 미검증입니다.** iOS에서 확인한 뒤 의존하세요.
- **줌 상태의 `scrollTo(index)`는 패널 중심으로 갑니다.** 보고 있던 가장자리가 아닙니다.
