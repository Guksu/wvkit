---
'@guksu/wvkit-core': minor
---

ScrollContainer: 새 옵션 `noDragSelector` — 패널 안 JS 캐러셀(Swiper·Embla 등)이 제스처를 가져가게 한다.

- 누른 요소가 이 CSS 선택자에 맞는 요소(호스트 안) 안에 있으면 그 제스처는 그 요소의 것이다. 페이저는 끌기·핀치·더블탭 줌을 하지 않고, 그 제스처에 더해지는 손가락도 무시한다. 다른 곳에서 시작한 제스처는 그대로.
- 그 요소 위의 휠(페이지 넘김·줌 상태 pan)은 손대지 않는다. `Ctrl` + 휠 줌은 그대로.
- 캐러셀 끝에서 더 밀어도 패널은 넘어가지 않는다.
- 끝 이벤트를 놓쳐도 새 primary 포인터가 오면 무시 목록을 비운다. 호스트 자신·조상이 선택자에 맞는 것은 세지 않는다. 잘못된 선택자는 생성 시 `WebviewHeadlessError`.
- 번들: brotli 6.83 kB → 7.02 kB. size-limit 한도 7 KB → 7.5 KB.
