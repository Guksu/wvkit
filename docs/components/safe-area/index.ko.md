# useSafeArea

## 문제 배경

노치, 다이나믹 아일랜드, 홈 인디케이터가 있는 기기에서 WebView 앱은 안전 영역 인셋(상단 바, 홈 인디케이터, 라운드 코너)을 고려해야 합니다. CSS의 `env(safe-area-inset-*)` 값은 존재하지만 기본적으로 JavaScript에 노출되지 않아, 런타임에 이 값으로 레이아웃 로직이나 애니메이션을 구동하기가 어렵습니다.

`useSafeArea`는 CSS env 값을 JavaScript로 읽어와 방향 전환 및 리사이즈 시 자동으로 갱신합니다.

## 설치

::: code-group
```sh [npm]
npm install @wvkit/core
```
```sh [pnpm]
pnpm add @wvkit/core
```
:::

## 기본 사용법

::: code-group

```js [Vanilla JS]
import { createSafeArea } from '@wvkit/core';

const instance = createSafeArea({
  onChange: ({ top, bottom, left, right }) => {
    document.documentElement.style.setProperty('--sat', `${top}px`);
    document.documentElement.style.setProperty('--sab', `${bottom}px`);
  },
});

console.log(instance.getInsets()); // { top: 47, right: 0, bottom: 34, left: 0 }

instance.destroy();
```

```tsx [React]
import { useSafeArea } from '@wvkit/react';

function Layout({ children }) {
  const { top, bottom } = useSafeArea();
  return (
    <div style={{ paddingTop: top, paddingBottom: bottom }}>
      {children}
    </div>
  );
}
```

```vue [Vue]
<script setup>
import { useSafeArea } from '@wvkit/vue';
const insets = useSafeArea();
</script>
<template>
  <div :style="{ paddingTop: insets.top + 'px', paddingBottom: insets.bottom + 'px' }">
    <slot />
  </div>
</template>
```

:::

## 동작 원리

`document.body`에 hidden 센티넬 `<div>`를 추가하고, 해당 엘리먼트의 padding을 `env(safe-area-inset-*)` 값으로 설정합니다. 이후 `getComputedStyle`로 실제 픽셀 값을 읽어냅니다. `destroy()` 호출 시 센티넬이 제거됩니다.

env 값이 0이 아닌 실제 인셋을 반환하려면 HTML에 다음 `viewport` 메타 태그가 필요합니다:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

## API 레퍼런스

### 옵션

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `onChange` | `(insets: SafeAreaInsets) => void` | `undefined` | 인셋 변경 시 호출 (방향 전환/리사이즈) |

### 인스턴스 메서드

| 메서드 | 반환값 | 설명 |
|--------|--------|------|
| `getInsets()` | `SafeAreaInsets` | 현재 `{ top, right, bottom, left }` 값을 픽셀 단위로 반환 |
| `destroy()` | `void` | 이벤트 리스너 및 센티넬 엘리먼트 제거 |

### `SafeAreaInsets`

```ts
interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

## 브라우저 지원

| 환경 | 지원 여부 |
|------|-----------|
| iOS Safari 15+ | ✅ |
| WKWebView (iOS) | ✅ |
| Android Chrome 90+ | ✅ |
| Android WebView | ✅ |
| Samsung Internet 14+ | ✅ |
| 데스크톱 Chrome/Firefox | ✅ |

## 알려진 제한사항

- `viewport-fit=cover` 메타 태그가 없으면 모든 값이 `0`입니다.
- SSR 환경에서는 값이 `0` — 인셋은 마운트 시점에만 읽힙니다.
- 방향 전환 이벤트가 레이아웃 리플로우 완료 이전에 발생할 수 있습니다. 이 경우 `requestAnimationFrame`으로 지연하면 정확한 값을 얻을 수 있습니다.
