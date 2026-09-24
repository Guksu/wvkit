/**
 * 카메라 pan 축 제약.
 *
 * 카메라 모델(위치 x·y + zoom)에서 사용자가 드래그할 때 카메라가 이동할 수 있는 축을 제한한다.
 * (기존 "스와이프 방향"에서 의미 재정의됨)
 *
 * - `horizontal`: X 축 pan만 허용 — 가로 패널 전환 (네이티브 뷰페이저 패턴)
 * - `vertical`: Y 축 pan만 허용 — 세로 패널 전환
 * - `both`: X+Y 양축 pan 허용 — 대각 스크롤 가능 (정밀 제어는 CameraControl 구현에서 규정)
 */
export type ScrollContainerDirection = 'horizontal' | 'vertical' | 'both';

export interface ScrollContainerOptions {
  /** 카메라 pan 축 제약. */
  direction: ScrollContainerDirection;
  /**
   * scene에 배치할 패널 엘리먼트들. 순서 = index.
   *
   * 패널이 자체 세로 스크롤을 가지면(`overflow-y: auto`) 반드시 `touch-action: pan-y`도 함께 주어야
   * 가로 스와이프가 브라우저에 가로채이지 않는다 (호스트 root는 `touch-action: none`).
   */
  panels: HTMLElement[];
  /** 마운트 시 활성화할 패널 인덱스. 기본값 `0`. */
  initialIndex?: number;
  /**
   * 패널별 동적 높이(px) — `direction: 'vertical'` 일 때 의미 있음.
   * 지정하지 않으면 컨테이너 클라이언트 높이를 사용.
   */
  panelHeight?: (index: number) => number;
  /**
   * 가로 패널 폭. 기본값 `1` (컨테이너 폭 전체).
   * - `0 < x ≤ 1`: 컨테이너 폭 비율 (`0.85` → 85%, 옆 패널이 살짝 보인다)
   * - `x > 1`: px (`320` → 320px)
   * - 함수: 패널마다 다른 폭 (반환값 규칙은 위와 같다)
   *
   * 지정하면 패널 루트의 인라인 `width` 를 이 값으로 덮어쓴다 (destroy 시 원래대로). 세로 페이저에서는 쓰지 않는다
   * (세로는 `panelHeight`).
   */
  panelWidth?: number | ((index: number) => number);
  /** 패널 사이 간격(px, 0 이상). 기본값 `0`. 가로·세로 모두. */
  gap?: number;
  /**
   * 활성 패널을 화면 어디에 맞출지. 기본값 `'center'`.
   * - `'center'`: 패널 중심이 화면 중심 — 양옆 패널이 같은 만큼 보인다 (배너)
   * - `'start'`: 패널 시작(가로 왼쪽, 세로 위)이 화면 시작 — 다음 패널만 보인다
   *
   * 패널이 화면보다 좁을 때만 차이가 난다. 첫·끝 패널에서는 빈 공간이 생길 수 있다 (끝 정렬 보정은 하지 않는다).
   */
  align?: 'center' | 'start';
  /** 활성 패널 인덱스가 변경될 때 호출. */
  onIndexChange?: (index: number) => void;
  /** 활성 패널 양쪽으로 미리 scene에 유지할 패널 수. 기본값 `1`. */
  overscan?: number;
  /**
   * 천천히 놓을 때 다음 패널로 넘기기 위한 드래그 비율 (0 < x ≤ 1, 두 정착 위치 사이 거리 대비). 기본값 `0.3`.
   * 누른 지점에서 25px 넘게 움직이고 0.4px/ms 넘게 빠르게 놓은 플릭은 이 값과 상관없이 플릭 방향으로 한 칸 넘긴다.
   */
  snapThreshold?: number;
  /**
   * 드래그 시작 여유(px, 0 이상). 기본값 `10`.
   * 포인터가 이만큼 움직이기 전에는 페이저가 움직이지 않고, 넘는 순간 우세 축(45° 기준)으로 방향을 정한다.
   * 교차 축이 우세하거나(zoom ≤ 1) 그 방향을 브라우저가 스크롤할 터치(`touch-action`)면 그 제스처는 페이저가 무시한다.
   * 탭 떨림과, `pan-y` 패널에서 세로 스크롤이 시작되기 전의 가로 흔들림을 막는다. `0` 이면 이전처럼 첫 move 부터 따라간다.
   */
  dragThreshold?: number;
  /**
   * 페이저가 받지 않을 영역의 CSS 선택자. 누른 요소가 이 선택자에 맞는 요소(패널 안) 안에 있으면 그 제스처는
   * 그 요소의 것이다 — 페이저는 끌기·핀치·더블탭을 시작하지 않고, 그 위의 휠(페이지 넘김·줌 상태 pan)도 손대지 않는다.
   * 패널 안에 Swiper·Embla 같은 JS 캐러셀을 넣을 때 쓴다 (예: `'.swiper'`). 캐러셀의 끝에서 더 밀어도 패널은 넘어가지 않는다.
   * CSS `overflow-x: auto` 가로 스크롤(`touch-action: pan-x pan-y`)은 브라우저가 가져가므로 이 옵션 없이 동작한다.
   */
  noDragSelector?: string;
  /** 엣지 고무줄 저항값 (0 ≤ x ≤ 1). 기본값 `0.2`. 핀치가 `minZoom`/`maxZoom`을 넘을 때의 줌 고무줄에도 쓰인다. */
  resistance?: number;
  /** 핀치 줌 활성화 여부. 기본값 `true`. */
  enablePinchZoom?: boolean;
  /** 최소 줌 레벨. 기본값 `1.0`. (0 초과) */
  minZoom?: number;
  /** 최대 줌 레벨. 기본값 `3.0`. (`minZoom` 이상) */
  maxZoom?: number;
  /**
   * 더블탭 줌 토글 목표 레벨. 숫자를 주면 활성화: `minZoom`에서 더블탭하면 탭한 지점을 고정한 채 이 레벨까지
   * 확대하고, 줌 상태에서 더블탭하면 `minZoom`으로 돌아온다(패널 중심). 기본값 `false`(비활성).
   * (`minZoom` 초과 `maxZoom` 이하. `enablePinchZoom`과 독립.)
   *
   * 패널 안 버튼을 두 번 빠르게 탭해도 줌이 토글되므로, 더블탭에 다른 뜻(좋아요 등)을 둔 패널이면 켜지 마세요.
   */
  doubleTapZoom?: number | false;
  /** 줌 레벨이 변경될 때 호출 (핀치 릴리스·더블탭·ctrl+휠·`zoomTo`). */
  onZoomChange?: (zoom: number) => void;
  /**
   * 휠·트랙패드 입력. 기본값 `true`.
   * 페이저: 축 방향 휠 제스처 하나당 한 패널 (누적 40px). 교차 축 성분이 더 크거나, 그 방향으로 더 스크롤할 수
   * 있는 중첩 스크롤러 위면 네이티브에 맡긴다. 줌 상태: 카메라 pan. ctrl+휠(트랙패드 핀치): 커서 고정 줌.
   * 소비한 휠만 `preventDefault` 한다 (macOS 가로 스와이프 뒤로가기 방지).
   */
  wheel?: boolean;
  /**
   * 키보드 입력. 기본값 `true`. 호스트 자신에 포커스가 있을 때만: 축 방향 화살표(이전/다음), Home/End(첫/끝),
   * Escape(줌 상태면 minZoom). 호스트에 `tabindex` 가 없으면 `0` 을 준다.
   */
  keyboard?: boolean;
  /**
   * ARIA 속성 부여. 기본값 `true`. 호스트 `role="group"` + `aria-roledescription="carousel"`, 패널 `role="group"` +
   * `aria-roledescription="slide"` + `aria-label="n / N"`, 비활성 패널 `aria-hidden` + `inert`. 이미 있는 속성은
   * 건드리지 않는다. 접근 가능한 이름은 앱이 호스트에 `aria-label` 로 준다.
   */
  a11y?: boolean;
}

