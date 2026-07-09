# useScrollLock

## 문제 배경

WebView 앱에서 모달이나 바텀 시트가 열릴 때, 뒤에 있는 페이지가 스크롤되지 않아야 합니다. `<body>`에 `overflow: hidden`만 적용하는 방법은 iOS Safari/WKWebView에서 신뢰할 수 없습니다 — 모달 뒤 페이지를 여전히 스와이프로 스크롤할 수 있습니다.

`useScrollLock`은 `position: fixed` + `top` 오프셋 기법을 사용합니다. iOS를 포함한 모든 WebView 환경에서 body 스크롤을 완전히 차단하는 유일한 신뢰할 수 있는 방법입니다.

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
import { createScrollLock } from '@wvkit/core';

const scrollLock = createScrollLock({
  onLock: () => console.log('잠금'),
  onUnlock: () => console.log('해제'),
});

// 모달 열기
scrollLock.lock();

// 모달 닫기
scrollLock.unlock();

// 정리
scrollLock.destroy();
```

```tsx [React]
import { useScrollLock } from '@wvkit/react';

function Modal({ isOpen, onClose }) {
  const { lock, unlock } = useScrollLock();

  useEffect(() => {
    if (isOpen) lock();
    else unlock();
  }, [isOpen]);

  return isOpen ? <div className="modal">...</div> : null;
}
```

```vue [Vue]
<script setup>
import { watch } from 'vue';
import { useScrollLock } from '@wvkit/vue';

const props = defineProps(['isOpen']);
const { lock, unlock } = useScrollLock();

watch(() => props.isOpen, (open) => {
  if (open) lock();
  else unlock();
});
</script>
```

:::

## 동작 원리

`lock()` 호출 시:
1. 현재 `window.scrollY` 저장
2. `document.body`에 `position: fixed; top: -<scrollY>px; overflow: hidden; width: 100%` 적용

`unlock()` 호출 시:
1. `document.body` 스타일 초기화
2. `window.scrollTo(0, scrollY)`로 이전 스크롤 위치 복원

이 덕분에 모달 닫힐 때 페이지가 최상단으로 튀지 않습니다.

## API 레퍼런스

### 옵션

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `onLock` | `() => void` | `undefined` | 스크롤이 잠길 때 호출 |
| `onUnlock` | `() => void` | `undefined` | 스크롤이 해제될 때 호출 |
| `allowScrollWithin` | `string \| HTMLElement` | `undefined` | 잠금 중에도 터치 스크롤을 허용할 영역 (CSS 선택자 또는 엘리먼트) — 모달/바텀시트 내부 스크롤 영역을 살리는 용도 |

### 인스턴스 메서드

| 메서드 | 반환값 | 설명 |
|--------|--------|------|
| `lock()` | `void` | body 스크롤 잠금. 이미 잠긴 경우 no-op |
| `unlock()` | `void` | body 스크롤 해제 및 스크롤 위치 복원. 잠기지 않은 경우 no-op |
| `isLocked` | `boolean` | 현재 잠금 상태 (getter) |
| `destroy()` | `void` | 잠긴 경우 해제 후 정리 |

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

- `allowScrollWithin`을 지정하지 않으면 잠금 중 모든 `touchmove`가 차단됩니다 — 터치 기기에서는 모달 내부의 스크롤 영역도 함께 멈춥니다. 모달의 스크롤 컨테이너를 지정해 예외 처리하세요.
- iOS에서는 허용 영역 내부 스크롤러가 끝에 도달하면 페이지가 러버밴딩될 수 있습니다(오버스크롤 체이닝). 허용 엘리먼트에 `overscroll-behavior: contain`을 적용해 완화하세요.
- `document.body` 스타일을 직접 수정합니다. 잠금 중에 body 스타일을 조작하는 다른 라이브러리와 충돌할 수 있습니다.
- `createScrollLock` 인스턴스를 여러 개 동시에 사용하면 서로 충돌합니다. 단일 인스턴스를 공유하거나, 애플리케이션 레벨에서 잠금 카운트 패턴을 사용하세요.
- SSR 환경에서는 모든 메서드가 no-op입니다.
