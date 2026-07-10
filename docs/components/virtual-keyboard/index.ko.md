# useVirtualKeyboard

## 문제 배경

WebView 앱은 소프트 키보드가 열리고 닫히는 시점을 알아야 레이아웃을 수동으로 조정할 수 있습니다 — 예를 들어, 채팅 입력창을 키보드 위로 밀어올리거나 가려진 콘텐츠를 노출할 때 필요합니다. 신뢰할 수 있는 크로스플랫폼 이벤트는 존재하지 않습니다. `window.resize`는 iOS에서 일관성이 없고, `visualViewport`는 모든 환경에서 지원되지 않습니다.

`useVirtualKeyboard`는 마운트 시점에 캡처한 기준 높이와 현재 `visualViewport.height`를 비교해 키보드 상태를 추론합니다. 플랫폼별 폴백도 포함합니다.

## 설치

::: code-group
```sh [npm]
npm install @guksu/wvkit-core
```
```sh [pnpm]
pnpm add @guksu/wvkit-core
```
:::

## 기본 사용법

::: code-group

```js [Vanilla JS]
import { createVirtualKeyboard } from '@guksu/wvkit-core';

const instance = createVirtualKeyboard({
  onChange: ({ isOpen, keyboardHeight }) => {
    document.getElementById('chat-bar').style.transform =
      isOpen ? `translateY(-${keyboardHeight}px)` : '';
  },
});

instance.destroy();
```

```tsx [React]
import { useVirtualKeyboard } from '@guksu/wvkit-react';

function ChatLayout() {
  const { isOpen, keyboardHeight } = useVirtualKeyboard();
  return (
    <div style={{ paddingBottom: isOpen ? keyboardHeight : 0 }}>
      {/* 콘텐츠 */}
    </div>
  );
}
```

```vue [Vue]
<script setup>
import { useVirtualKeyboard } from '@guksu/wvkit-vue';
const { isOpen, keyboardHeight } = useVirtualKeyboard();
</script>
<template>
  <div :style="{ paddingBottom: isOpen ? keyboardHeight + 'px' : 0 }">
    <!-- 콘텐츠 -->
  </div>
</template>
```

:::

## 동작 원리

1. 마운트 시 `visualViewport.height` (또는 `window.innerHeight`)를 `baseHeight`로 저장.
2. `visualViewport.resize` 이벤트 구독 (`window.resize` 폴백).
3. 이벤트 발생 시: `delta = baseHeight - currentHeight`. `delta > threshold`이면 키보드 열림.
4. `keyboardHeight`는 열린 경우 `delta`, 닫힌 경우 `0`.

## API 레퍼런스

### 옵션

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `onChange` | `(state: VirtualKeyboardState) => void` | `undefined` | 키보드 상태 변경 시 호출 |
| `threshold` | `number` | `100` | 키보드 열림으로 판단할 최소 높이 변화 (px) |

### 인스턴스

| 멤버 | 타입 | 설명 |
|------|------|------|
| `isOpen` | `boolean` (getter) | 현재 키보드 열림 여부 |
| `keyboardHeight` | `number` (getter) | 추정 키보드 높이 (px) |
| `destroy()` | `void` | 이벤트 리스너 제거 |

### `VirtualKeyboardState`

```ts
interface VirtualKeyboardState {
  isOpen: boolean;
  keyboardHeight: number;
}
```

## 브라우저 지원

| 환경 | 지원 여부 |
|------|-----------|
| iOS Safari 15+ | ✅ (`visualViewport` 사용) |
| WKWebView (iOS) | ✅ (`visualViewport` 사용) |
| Android Chrome 62+ | ✅ (`visualViewport` 사용) |
| Android WebView | ✅ (`window.resize` 폴백) |
| Samsung Internet 14+ | ✅ |
| 데스크톱 | ✅ (키보드 없음 → 항상 `isOpen: false`) |

## 알려진 제한사항

- 높이 기반 추론 방식: 분할 화면, 플로팅 키보드, 브라우저 툴바 변화가 오탐을 유발할 수 있습니다. `threshold`를 조정해 줄이세요.
- `keyboardHeight`는 뷰포트 수축으로 계산한 추정값으로, 실제 네이티브 키보드 높이와 다를 수 있습니다.
- `baseHeight`는 마운트 시점에 결정되지만 자가 회복합니다: 뷰포트가 기준보다 커지는 순간(예: 키보드 닫힘)마다 기준값이 갱신되므로, 키보드가 열린 상태에서 인스턴스를 생성해도 그 첫 세션만 감지하지 못합니다.
- Android WebView가 `adjustPan` 모드(`android:windowSoftInputMode`)면 키보드가 열려도 뷰포트 크기가 변하지 않아 — `visualViewport`도 `window.resize`도 발화하지 않아 — 감지가 불가능합니다. 호스트 앱이 `adjustResize`를 사용해야 합니다.
- SSR 환경에서는 항상 `{ isOpen: false, keyboardHeight: 0 }`을 반환합니다.
