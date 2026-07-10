# ScrollContainer

## 문제 배경

네이티브 앱은 동일한 높이의 패널을 나란히 배치하고, 각 패널이 독립적인 세로 스크롤을 가지며, 상위 가로 제스처로 뷰포트를 전환합니다 — 그 위에 핀치 줌도 자주 요구됩니다. CSS `overflow-x` / `overflow-y`만으로는 WebView에서 이를 안정적으로 구현할 수 없습니다. 대각 스크롤 방지, 축 정렬 스냅, 핀치 줌과 pan의 합성 같은 정밀 제어가 표준 스크롤 프리미티브로는 불가능합니다.

`ScrollContainer`는 사용자가 *보는* 영역(viewport)과 *콘텐츠 평면*(scene)을 카메라 추상화로 분리해 이 문제를 해결합니다.

## 아키텍처

**[Three.js](https://threejs.org/) + `CSS3DRenderer` + `OrthographicCamera`** 위에 커스텀 **CameraControl**을 얹습니다:

- 패널을 `CSS3DObject`로 wrap해 단일 scene에 배치 — DOM 콘텐츠 보존(접근성·상호작용), 셰이더 불필요.
- `OrthographicCamera`로 원근 왜곡 없는 네이티브 뷰포트 느낌.
- 커스텀 CameraControl이 pointer 입력을 받아 카메라 행렬을 직접 계산: **축 제약 pan**, **스냅**, **엣지 저항**, **핀치 줌**.
- 가상화: `activeIndex ± overscan` 범위 밖 패널은 `visible=false` + `display:none`으로 숨김 처리해 렌더 DOM을 최소화.

`direction` 옵션의 의미는 "스와이프 방향"이 아니라 **카메라가 pan할 수 있는 축 제약**입니다:

- `horizontal`: X 축 pan만 — 가로 패널 전환
- `vertical`: Y 축 pan만 — 세로 패널 전환
- `both`: X+Y 자유 pan *(1.0에서는 `horizontal`로 폴백, 대각 스냅 정책은 후속 minor에서 정식 지원)*

## 설치

`three`는 호스트 앱이 제공하는 peer dependency입니다. React/Vue 어댑터는 `@guksu/wvkit-core`에 의존하므로 `three`는 자연스럽게 transitively external로 처리됩니다 — 호스트 앱 레벨에서 한 번만 설치하세요.

::: code-group
```sh [npm]
npm install @guksu/wvkit-core three
# 프레임워크에 따라 @guksu/wvkit-react 또는 @guksu/wvkit-vue 추가
```
```sh [pnpm]
pnpm add @guksu/wvkit-core three
```
:::

## 기본 사용법

::: code-group

```js [Vanilla JS]
import { createScrollContainer } from '@guksu/wvkit-core';

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
import { useScrollContainer } from '@guksu/wvkit-react';

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
import { useScrollContainer } from '@guksu/wvkit-vue';

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
호스트 컨테이너에 `touch-action: none` (또는 `touch-action: manipulation`)을 적용해 브라우저 기본 스크롤/줌이 우리 제스처 파이프라인과 충돌하지 않게 하세요. ScrollContainer가 핀치 줌을 단독으로 처리하길 원하면 페이지 viewport meta에 `user-scalable=no, maximum-scale=1.0` 도 함께 설정하세요.
:::

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
| `onZoomChange`    | `(zoom: number) => void`                   | —              | 줌 레벨이 변경될 때 호출.                                                                           |

잘못된 옵션 (`panels` 비어있음, `minZoom ≤ 0`, `maxZoom < minZoom`, `snapThreshold ∉ (0,1]`, `resistance ∉ [0,1]`) 은 생성 시점에 `WebviewHeadlessError`를 throw합니다.

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

`three`는 `@guksu/wvkit-core`에 **번들되지 않습니다** — `external`로 선언되어 호스트 앱이 peer dependency로 제공해야 합니다.

ScrollContainer가 사용하는 부분만 (코어 수학 + `CSS3DRenderer` + `OrthographicCamera`) 트리셰이킹할 때 `three`는 최종 번들에 약 **~150 KB gzipped** 정도 추가됩니다. `@guksu/wvkit-core` 자체는 약 25 KB (~10 KB gzipped) 추가. 정확한 수치는 번들러와 호스트 앱의 다른 Three.js 사용에 따라 다르며, 릴리스마다 changelog에서 측정·공지됩니다.

## 알려진 제한사항

- **`direction: 'both'`**는 현재 `horizontal`로 폴백 — 패널은 X축 일렬 배치되고 pan도 X 축만 동작합니다. 대각 스냅 정책은 후속 minor 릴리스에서 정식 지원됩니다.
- **`panels`는 `HTMLElement[]`** 이며 React/Vue 자식 컴포넌트가 아닙니다. DOM 노드를 명령형(예: `document.createElement`)으로 만들어 배열로 전달하세요. 상위 레벨 render-prop / `<PanelGroup>` API는 로드맵에 있습니다.
- **가상화가 `panel.style.display`를 토글합니다** (`CSS3DObject.visible`과 병행). 이는 CSS3D에서 `visible=false`를 일관되게 처리하지 못하는 Three.js 버전 대비용 의도된 belt-and-suspenders 패턴입니다. 패널 콘텐츠 자체가 `display`를 설정한다면 충돌할 수 있으니, `display`는 패널 루트가 아닌 자식 요소에 두는 것을 권장합니다.
- **옵션은 마운트 시점에 고정됩니다.** 런타임에 옵션(예: `direction`)을 바꾸려면 프레임워크 어댑터에서 컴포넌트를 재마운트해야 합니다 — wrapper에 `key` prop을 사용하세요.
- **핀치 줌은 `PointerEvent`와 `touch-action: none` CSS 힌트에 의존**합니다. `PointerEvent`를 지원하지 않는 매우 오래된 WebView 빌드에서는 핀치가 조용히 무시됩니다.
- **`setPointerCapture`가 모든 WebView 빌드에서 사용 가능하진 않습니다.** 구현은 `try/catch`로 가드되어 있고, 캡처를 지원하지 않는 환경에서는 드래그 중 포인터가 root를 벗어나면 제스처가 일찍 종료될 수 있습니다.
