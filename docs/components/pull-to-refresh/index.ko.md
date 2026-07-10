# PullToRefresh

## 문제 배경

WebView와 iOS Safari는 viewport에 native PTR + elastic bounce를 기본 탑재하며, 둘 다 커스터마이즈할 수 없습니다. CSS만으로는 스크롤 영역 안에 *네이티브 느낌의* PTR을 만들 수 없습니다 — "스크롤이 맨 위일 때만" 제스처를 활성화하거나, 저항을 적용하거나, 비동기 새로고침을 중간에 끼워 넣는 게 불가능합니다.

`PullToRefresh`는 제스처 상태 머신(`idle → pulling → armed → refreshing → resetting → idle`), 저항 수식, `overscroll-behavior` 처리까지 책임지는 **헤드리스** 프리미티브입니다. 인디케이터는 노출되는 `state` / `distance` / `progress` 값을 사용해 사용자가 직접 렌더링합니다.

## 설치

```sh
pnpm add @guksu/wvkit-core
# 프레임워크에 따라 @guksu/wvkit-react 또는 @guksu/wvkit-vue 추가
```

추가 peer dependency 없음 — `PullToRefresh`는 `@guksu/wvkit-core`에 런타임 의존성 0개로 포함됩니다.

## 기본 사용법

::: code-group

```js [Vanilla JS]
import { createPullToRefresh } from '@guksu/wvkit-core';

const list = document.getElementById('list');
const ptr = createPullToRefresh(list, {
  onRefresh: async () => {
    await fetch('/api/items').then((r) => r.json()).then(setItems);
  },
  threshold: 60,
  onStateChange: (state) => updateIndicator(state),
  onPull: (distance, progress) => positionIndicator(distance, progress),
});

ptr.trigger();   // 외부에서 강제 새로고침
ptr.destroy();
```

```tsx [React]
import { usePullToRefresh } from '@guksu/wvkit-react';

function FeedList() {
  const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
    onRefresh: async () => {
      await new Promise((r) => setTimeout(r, 1500));
      // 로컬 state에 fresh 아이템 prepend
    },
  });

  const indicatorText =
    state === 'armed' ? '↑ 놓으면 새로고침' :
    state === 'refreshing' ? '⟳ 새로고침 중…' :
    state === 'pulling' ? `↓ 당기는 중 (${Math.round(progress * 100)}%)` :
    '';

  return (
    <div style={{ position: 'relative', height: 400, overflow: 'hidden' }}>
      {/* 인디케이터는 사용자가 직접 렌더 — 헤드리스 */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 60,
          transform: `translateY(${distance - 60}px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {indicatorText}
      </div>
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', touchAction: 'pan-y' }}
      >
        {/* 리스트 콘텐츠 */}
      </div>
    </div>
  );
}
```

```vue [Vue]
<script setup>
import { usePullToRefresh } from '@guksu/wvkit-vue';

const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
  onRefresh: async () => {
    await fetch('/api/items').then((r) => r.json());
  },
});
</script>
<template>
  <div style="position: relative; height: 400px; overflow: hidden">
    <div
      :style="{
        position: 'absolute', top: 0, left: 0, right: 0, height: '60px',
        transform: `translateY(${distance - 60}px)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }"
    >
      {{ state === 'armed' ? '↑ 놓으면 새로고침'
       : state === 'refreshing' ? '⟳ 새로고침 중…'
       : state === 'pulling' ? `↓ 당기는 중 (${Math.round(progress * 100)}%)`
       : '' }}
    </div>
    <div
      ref="containerRef"
      style="position: absolute; inset: 0; overflow-y: auto; touch-action: pan-y"
    >
      <!-- 리스트 콘텐츠 -->
    </div>
  </div>
</template>
```

:::

::: tip
스크롤 컨테이너에 `touch-action: pan-y`를 적용하고, 핀치 줌을 완전히 차단하고 싶으면 페이지 viewport meta에 `user-scalable=no`를 함께 두세요. `PullToRefresh`는 세로 당김만 처리합니다 — 가로 스크롤/팬은 건드리지 않습니다.
:::

## API 레퍼런스

### 상태

```ts
type PullToRefreshState = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'resetting';
```

전이도:

```
idle      → (touchstart at scrollTop=0, enabled)  → pulling
pulling   → (distance ≥ threshold)                → armed
armed     → (distance < threshold during move)    → pulling
pulling   → (release, distance < threshold)       → resetting → idle
armed     → (release)                              → refreshing
refreshing→ (onRefresh resolved/returned)         → resetting → idle
refreshing→ (onRefresh rejected/threw)            → console.error + resetting → idle
```

### 옵션

