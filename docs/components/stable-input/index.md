# StableInput

## Problem

On iOS Safari and WKWebView, focusing an `<input>` triggers a `visualViewport` resize and a simultaneous scroll, causing the entire page layout to jump. This is especially disruptive in full-screen WebView apps that mimic native layout — the page shifts unpredictably every time the user taps an input field.

`StableInput` solves this with a dual-input architecture:
- **Display input** — the visible input the user sees. Styled by the consumer. Never focused.
- **Hidden input** — positioned off-screen with `position: fixed; top: -9999px`. Receives actual focus and handles keyboard input.

Because the hidden input is `position: fixed`, iOS does not scroll the page when it gains focus. The visible input mirrors the hidden input's value and reflects focus state via `data-focused`.

## Installation

::: code-group
```sh [npm]
npm install @guksu/wvkit-core
```
```sh [pnpm]
pnpm add @guksu/wvkit-core
```
:::

## Basic Usage

::: code-group

```js [Vanilla JS]
import { createStableInput } from '@guksu/wvkit-core';

const container = document.getElementById('search-container');
const si = createStableInput(container, {
  placeholder: 'Search…',
  onChange: (value) => console.log(value),
  onSubmit: (value) => search(value),
});

si.focus();
si.setValue('hello');
si.destroy();
```

```tsx [React]
import { useStableInput, StableInputDisplay } from '@guksu/wvkit-react';

function SearchBar() {
  const inputProps = useStableInput({
    placeholder: 'Search…',
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
import { useStableInput } from '@guksu/wvkit-vue';

const { containerRef, focus, setValue } = useStableInput({
  placeholder: 'Search…',
  onChange: (value) => console.log(value),
});
</script>
<template>
  <div ref="containerRef" class="search-input" />
</template>
```

:::

## Styling Focus State

The display input gets `data-focused="true"` when the hidden input has focus. Use it in CSS to style the focused state:

```css
/* Vanilla CSS */
.search-input input[data-focused="true"] {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
}
```

## API Reference

### Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string` | `'text'` | Input type |
| `placeholder` | `string` | `''` | Placeholder text |
| `inputMode` | `string` | — | Virtual keyboard layout hint (`'numeric'`, `'email'`, etc.) |
| `autocomplete` | `string` | — | Autocomplete attribute |
| `onFocus` | `() => void` | — | Called when hidden input gains focus |
| `onBlur` | `() => void` | — | Called when hidden input loses focus |
| `onChange` | `(value: string) => void` | — | Called on every keystroke |
| `onSubmit` | `(value: string) => void` | — | Called on Enter key |
| `suppressLayoutShift` | `boolean` | `true` | Enable visualViewport-based scroll anchor |
| `scrollAnchor` | `'top' \| 'bottom' \| 'none'` | `'bottom'` | Where to anchor scroll when keyboard opens |

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `focus()` | `void` | Focuses the hidden input |
| `blur()` | `void` | Blurs the hidden input |
| `setValue(value)` | `void` | Sets value on both inputs |
| `getValue()` | `string` | Returns current value |
| `destroy()` | `void` | Removes both inputs and all event listeners |

## Browser Support

| Environment | Support |
|-------------|---------|
| iOS Safari 15+ | ✅ |
| WKWebView (iOS) | ✅ |
| Android Chrome 90+ | ✅ |
| Android WebView | ✅ |
| Samsung Internet 14+ | ✅ |
| Desktop Chrome/Firefox | ✅ |

## Limitations

- Password managers and autofill may not recognize the hidden input. Set `autocomplete` explicitly (e.g., `'off'` or `'current-password'`).
- IME composition (CJK input) works but the display input may lag by one composition cycle. For production CJK apps, test carefully.
- Touches that move more than 10px between `touchstart` and `touchend` are treated as scroll gestures and do not focus the input — a scroll that starts and ends on the input will not open the keyboard.
- `scrollAnchor` relies on `visualViewport` — no adjustment occurs on browsers that don't support it.
- **No caret, no text selection, no copy/paste menu on the visible input.** The display input is `readOnly` and never focused; it only mirrors the hidden input's value. Users cannot place the cursor in the middle of the text. This fits search and chat bars, not editing of longer text.
- **Not a native form field.** The hidden input is appended to `document.body` (outside your `<form>`) and has no `name`, so form submit and `FormData` never include it. Read the value through `onChange` / `getValue()` and submit yourself.
- **Desktop tab order skips the field.** The display input has `tabIndex="-1"` and the hidden input sits at the end of `<body>`, so Tab reaches it last.
- **Only `type`, `placeholder`, `inputMode`, and `autocomplete` are forwarded** to the hidden input. `maxLength`, `pattern`, `required`, `name`, and other attributes are not applied.
- **`scrollAnchor` scrolls the window only** (`window.scrollBy` / `window.scrollTo`). An input inside an inner scroller is not brought into view.
- **Each instance appends one hidden input to `<body>`.** Always call `destroy()` on unmount.
