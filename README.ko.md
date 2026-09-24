# wvkit

[English](README.md)

[![npm version](https://img.shields.io/npm/v/@guksu/wvkit-core?label=%40guksu%2Fwvkit-core)](https://www.npmjs.com/package/@guksu/wvkit-core)
[![npm version](https://img.shields.io/npm/v/@guksu/wvkit-react?label=%40guksu%2Fwvkit-react)](https://www.npmjs.com/package/@guksu/wvkit-react)
[![npm version](https://img.shields.io/npm/v/@guksu/wvkit-vue?label=%40guksu%2Fwvkit-vue)](https://www.npmjs.com/package/@guksu/wvkit-vue)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org/)
[![bundle size](https://deno.bundlejs.com/badge?q=@guksu/wvkit-core&treeshake=[*])](https://bundlejs.com/?q=@guksu/wvkit-core&treeshake=[*])
[![데모](https://img.shields.io/badge/데모-라이브-4f46e5)](https://guksu.github.io/wvkit/)

> WebView에 최적화된 헤드리스 UI 프리미티브 — 일반 UI 라이브러리가 무시하는 레이아웃·스크롤·인풋 문제를 해결합니다.

<table>
  <tr>
    <td align="center"><b>ScrollContainer</b><br/>축 제약 pan · 스냅 · 핀치 줌</td>
    <td align="center"><b>PullToRefresh</b><br/>헤드리스 상태 머신 · 저항</td>
    <td align="center"><b>StableInput</b><br/>듀얼 인풋 · IME 안전 · 레이아웃 튐 없음</td>
  </tr>
  <tr>
    <td><img src=".github/assets/scroll-container.gif" alt="ScrollContainer 데모 — 스와이프 스냅 패널 전환과 핀치 줌" width="260"/></td>
    <td><img src=".github/assets/pull-to-refresh.gif" alt="PullToRefresh 데모 — 저항 당김, 임계값 armed, 새로고침 후 복귀" width="260"/></td>
    <td><img src=".github/assets/stable-input.gif" alt="StableInput 데모 — 한글 입력이 디스플레이 인풋에 미러링되고 제출됨" width="260"/></td>
  </tr>
</table>

<sub>[라이브 데모](https://guksu.github.io/wvkit/)를 실제 터치 제스처 시퀀스로 구동하며 캡처 (브라우저 에뮬레이션).</sub>

---

## 라이브 데모

- **React 데모** — <https://guksu.github.io/wvkit/>
- **Vue 데모** — <https://guksu.github.io/wvkit/vue/>

### 온라인에서 바로 실행 (제로 설치)

npm 배포 패키지를 사용하는 최소 샌드박스 — `PullToRefresh` + `StableInput`:

| 프레임워크 | StackBlitz | CodeSandbox |
|-----------|------------|-------------|
| React | [StackBlitz에서 열기](https://stackblitz.com/github/Guksu/wvkit/tree/main/examples/sandboxes/react) | [CodeSandbox에서 열기](https://codesandbox.io/p/sandbox/github/Guksu/wvkit/tree/main/examples/sandboxes/react) |
| Vue | [StackBlitz에서 열기](https://stackblitz.com/github/Guksu/wvkit/tree/main/examples/sandboxes/vue) | [CodeSandbox에서 열기](https://codesandbox.io/p/sandbox/github/Guksu/wvkit/tree/main/examples/sandboxes/vue) |

---

## 왜 wvkit인가?

네이티브 셸 안에서 동작하는 WebView 앱은 브라우저 우선 라이브러리가 절대 다루지 않는 UI 버그를 만납니다.

- **iOS 키보드가 전체 레이아웃을 튀어 올림** — 포커스 시 `visualViewport` 리사이즈와 스크롤이 동시에 발생
- **독립 세로 스크롤을 가진 가로 페이저** — `overflow-x/y` CSS만으로는 축 고정·스냅·핀치 줌 합성이 불가능
- **당김 새로고침이 네이티브 탄성 바운스와 충돌** — WebView의 기본 오버스크롤 동작은 CSS로 커스터마이즈 불가
- **Safe Area 인셋이 회전 시 변경** — `env(safe-area-inset-*)` 값이 JavaScript에 반응형으로 노출되지 않음
- **소프트 키보드 열림/닫힘에 신뢰할 수 있는 크로스플랫폼 이벤트가 없음** — iOS와 Android 각각 다른 휴리스틱 필요

wvkit은 이 모든 문제를 처리합니다. 각 컴포넌트는 **동작(behavior)만** 노출하고 기본 스타일은 일절 포함하지 않아, 여러분의 팀이 자체 디자인 시스템을 자유롭게 얹을 수 있습니다.

---

## 기능

| 컴포넌트 | 패키지 | 설명 |
|----------|--------|------|
| `ScrollContainer` | core / react / vue | 핀치 줌을 지원하는 가로/세로 뷰포트 페이저. 카메라 모델을 CSS transform 하나로 렌더링해(의존성 없음) 축 고정 pan, 스냅, 엣지 저항, 패널 가상화를 제공합니다. |
| `StableInput` | core / react / vue | iOS 키보드 레이아웃 이동 방지 인풋. 듀얼 인풋 구조(디스플레이 + 숨김 fixed)에 `visualViewport` 리스너를 조합해 레이아웃 점프를 억제합니다. |
| `PullToRefresh` | core / react / vue | 헤드리스 당김 새로고침 상태 머신 (`idle → pulling → armed → refreshing → resetting`). 저항 곡선·비동기 새로고침·`overscroll-behavior: contain`으로 네이티브 PTR 차단을 내장합니다. |
| `useVirtualKeyboard` | core / react / vue | `visualViewport` 리사이즈 델타로 소프트 키보드 열림/닫힘 상태를 추론합니다. iOS·Android 휴리스틱 내장. |
| `useSafeArea` | core / react / vue | `env(safe-area-inset-*)` CSS 값을 JavaScript로 읽어 반응형으로 제공합니다. 기기 방향 변경 시 자동 갱신. |
| `useScrollLock` | core / react / vue | 레이아웃 이동 없이 `<body>` 스크롤을 막습니다 (`overflow: hidden` + 스크롤 위치 보존). |

---

## 문서

컴포넌트별 심화 문서 — 문제 배경, 아키텍처, 전체 API 레퍼런스, 알려진 제한사항:

| 컴포넌트 | 문서 |
|----------|------|
| `ScrollContainer` | [docs/components/scroll-container/index.md](docs/components/scroll-container/index.md) |
| `StableInput` | [docs/components/stable-input/index.md](docs/components/stable-input/index.md) |
| `PullToRefresh` | [docs/components/pull-to-refresh/index.md](docs/components/pull-to-refresh/index.md) |
| `useVirtualKeyboard` | [docs/components/virtual-keyboard/index.md](docs/components/virtual-keyboard/index.md) |
| `useSafeArea` | [docs/components/safe-area/index.md](docs/components/safe-area/index.md) |
| `useScrollLock` | [docs/components/scroll-lock/index.md](docs/components/scroll-lock/index.md) |

---

## 설치

### Core (Vanilla JS / 프레임워크 무관)

```bash
npm install @guksu/wvkit-core
```

### React

```bash
npm install @guksu/wvkit-react @guksu/wvkit-core
```

peer dependency: `react`, `react-dom` 18 이상.

### Vue 3

```bash
npm install @guksu/wvkit-vue @guksu/wvkit-core
```

---

## 빠른 시작

### PullToRefresh

**Core**
```ts
import { createPullToRefresh } from '@guksu/wvkit-core';

const ptr = createPullToRefresh(containerEl, {
  onRefresh: async () => {
    await fetchData();
  },
  threshold: 60,
  resistance: 0.5,
  onStateChange: (state) => console.log(state),
  onPull: (distance, progress) => {
    indicator.style.transform = `translateY(${distance}px)`;
    indicator.style.opacity = String(progress);
  },
});

// 정리
ptr.destroy();
```

**React**
```tsx
import { usePullToRefresh } from '@guksu/wvkit-react';

function Feed() {
  const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
    onRefresh: async () => { await fetchFeed(); },
  });

  return (
    <div ref={containerRef} style={{ height: '100vh', overflowY: 'auto' }}>
      {/* 인디케이터는 직접 렌더링 — progress: 0 → 1 → 초과 */}
      <div style={{ opacity: progress, transform: `translateY(${distance}px)` }}>
        {state === 'refreshing' ? '새로고침 중...' : '당겨서 새로고침'}
      </div>
      <YourContent />
    </div>
  );
}
```

**Vue**
```vue
<script setup lang="ts">
import { usePullToRefresh } from '@guksu/wvkit-vue';

const { containerRef, state, distance, progress } = usePullToRefresh({
  onRefresh: async () => { await fetchFeed(); },
});
</script>

<template>
  <div ref="containerRef">
    <div :style="{ opacity: progress, transform: `translateY(${distance}px)` }">
      {{ state === 'refreshing' ? '새로고침 중...' : '당겨서 새로고침' }}
    </div>
    <YourContent />
  </div>
</template>
```

---

### StableInput

**Core**
```ts
import { createStableInput } from '@guksu/wvkit-core';

const input = createStableInput(containerEl, {
  placeholder: '검색어 입력…',
  onFocus: () => header.classList.add('hidden'),
  onBlur: () => header.classList.remove('hidden'),
  onChange: (value) => search(value),
  onSubmit: (value) => navigate(value),
});

input.focus();
input.setValue('안녕하세요');
input.destroy();
```

**React**
```tsx
import { useStableInput, StableInputDisplay } from '@guksu/wvkit-react';

function SearchBar() {
  const inputProps = useStableInput({
    onChange: (value) => search(value),
    onSubmit: (value) => navigate(value),
  });

  return <StableInputDisplay {...inputProps} className="my-search-input" />;
}
```

**Vue**
```vue
<script setup lang="ts">
import { useStableInput } from '@guksu/wvkit-vue';

const { containerRef, value, isFocused, focus, blur, setValue } = useStableInput({
  onChange: (v) => search(v),
});
</script>
```

---

### ScrollContainer

```ts
import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';

const sc = createScrollContainer(rootEl, {
  direction: 'horizontal',
  panels: panelElements,
  initialIndex: 0,
  enablePinchZoom: true,
  minZoom: 1.0,
  maxZoom: 3.0,
  onIndexChange: (index) => setTab(index),
  onZoomChange: (zoom) => setZoomLabel(zoom),
});

sc.scrollTo(2, { animated: true });
sc.zoomTo(1.5, { animated: true });
sc.destroy();
```

> 호스트 컨테이너: `touch-action: none`. 자체 세로 스크롤을 가진 패널: `overflow-y: auto; touch-action: pan-y` — `pan-y`가 없으면 브라우저가 가로 스와이프를 가져가 페이저가 넘어가지 않습니다. 자세한 내용은 [docs/components/scroll-container/index.md](docs/components/scroll-container/index.md#scrollable-panels-feeds-lists-long-content)를 보세요.

**React / Vue 컴포넌트** — `HTMLElement[]` 를 만드는 대신 패널을 자식으로 씁니다:

```tsx
import { ScrollContainer, ScrollPanel } from '@guksu/wvkit-react/scroll-container';

<ScrollContainer ref={sc} direction="horizontal" onIndexChange={setTab} style={{ height: 560 }}>
  {tabs.map((tab) => (
    <ScrollPanel key={tab.id} style={{ overflowY: 'auto', touchAction: 'pan-y' }}>
      <Feed tab={tab} />
    </ScrollPanel>
  ))}
</ScrollContainer>;

sc.current?.scrollTo(2); // ref 핸들: scrollTo · zoomTo · getActiveIndex · getZoom
```

Vue 는 `@guksu/wvkit-vue/scroll-container` 에서 같은 컴포넌트를 내보냅니다(`@index-change` 로 듣기). 패널 내용은 서버 HTML 이 아니라 브라우저에서 마운트된 뒤 그립니다. 자세한 내용은 [docs/components/scroll-container/index.md](docs/components/scroll-container/index.md) 의 "Components" 절을 보세요.

---

### 유틸리티 훅

```ts
// 소프트 키보드 상태
import { createVirtualKeyboard } from '@guksu/wvkit-core';
const kb = createVirtualKeyboard(el, {
  onKeyboardChange: ({ isOpen, keyboardHeight }) => {
    bottomBar.style.transform = isOpen ? `translateY(-${keyboardHeight}px)` : '';
  },
});

// Safe Area 인셋
import { createSafeArea } from '@guksu/wvkit-core';
const sa = createSafeArea(el, {
  onChange: ({ top, bottom }) => {
    header.style.paddingTop = `${top}px`;
    footer.style.paddingBottom = `${bottom}px`;
  },
});

// 스크롤 잠금
import { createScrollLock } from '@guksu/wvkit-core';
const lock = createScrollLock(el, {});
lock.lock();
lock.unlock();
```

---

## API 레퍼런스

> **반응성 주의 (React/Vue 어댑터):** 콜백이 아닌 옵션(`panels`, `direction`, `minZoom` 등)은 마운트 시점에 1회 고정되며, 이후 렌더에서 변경해도 조용히 무시됩니다. 콜백(`onIndexChange`, `onRefresh` 등)은 항상 최신으로 유지됩니다. 새 non-callback 옵션을 적용하려면 재마운트를 강제하세요 — React는 호스트 컴포넌트에 새 `key`를 전달, Vue는 `:key` / `v-if`를 사용합니다. 예외는 `useScrollContainer` 와 `ScrollContainer` 컴포넌트입니다. 바뀐 옵션을 다시 마운트하지 않고 반영합니다(`setOptions`·`setPanels`. Vue 컴포저블은 `reactive` 객체·`ref`·getter 를 넘깁니다).

### PullToRefresh

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `onRefresh` | `() => Promise<void> \| void` | — | 새로고침 콜백. Promise 반환 시 resolve까지 `refreshing` 유지. |
| `threshold` | `number` | `60` | 새로고침 트리거 당김 거리(px). |
| `maxDistance` | `number` | `120` | 최대 당김 거리(px). |
| `resistance` | `number` | `0.5` | 저항 계수 (0–1). |
| `enabled` | `boolean` | `true` | 활성화 여부. |
| `disableOverscrollContain` | `boolean` | `false` | `overscroll-behavior: contain` 자동 적용 opt-out. |
| `onStateChange` | `(state) => void` | — | 상태 전이 콜백. |
| `onPull` | `(distance, progress) => void` | — | 당김 거리 업데이트 콜백. |

### StableInput

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `type` | `string` | `'text'` | 인풋 타입. |
| `placeholder` | `string` | — | 플레이스홀더 텍스트. |
| `suppressLayoutShift` | `boolean` | `true` | `visualViewport` 리스너 활성화 여부. |
| `scrollAnchor` | `'top' \| 'bottom' \| 'none'` | `'bottom'` | 키보드 등장 시 스크롤 앵커. |
| `onChange` | `(value: string) => void` | — | 값 변경 콜백. |
| `onSubmit` | `(value: string) => void` | — | 제출 콜백 (Enter 키). |

### ScrollContainer

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `direction` | `'horizontal' \| 'vertical' \| 'both'` | — (필수) | 카메라 pan 축 제약. `'both'` 는 사용 중단 — `'horizontal'` 과 같고 1.0 에서 제거. |
| `panels` | `HTMLElement[]` | — (필수) | 표시할 패널 엘리먼트 배열. |
| `initialIndex` | `number` | `0` | 초기 활성 패널 인덱스. |
| `enablePinchZoom` | `boolean` | `true` | 핀치 줌 활성화. |
| `minZoom` | `number` | `1.0` | 최소 줌 레벨. |
| `maxZoom` | `number` | `3.0` | 최대 줌 레벨. |
| `doubleTapZoom` | `number \| false` | `false` | 더블탭으로 `minZoom`과 이 레벨을 오갑니다. |
| `dragThreshold` | `number` | `10` | 드래그가 시작되기 전 여유(px). 이때 방향(45° 기준)을 정합니다. `0`이면 첫 move부터 따라갑니다. |
| `noDragSelector` | `string` | — | 제스처를 스스로 처리하는 패널 안 요소의 CSS 선택자. JS 캐러셀(`'.swiper'`) 등. |
| `panelWidth` | `number \| (index) => number` | root 폭 | 가로 패널 폭. `(0, 1]` 은 호스트 폭 비율, 1 초과는 px. 1보다 작게 주면 양옆 패널이 보입니다(피킹). |
| `gap` | `number` | `0` | 패널 사이 간격(px). |
| `align` | `'center' \| 'start'` | `'center'` | 활성 패널이 멈추는 자리. 가운데, 또는 시작 가장자리를 호스트 시작 가장자리에 붙임. |
| `wheel` | `boolean` | `true` | 휠·트랙패드: 제스처당 한 패널, 줌 상태에서는 pan, `Ctrl` + 휠 줌. |
| `keyboard` | `boolean` | `true` | 호스트에 포커스가 있을 때 화살표·`Home`/`End`·`Escape`. |
| `a11y` | `boolean` | `true` | 캐러셀 ARIA 역할. 비활성 패널에 `aria-hidden`과 `inert`. |
| `overscan` | `number` | `1` | 화면에 보이는 패널 양쪽으로 더 붙여 둘 패널 수. |
| `snapThreshold` | `number` | `0.3` | 천천히 놓을 때 넘기기 위한 드래그 비율. 짧고 빠른 플릭(25px 초과, 0.4px/ms 초과)은 상관없이 넘깁니다. |
| `resistance` | `number` | `0.2` | 엣지 고무줄 저항값. |
| `onIndexChange` | `(index: number) => void` | — | 활성 패널 변경 콜백. |
| `onZoomChange` | `(zoom: number) => void` | — | 줌 레벨 변경 콜백. |

---

## 브라우저 / WebView 지원

| 환경 | ScrollContainer | StableInput | PullToRefresh | VirtualKeyboard | SafeArea |
|------|:-:|:-:|:-:|:-:|:-:|
| iOS Safari 16+ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WKWebView (iOS 16+) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Android Chrome 90+ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Android WebView | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Samsung Internet | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Desktop Chrome / Firefox | ✅ | ✅ | ✅ | — | — |

> ⚠️ 부분 지원 또는 수동 테스트 필요. SafeArea는 호스트 네이티브 앱이 `viewport-fit=cover`를 설정해야 동작합니다.
>
> 이 표는 단위 테스트(happy-dom)와 Playwright 에뮬레이션(Chromium·WebKit 기기 프로필) 기준입니다. WKWebView / Android WebView 실기기 결과는 아직 기록되지 않았습니다. 출시 전에 [`debug/rn-webview-harness`](debug/rn-webview-harness/README.md)로 대상 기기에서 확인하세요.

---

## 단점과 주의점

모든 컴포넌트는 헤드리스이고 작지만, 실무에서 부딪히기 쉬운 날카로운 모서리가 각각 있습니다. 아래는 요약이고, 컴포넌트 문서마다 **알려진 제한사항** 절이 따로 있습니다.

### ScrollContainer

- 약 8.7 KB gzip에 의존성은 없지만, CSS `scroll-snap`보다는 여전히 무겁습니다. 스냅 조절이나 줌 없이 가로 페이징만 필요하면 `scroll-snap`으로 충분합니다.
- core 와 훅은 미리 만든 `HTMLElement[]` 를 `panels` 로 받습니다. React/Vue 컴포넌트는 대신 자식을 받고, 패널 내용은 서버 HTML 이 아니라 브라우저에서만 그립니다. `setPanels`·`setOptions` 로 패널과 다른 옵션을 다시 마운트하지 않고 바꿀 수 있고, 남는 패널의 스크롤 위치도 유지됩니다. 다만 바꾸는 순간 진행 중인 제스처는 멈춥니다.
- 스크롤되는 패널에는 `touch-action: pan-y`가 필수입니다. `direction: 'vertical'` 은 세로로 스크롤되는 패널을 지원하지 않습니다. 터치 기기에서는 패널 스크롤이 끝나도 다음 패널로 넘어가지 못합니다. `direction: 'both'` 는 사용 중단입니다. horizontal 과 같게 동작하고 1.0 에서 제거합니다.
- 줌 상태의 교차 축 pan은 그 축으로 스크롤하지 않는 패널에서만 됩니다(`pan-y` 패널은 세로 터치를 자기가 가져감). 더블탭 줌은 기본 꺼짐이고, 켜도 손가락 아래 요소의 클릭은 두 번 그대로 일어납니다. 플릭과 휠 제스처는 최대 한 패널만 넘기고, 키보드 단축키는 호스트에 포커스가 있을 때만 동작합니다. 드래그의 처음 10px은 페이저를 움직이지 않고, 세로로 시작한 제스처는 페이지를 넘기지 않습니다.
- 패널을 호스트보다 좁게 주면(`panelWidth`), `a11y` 가 켜진 동안 옆에 보이는 패널은 누를 수 없고(`inert`) 첫 패널과 마지막 패널 옆에 빈 공간이 생깁니다.
- 패널 안 JS 캐러셀(Swiper, Embla)은 `noDragSelector` 가 필요합니다. 없으면 한 번 밀 때 캐러셀과 페이저가 함께 움직입니다. 캐러셀 위에서 시작한 스와이프는 마지막 장에서도 패널을 넘기지 않습니다.
- 패널 안의 `position: fixed`는 패널과 함께 스크롤됩니다. 패널 안 텍스트는 선택할 수 없습니다. 데스크톱에서는 `<img>`에 `draggable="false"`가 필요합니다.
- 스크롤되는 패널은 보이는 것마다 자기 컴포지터 레이어를 가지고, 패널 DOM은 절대 언마운트되지 않습니다. `overscan`을 작게 두고 긴 리스트는 패널 안에서 직접 가상화하세요. 숨겨진 패널의 스크롤 위치는 Chromium에서는 유지되지만 WebKit은 미검증입니다.

### StableInput

- 보이는 인풋은 읽기 전용입니다. 커서도, 텍스트 선택도, 복사·붙여넣기 메뉴도 없습니다. 검색창·채팅 입력줄에는 맞지만 긴 글 편집에는 맞지 않습니다.
- 폼 필드가 아닙니다. 숨김 인풋은 `name` 없이 `<body>`에 있어 `<form>` submit과 `FormData`가 무시합니다. `type`, `placeholder`, `inputMode`, `autocomplete`만 전달됩니다.
- 데스크톱 Tab 순서에서 건너뛰어지고, 패스워드 매니저가 인식하지 못할 수 있으며, IME 표시가 한 조합 단계 늦을 수 있습니다.
- `scrollAnchor`는 window만 스크롤하고, `visualViewport`가 있는 곳에서만 동작합니다.

### PullToRefresh

- 축 고정도 시작 여유도 없습니다. `scrollTop === 0`이면 모든 터치가 `pulling`이 되고 아래 방향 `touchmove`가 취소되므로, root 안의 가로 캐러셀이 멈추고 그냥 탭해도 `pulling → resetting → idle`을 한 바퀴 돕니다. 인디케이터는 `distance` / `progress`로 그리세요.
- root의 `scrollTop`만 검사하고 중첩 스크롤러는 무시합니다. 데스크톱 마우스 드래그도 당깁니다.
- `onRefresh` 에러는 삼켜집니다(`console.error` 후 `idle` 복귀). `setEnabled(false)`는 진행 중인 제스처를 취소하지 않습니다. iOS 탄성 바운스는 막지 않습니다.

### useVirtualKeyboard

- 순수 뷰포트 휴리스틱입니다. `visualViewport`가 `threshold`보다 많이 줄어들면 무엇이든 키보드로 치고, `keyboardHeight`는 추정값입니다. Android `adjustPan`과 `interactive-widget=overlays-content`에서는 감지가 불가능합니다.
- 첫 뷰포트 이벤트 전에는 아무것도 보고하지 않습니다.

### useSafeArea

- `viewport-fit=cover`가 필요하고, Android에서는 호스트 앱이 edge-to-edge로 그려야 합니다. 아니면 값이 전부 `0`입니다.
- `resize` / `orientationchange`에서만 갱신됩니다. 회전 직후 한 프레임 동안 값이 오래된 것일 수 있고, SSR에서는 `0`입니다.

### useScrollLock

- `allowScrollWithin` 밖의 모든 `touchmove`를 취소합니다(핀치 줌과 터치 위젯 포함). iOS에서 내부 스크롤러는 `overscroll-behavior: contain`을 주지 않으면 가장자리에서 페이지로 스크롤이 이어집니다.
- "레이아웃 이동 없음"은 오버레이 스크롤바 기준입니다. 일반 데스크톱 스크롤바에서는 `scrollbar-gutter: stable`을 추가하세요.
- 한 번에 인스턴스 하나만 쓰세요. `destroy()`는 잠금을 풉니다. body 인라인 스타일은 `unlock()`에서 덮어써집니다.

---

## 설계 원칙

- **헤드리스** — 동작만, 기본 스타일 없음
- **SSR 안전** — 모듈 로드 시점에 `window`/`document` 접근 없음
- **런타임 의존성 0** — ScrollContainer를 포함한 모든 컴포넌트가 서드파티 런타임 코드 없이 배포됩니다
- **프레임워크 무관 코어** — React·Vue 어댑터는 동일한 코어 로직을 감싸는 얇은 래퍼
- **destroy 패턴** — 모든 팩토리 함수는 `destroy()` 메서드를 반환하며, 호출 시 모든 이벤트 리스너와 DOM 참조를 정리

---

## 개발

```bash
# 의존성 설치
pnpm install

# 전체 패키지 빌드
pnpm build

# 워치 모드
pnpm dev

# 전체 테스트 실행
pnpm test

# 타입 체크
pnpm typecheck

# 린트 + 포맷
pnpm lint
pnpm format

# 릴리즈 전 changeset 추가
pnpm changeset

# 버전 업 + 배포
pnpm changeset version
pnpm changeset publish
```

전체 기여 가이드(셋업, 테스트, changeset 흐름)는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

---

## 라이선스

MIT © [Guksu](https://github.com/Guksu)
