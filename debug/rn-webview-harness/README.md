# wvkit RN WebView Debug Harness

wvkit 컴포넌트를 **실제 WebView 환경**(iOS WKWebView / Android WebView)에서 검증하기 위한
최소 구성의 Expo 앱입니다. 배포된 데모 사이트를 WebView로 감싸고, 실기기에서
DevTools 없이도 콘솔 에러와 visualViewport 변화를 확인할 수 있는 디버그 패널을 제공합니다.

## 왜 필요한가

Playwright의 모바일 에뮬레이션과 실기기 모바일 **브라우저**로는 검증할 수 없는 것들이 있습니다:

- **WKWebView ≠ iOS Safari** — 키보드 액세서리 바, 프로그래매틱 focus 정책, 바운스 동작이 다릅니다.
- **Android WebView ≠ Chrome** — `windowSoftInputMode`(adjustResize/adjustPan)는 호스트 앱이
  결정하며, 브라우저에서는 재현 자체가 불가능합니다. VirtualKeyboard 감지 가능 여부가 여기에 달려 있습니다.
- **SafeArea** — `env(safe-area-inset-*)`가 실제 값을 받으려면 호스트 앱이 WebView를
  노치 아래까지 풀블리드로 깔아야 합니다. 이 하네스가 그 조건을 만들어 줍니다.

즉 wvkit이 표방하는 "WebView 최적화"를 실제로 검증할 수 있는 유일한 수단입니다.

## 실행 방법

이 디렉터리는 pnpm 워크스페이스 **밖**에 있습니다 (루트 install/CI에 영향 없음).

```sh
cd debug/rn-webview-harness
npm install
npx expo install --fix   # Expo SDK와 의존성 버전 정합성 자동 맞춤
npx expo start
```

터미널에 뜨는 QR 코드를 실기기의 [Expo Go](https://expo.dev/go) 앱으로 스캔하면 바로 실행됩니다.
네이티브 빌드가 필요 없습니다.

- 상단 WebView: 기본으로 [배포된 데모](https://guksu.github.io/wvkit/)를 로드합니다.
  URL 바에 로컬 dev 서버 주소(`http://<내-IP>:5173/wvkit/`)를 입력해 개발 중인 코드도 확인할 수 있습니다.
- 하단 `☰` 버튼: 디버그 패널 토글 — 페이지의 `console.error/warn`과 visualViewport
  크기 변화가 실시간으로 표시됩니다. 에러가 발생하면 버튼이 빨간 배지로 바뀝니다.

## 컴포넌트별 검증 체크리스트

| 컴포넌트 | 확인할 것 |
|---|---|
| StableInput | 탭 시 키보드가 지연 없이 열리는지, 인풋 위에서 시작한 스크롤이 키보드를 열지 **않는지**, 한글 IME 조합/Enter 제출 |
| VirtualKeyboard | 키보드 열림/닫힘 시 `isOpen`/`keyboardHeight` readout, 키보드 열린 채 페이지 리로드 후에도 감지가 회복되는지 |
| ScrollLock | 잠금 중 배경 스크롤 차단 + 모달 내부 스크롤(`allowScrollWithin`)은 살아있는지, iOS 러버밴딩 |
| PullToRefresh | 네이티브 바운스와의 간섭 없이 당김 제스처가 동작하는지 |
| SafeArea | 노치 기기에서 4방향 inset이 0이 아닌 실제 값인지 (이 하네스는 풀블리드 + `viewport-fit=cover` 조건 충족) |
| ScrollContainer | 실제 손가락 스와이프/핀치 줌의 관성·스냅 품질 |

## Android 키보드 모드 (adjustResize / adjustPan)

`app.json`의 `android.softwareKeyboardLayoutMode`가 `"resize"`로 설정돼 있습니다.
VirtualKeyboard는 `adjustPan` 모드에서는 원리상 감지가 불가능하므로(뷰포트가 줄어들지 않음),
`"pan"`으로 바꿔 이 한계를 직접 재현해볼 수 있습니다.

> ⚠️ 이 설정은 앱 매니페스트 레벨이라 **Expo Go에서는 적용되지 않습니다**
> (Expo Go 호스트 앱의 설정을 따름). adjustPan 재현에는 development build가 필요합니다:
> `npx expo run:android`

## 검증 결과 기록

검증을 마치면 결과를 README의 기기 매트릭스로 남기는 것을 권장합니다. 예:

| 기기 / OS | WebView | StableInput | VirtualKeyboard | ScrollLock | PullToRefresh | SafeArea |
|---|---|---|---|---|---|---|
| iPhone 15 / iOS 17 | WKWebView | ✅ | ✅ | ✅ | ✅ | ✅ |
| Galaxy S23 / Android 14 | Chrome WebView (resize) | ✅ | ✅ | ✅ | ✅ | ✅ |