/**
 * `setOptions` 에 넘기는 값 — 바꿀 옵션만. `undefined` 를 주면 그 옵션을 기본값으로 되돌린다.
 * `initialIndex` 는 마운트 때만 쓰므로 없다.
 */
export type ScrollContainerOptionsUpdate = {
  [K in Exclude<keyof ScrollContainerOptions, 'initialIndex'>]?:
    | ScrollContainerOptions[K]
    | undefined;
};

export interface ScrollContainerInstance {
  /** 지정한 인덱스로 스크롤. `animated: true`(기본)면 트랜지션, false면 즉시. */
  scrollTo(index: number, opts?: { animated?: boolean }): void;
  /** 현재 활성 패널 인덱스. */
  getActiveIndex(): number;
  /** 지정 줌 레벨로 설정. `animated: true`(기본)면 트랜지션, false면 즉시. */
  zoomTo(level: number, opts?: { animated?: boolean }): void;
  /** 현재 줌 레벨. */
  getZoom(): number;
  /**
   * 패널 목록을 바꾼다 (다시 마운트하지 않음). 보던 패널이 남아 있으면 그 패널을 계속 보여 주고(번호가 바뀌면
   * `onIndexChange`), 지워졌으면 같은 번호 자리의 패널로 간다. 남는 패널은 DOM 에서 떼지 않아 스크롤 위치가 유지된다.
   * 빠진 패널은 떼어지고 인라인 스타일·속성이 원래대로 돌아온다. 진행 중인 제스처·애니메이션은 멈춘다.
   */
  setPanels(panels: HTMLElement[]): void;
  /**
   * 옵션을 바꾼다 (다시 마운트하지 않음). 바꿀 옵션만 넘긴다 (`panels` 포함 가능). 잘못된 값이면 아무것도
   * 바꾸지 않고 `WebviewHeadlessError`. 실제로 바뀐 것이 없으면(같은 값, 같은 결과를 내는 새 함수) 아무 일도 하지 않는다.
   * 바뀐 것이 있으면 진행 중인 제스처·애니메이션은 멈추고, 줌은 새 범위 안으로 유지된다.
   */
  setOptions(options: ScrollContainerOptionsUpdate): void;
  /** 리스너 해제 및 DOM 참조 정리. */
  destroy(): void;
}
