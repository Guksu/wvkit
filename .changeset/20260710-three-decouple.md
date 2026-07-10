---
"@guksu/wvkit-core": minor
"@guksu/wvkit-react": minor
"@guksu/wvkit-vue": minor
---

**BREAKING**: ScrollContainer는 `<pkg>/scroll-container` subpath로 이동 — three 미설치 CJS/ESM 소비자의 배럴 크래시 해소.

- `createScrollContainer`는 `@guksu/wvkit-core/scroll-container`, `useScrollContainer`는 `@guksu/wvkit-react/scroll-container` · `@guksu/wvkit-vue/scroll-container`에서 import (배럴 `.`에는 타입만 잔존).
- 배럴(`.`)이 더 이상 three를 정적 로드하지 않으므로 optional peer 설계대로 three 없이 StableInput 등 non-three 컴포넌트 사용 가능.
- destroy 이후 `scrollTo`/`zoomTo`는 완전 no-op (상태 갱신·`onIndexChange`/`onZoomChange` 발화 누수 차단).
