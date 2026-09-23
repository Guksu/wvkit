---
'@guksu/wvkit-core': minor
---

ScrollContainer: three.js 의존성 제거 — `CSS3DRenderer` + `OrthographicCamera`를 자체 카메라 모델(`camera.ts`)과 CSS transform 렌더러(`panel-renderer.ts`)로 교체.

- `three` peer dependency 삭제. 설치 시 `three`를 더 이상 받지 않아도 된다 (남아 있어도 무해).
- 번들: `@guksu/wvkit-core/scroll-container` 단독 gzip 약 4 KB (이전에는 three 일부 포함 60 KB).
- 공개 API·제스처·스냅·줌·가상화 동작 동일. 렌더 결과는 같은 수식(`screenX = (worldX − cameraX)·zoom + width/2`)이며 교체 전후 화면을 픽셀 비교로 확인.
- 내부 DOM 구조가 `root > domElement > scene > panel` 2단계로 단순해졌다 (이전 3단계). 렌더러 내부 DOM에 의존하던 e2e 픽스처는 갱신됨. 렌더러 내부 구조는 공개 계약이 아니다.
- `@guksu/wvkit-core/scroll-container` subpath는 import 경로 호환을 위해 유지.
