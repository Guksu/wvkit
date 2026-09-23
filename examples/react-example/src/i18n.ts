export type Lang = 'en' | 'ko';

export const t = {
  en: {
    header: {
      sub: 'WebView UI Primitives',
      github: 'GitHub',
    },
    footer: {
      license: 'MIT License',
    },
    tabs: {
      'scroll-container': 'ScrollContainer',
      'pull-to-refresh': 'PullToRefresh',
      'stable-input': 'StableInput',
      'virtual-keyboard': 'VirtualKeyboard',
      'safe-area': 'SafeArea',
      'scroll-lock': 'ScrollLock',
    },
    safeArea: {
      title: 'useSafeArea',
      description:
        'Reads env(safe-area-inset-*) CSS values into JavaScript reactively. Exposes notch, Dynamic Island, and home indicator insets directly in JS.',
      note: 'On a real WebView device with a notch, values will be non-zero.',
      visualization: 'safe area visualization',
    },
    scrollLock: {
      title: 'useScrollLock',
      description:
        'Prevents body scroll without layout shift. Useful when a modal, drawer, or bottom sheet is open and you need to freeze the background.',
      locked: 'Scroll Locked',
      unlocked: 'Scroll Active',
      hint: "Try scrolling the page after locking — the body won't move.",
    },
    virtualKeyboard: {
      title: 'useVirtualKeyboard',
      description:
        'Infers soft keyboard open/close state from visualViewport resize delta. iOS and Android heuristics are built in.',
      note: 'Tap the input below to observe keyboard state changes.',
      detected: 'Keyboard detected',
      placeholder: 'Tap to open keyboard',
    },
    stableInput: {
      title: 'StableInput',
      description:
        'Prevents layout shift when an input is focused in iOS Safari/WebView. Uses a dual-input architecture (display + hidden fixed) with a visualViewport listener to suppress jumping.',
      note: 'On an iOS device, tap here and confirm the screen does not jump.',
      placeholder: 'Tap to type (no layout shift on iOS)',
      eventLog: 'Event log',
      setValueBtn: 'setValue()',
    },
    pullToRefresh: {
      title: 'PullToRefresh',
      description:
        'Pull down when scrolled to the top to trigger a refresh. Headless — you render the indicator yourself using distance, progress, and state.',
      note: 'Scroll to the top first, then pull down.',
      triggerBtn: 'trigger() — manual refresh',
      idle: '↓ Pull to refresh',
      pulling: (pct: number) => `↓ Pulling (${pct}%)`,
      armed: '↑ Release to refresh',
      refreshing: '⟳ Refreshing…',
      resetting: '✓ Done',
    },
    scrollContainer: {
      title: 'ScrollContainer',
      description:
        'A horizontal/vertical viewport pager: a camera model rendered with one CSS transform, no dependencies. Axis-locked pan, snap, edge resistance, pinch zoom, panel virtualization. The panels below are built like an e-commerce home: sticky header, hero banner, category chips, product grid, long feed.',
      note: "Drag sideways to switch tabs · scroll up/down inside a tab · pinch to zoom (pinching past minZoom/maxZoom rubber-bands back) · double-tap to zoom in/out · tap ♡. Panels use touch-action: pan-y, so while zoomed the browser keeps vertical touches for the panel's own scroll; switch to direction=vertical (non-scrolling card panels) to pan in both directions while zoomed. Desktop: trackpad/wheel sideways, arrow keys with the canvas focused, Ctrl + wheel to zoom.",
      tabs: ['For you', 'BEST', 'NEW', 'Exclusive', 'Gifts', 'Curation'],
      chips: [
        'All',
        'Home deco',
        'Fabric',
        'Tableware',
        'Digital',
        'Stationery',
        'Fragrance',
        'Food',
      ],
      sectionTitle: 'Picked for you',
      bannerTitle: 'Summer picks up to 40% off',
      bannerSub: 'App-only coupon for new members',
      shopNow: 'Shop now',
      noScroll: 'Short tab · no vertical scroll',
      verticalScroll: (n: number) => `Long feed · ${n} sections`,
      end: '— end —',
    },
    controls: {
      direction: 'direction',
      overscan: (n: number) => `overscan: ${n}`,
      snapThreshold: 'snapThreshold',
      resistance: 'resistance',
      minZoom: 'minZoom',
      maxZoom: 'maxZoom',
      enablePinchZoom: 'enablePinchZoom',
      doubleTapZoom: 'doubleTapZoom',
      threshold: 'threshold',
      maxDistance: 'maxDistance',
      enabled: 'enabled',
      disableOverscrollContain: 'disableOverscrollContain',
      failNext: 'fail next onRefresh',
    },
    scrollTo: 'scrollTo',
    zoomTo: 'zoomTo',
    animated: 'animated',
    instant: 'instant',
  },

  ko: {
    header: {
      sub: 'WebView UI 프리미티브',
      github: 'GitHub',
    },
    footer: {
      license: 'MIT 라이선스',
    },
    tabs: {
      'scroll-container': 'ScrollContainer',
      'pull-to-refresh': 'PullToRefresh',
      'stable-input': 'StableInput',
      'virtual-keyboard': 'VirtualKeyboard',
      'safe-area': 'SafeArea',
      'scroll-lock': 'ScrollLock',
    },
    safeArea: {
      title: 'useSafeArea',
      description:
        'env(safe-area-inset-*) CSS 값을 JavaScript로 읽어 반응형으로 제공합니다. 노치·다이나믹 아일랜드·홈 인디케이터 인셋을 JS에서 직접 활용할 수 있습니다.',
      note: '실제 WebView(노치 기기)에서 확인하면 0이 아닌 값이 표시됩니다.',
      visualization: 'safe area 시각화',
    },
    scrollLock: {
      title: 'useScrollLock',
      description:
        '레이아웃 이동 없이 body 스크롤을 잠급니다. 모달·드로어·바텀시트가 열릴 때 배경이 스크롤되는 현상을 방지합니다.',
      locked: '스크롤 잠금 중',
      unlocked: '스크롤 활성',
      hint: '잠금 후 페이지를 스크롤해보세요. body가 움직이지 않습니다.',
    },
    virtualKeyboard: {
      title: 'useVirtualKeyboard',
      description:
        'visualViewport 리사이즈 델타를 분석해 소프트 키보드의 열림/닫힘 상태와 높이를 추론합니다. iOS·Android 각각에 맞는 휴리스틱이 내장되어 있습니다.',
      note: '아래 인풋을 탭하면 키보드 상태 변화를 확인할 수 있습니다.',
      detected: '키보드 감지됨',
      placeholder: '탭해서 키보드 열기',
    },
    stableInput: {
      title: 'StableInput',
      description:
        'iOS Safari/WebView에서 input 포커스 시 발생하는 레이아웃 점프를 방지합니다. 디스플레이 인풋 + 숨김 fixed 인풋의 듀얼 구조로 visualViewport 이동을 억제합니다.',
      note: 'iOS 기기에서 탭 시 화면이 튀어 오르지 않는지 확인하세요.',
      placeholder: '탭해서 입력 (iOS 레이아웃 이동 없음)',
      eventLog: '이벤트 로그',
      setValueBtn: 'setValue()',
    },
    pullToRefresh: {
      title: 'PullToRefresh',
      description:
        '스크롤이 맨 위일 때 아래로 당기면 새로고침이 트리거됩니다. 인디케이터는 헤드리스 — distance/progress/state로 직접 렌더링합니다.',
      note: '스크롤을 맨 위로 올린 후 아래로 당겨보세요.',
      triggerBtn: 'trigger() — 수동 새로고침',
      idle: '↓ 당겨서 새로고침',
      pulling: (pct: number) => `↓ 당기는 중 (${pct}%)`,
      armed: '↑ 놓으면 새로고침',
      refreshing: '⟳ 새로고침 중…',
      resetting: '✓ 완료',
    },
    scrollContainer: {
      title: 'ScrollContainer',
      description:
        '가로/세로 뷰포트 페이저. 카메라 모델을 CSS transform 하나로 렌더링하며 의존성이 없습니다. 축 고정 pan, 스냅, 엣지 저항, 핀치 줌, 패널 가상화. 아래 패널은 실제 이커머스 홈처럼 구성했습니다: sticky 헤더, 히어로 배너, 카테고리 칩, 상품 그리드, 긴 피드.',
      note: '옆으로 끌면 탭 전환 · 탭 안에서 위아래 스크롤 · 핀치 줌(minZoom/maxZoom을 넘기면 고무줄처럼 되돌아옴) · 더블탭으로 확대/축소 · ♡ 탭. 패널이 touch-action: pan-y라 줌 상태에서도 세로 터치는 브라우저가 패널 자체 스크롤에 씁니다. 줌 상태에서 양 방향으로 움직여 보려면 direction=vertical(스크롤 없는 카드 패널)로 바꾸세요. 데스크톱: 트랙패드·휠 옆으로 밀기, 캔버스에 포커스 두고 화살표, Ctrl + 휠 줌.',
      tabs: ['추천', 'BEST', 'NEW', '단독', '선물하기', '큐레이션'],
      chips: ['전체', '홈데코', '홈패브릭', '테이블웨어', '디지털', '문구', '향기', '푸드'],
      sectionTitle: '취향에 딱 맞는 아이템',
      bannerTitle: '여름맞이 최대 40% 할인',
      bannerSub: '신규 회원 앱 전용 쿠폰',
      shopNow: '지금 보러가기',
      noScroll: '짧은 탭 · 세로 스크롤 없음',
      verticalScroll: (n: number) => `긴 피드 · ${n}개 섹션`,
      end: '— end —',
    },
    controls: {
      direction: 'direction',
      overscan: (n: number) => `overscan: ${n}`,
      snapThreshold: 'snapThreshold',
      resistance: 'resistance',
      minZoom: 'minZoom',
      maxZoom: 'maxZoom',
      enablePinchZoom: 'enablePinchZoom',
      doubleTapZoom: 'doubleTapZoom',
      threshold: 'threshold',
      maxDistance: 'maxDistance',
      enabled: 'enabled',
      disableOverscrollContain: 'disableOverscrollContain',
      failNext: '다음 onRefresh 실패시키기',
    },
    scrollTo: 'scrollTo',
    zoomTo: 'zoomTo',
    animated: '애니메이션',
    instant: '즉시',
  },
} as const;

/** 리터럴·튜플을 넓힌다 — 언어별 문구가 달라도 같은 구조면 같은 타입이 되도록. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends (...args: infer A) => infer R
      ? (...args: A) => Widen<R>
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

export type Translations = Widen<(typeof t)['en']>;