| Prop                       | 타입                                       | 기본값  | 설명                                                                                                |
| -------------------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------- |
| `onRefresh`                | `() => Promise<void> \| void`              | _(필수)_ | 새로고침 콜백. Promise면 resolve까지 `refreshing` 유지, void면 즉시 reset.                          |
| `threshold`                | `number`                                   | `60`    | (저항 적용 후) 새로고침을 arm하는 거리(px).                                                          |
| `maxDistance`              | `number`                                   | `120`   | 당김 거리의 hard cap. `threshold` 이상이어야 함.                                                     |
| `resistance`               | `number ∈ [0, 1]`                          | `0.5`   | 감쇠 계수. `0`은 저항 없음, `1`은 강한 감쇠.                                                         |
| `enabled`                  | `boolean`                                  | `true`  | 마스터 토글. `false`이면 새 pull 차단, 진행 중 제스처는 완주.                                        |
| `disableOverscrollContain` | `boolean`                                  | `false` | root에 자동 적용되는 `overscroll-behavior: contain` opt-out.                                         |
| `onStateChange`            | `(state: PullToRefreshState) => void`      | —       | 상태 전이 시 호출 (직전 값과 dedupe).                                                                |
| `onPull`                   | `(distance: number, progress: number) => void` | —   | 당김/reset 중 거리 업데이트마다 호출. `progress = distance / threshold`.                              |

잘못된 옵션 (`threshold ≤ 0`, `maxDistance < threshold`, `resistance ∉ [0,1]`) 은 생성 시점에 `WebviewHeadlessError`를 throw합니다.

### 인스턴스 메서드

| 메서드                   | 반환                  | 설명                                                                                       |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------ |
| `destroy()`              | `void`                | pointer/touch 리스너 일괄 해제, 진행 중 트윈 취소, `overscroll-behavior` 복원. 멱등성 보장. |
| `getState()`             | `PullToRefreshState`  | 현재 상태 머신 값.                                                                          |
| `trigger()`              | `Promise<void>`       | 외부에서 강제 새로고침. 진행 중인 refresh가 있으면 동일 Promise 반환.                       |
| `setEnabled(enabled)`    | `void`                | `enabled` 토글. 진행 중 제스처는 그대로 완주.                                                |

### 프레임워크 어댑터 반환값

| 필드           | 타입 (React)                          | 타입 (Vue)                            |
| -------------- | ------------------------------------- | ------------------------------------- |
| `containerRef` | `RefObject<HTMLDivElement>`           | `Ref<HTMLElement \| null>`            |
| `state`        | `PullToRefreshState`                  | `Ref<PullToRefreshState>`             |
| `distance`     | `number`                              | `Ref<number>`                         |
| `progress`     | `number`                              | `Ref<number>`                         |
| `trigger`      | `() => Promise<void>` (stable)        | `() => Promise<void>`                 |
| `setEnabled`   | `(enabled: boolean) => void` (stable) | `(enabled: boolean) => void`          |

## 브라우저 지원

| 환경                   | 지원   |
| ---------------------- | ------ |
| iOS Safari 15+         | ✅     |
| WKWebView (iOS)        | ✅     |
| Android Chrome 90+     | ✅     |
| Android WebView        | ✅     |
| Samsung Internet 14+   | ✅     |
| Desktop Chrome/Firefox | ✅     |

## 알려진 제한사항

- **부착 대상은 단일 `HTMLElement` (D1)**. `window` / `body` 레벨 PTR은 1급 API로 지원하지 않습니다. 필요하면 root에 `document.body`를 전달할 수 있지만 Safari의 viewport PTR과 경쟁할 수 있어 동작 보장은 안 됩니다.
- **`overscroll-behavior: contain` 자동 적용 (D3)**. 제스처가 부모 스크롤로 체이닝되는 것을 막습니다. iOS의 *elastic bounce*는 의도적으로 **차단하지 않습니다** — 직접 정책을 관리하려면 `disableOverscrollContain: true`로 opt-out.
- **ScrollContainer와 통합 없음 (D5)**. 두 컴포넌트는 독립적입니다. ScrollContainer 패널 *내부*의 `overflow-y: auto` div에 부착할 순 있지만, ScrollContainer의 카메라 pan과는 합성되지 않습니다.
- **`onRefresh` 에러는 swallow됨 (D6)**. Promise 거부 / 동기 throw는 `console.error`로 로깅되고 state는 `idle`로 복귀. 별도 `'error'` state는 없으므로 사용자가 직접 에러 UI를 관리해야 합니다.
- **세로 당김만 지원**. 가로 스와이프는 무시. 대각선 당김은 Y 성분 기준 세로로 처리.
- **`PointerEvent`와 `TouchEvent` 양쪽 모두 wire됨**. `activeSource` 플래그로 iOS 브라우저(touch에서 pointer 합성)가 같은 제스처를 이중 처리하지 않도록 가드. `PointerEvent`가 없는 매우 오래된 WebView는 `TouchEvent` 경로로 동작.
