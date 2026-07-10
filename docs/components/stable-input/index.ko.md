# StableInput

## 문제 배경

iOS Safari와 WKWebView에서 `<input>`에 포커스하면 `visualViewport` 리사이즈와 스크롤이 동시에 발생해 전체 페이지 레이아웃이 순간적으로 튀어 오릅니다. 네이티브 레이아웃을 모방하는 풀스크린 WebView 앱에서 특히 심각합니다 — 인풋을 탭할 때마다 페이지가 예측 불가능하게 이동합니다.

`StableInput`은 듀얼 인풋 구조로 이를 해결합니다:
- **디스플레이 인풋** — 사용자가 보는 인풋. 스타일은 소비자가 담당. 포커스되지 않음.
- **숨김 인풋** — `position: fixed; top: -9999px`으로 화면 밖에 배치. 실제 포커스와 키 입력을 처리.

숨김 인풋이 `position: fixed`이기 때문에 iOS가 포커스 시 페이지를 스크롤하지 않습니다. 디스플레이 인풋은 숨김 인풋의 값을 미러링하고, `data-focused`로 포커스 상태를 반영합니다.

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
import { createStableInput } from '@wvkit/core';

const container = document.getElementById('search-container');
const si = createStableInput(container, {
  placeholder: '검색어 입력…',
  onChange: (value) => console.log(value),
  onSubmit: (value) => search(value),
});

si.focus();
si.setValue('hello');
si.destroy();
```

```tsx [React]
import { useStableInput, StableInputDisplay } from '@wvkit/react';

function SearchBar() {
  const inputProps = useStableInput({
    placeholder: '검색어 입력…',
    onChange: (value) => console.log(value),
    onSubmit: (value) => search(value),
  });

  return (
    <StableInputDisplay
      {...inputProps}
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 16,
      }}
    />
  );
}
```

```vue [Vue]
<script setup>
import { useStableInput } from '@wvkit/vue';

const { containerRef, focus, setValue } = useStableInput({
  placeholder: '검색어 입력…',
  onChange: (value) => console.log(value),
});
</script>
<template>
  <div ref="containerRef" class="search-input" />
</template>
```

:::

## 포커스 스타일링

숨김 인풋에 포커스가 잡히면 디스플레이 인풋에 `data-focused="true"`가 추가됩니다. CSS에서 이를 활용해 포커스 상태를 스타일링하세요:

```css
.search-input input[data-focused="true"] {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
}
```

## API 레퍼런스

### 옵션

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `type` | `string` | `'text'` | 인풋 타입 |
| `placeholder` | `string` | `''` | 플레이스홀더 텍스트 |
| `inputMode` | `string` | — | 가상 키보드 레이아웃 힌트 (`'numeric'`, `'email'` 등) |
| `autocomplete` | `string` | — | 자동완성 속성 |
| `onFocus` | `() => void` | — | 숨김 인풋 포커스 시 호출 |
| `onBlur` | `() => void` | — | 숨김 인풋 블러 시 호출 |
| `onChange` | `(value: string) => void` | — | 키 입력 시마다 호출 |
| `onSubmit` | `(value: string) => void` | — | Enter 키 입력 시 호출 |
| `suppressLayoutShift` | `boolean` | `true` | visualViewport 기반 스크롤 앵커 활성화 |
| `scrollAnchor` | `'top' \| 'bottom' \| 'none'` | `'bottom'` | 키보드 등장 시 스크롤 앵커 위치 |

### 인스턴스 메서드

| 메서드 | 반환값 | 설명 |
|--------|--------|------|
| `focus()` | `void` | 숨김 인풋 포커스 |
| `blur()` | `void` | 숨김 인풋 블러 |
| `setValue(value)` | `void` | 두 인풋 값 동시 변경 |
| `getValue()` | `string` | 현재 값 반환 |
| `destroy()` | `void` | 두 인풋 및 모든 이벤트 리스너 제거 |

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

- 패스워드 매니저와 자동완성이 숨김 인풋을 인식하지 못할 수 있습니다. `autocomplete`를 명시적으로 설정하세요 (예: `'off'` 또는 `'current-password'`).
- IME 조합 입력 (한/중/일)은 동작하지만 디스플레이 인풋이 한 조합 사이클 지연될 수 있습니다. 프로덕션 앱에서는 충분히 테스트하세요.
- `touchstart`와 `touchend` 사이 이동 거리가 10px을 넘는 터치는 스크롤 제스처로 간주해 포커스하지 않습니다 — 인풋 위에서 시작해 인풋 위에서 끝난 스크롤로 키보드가 열리지 않습니다.
- `scrollAnchor`는 `visualViewport`에 의존합니다 — 미지원 브라우저에서는 스크롤 조정이 이루어지지 않습니다.
