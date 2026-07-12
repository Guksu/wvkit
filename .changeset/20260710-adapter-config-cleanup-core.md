---
"@guksu/wvkit-core": minor
---

StableInput: `validateOptions` 도입 — 잘못된 `container`(HTMLElement 아님)·`scrollAnchor`(`'top' | 'bottom' | 'none'` 외 값)는 이제 생성 시점에 `WebviewHeadlessError`를 던진다(기존에는 조용히 통과 — breaking-ish 동작 변경). `destroy()`가 `isFocused` 상태도 초기화한다. ScrollLock의 scrollY 저장/복원 의도(overflow:hidden 전략의 안전망)를 주석으로 명확화.
