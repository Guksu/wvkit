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
   * 패널별 동적 높이(px) — `direction: 'vertical'` 또는 `'both'`일 때 의미 있음.
   * 지정하지 않으면 컨테이너 클라이언트 높이를 사용.
   */
  panelHeight?: (index: number) => number;
  /** 활성 패널 인덱스가 변경될 때 호출. */
  onIndexChange?: (index: number) => void;
  /** 활성 패널 양쪽으로 미리 scene에 유지할 패널 수. 기본값 `1`. */
  overscan?: number;
  /** 스냅 트리거에 필요한 스와이프 비율 (0 < x ≤ 1). 기본값 `0.3`. */
  snapThreshold?: number;
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

export interface ScrollContainerInstance {
  /** 지정한 인덱스로 스크롤. `animated: true`(기본)면 트랜지션, false면 즉시. */
  scrollTo(index: number, opts?: { animated?: boolean }): void;
  /** 현재 활성 패널 인덱스. */
  getActiveIndex(): number;
  /** 지정 줌 레벨로 설정. `animated: true`(기본)면 트랜지션, false면 즉시. */
  zoomTo(level: number, opts?: { animated?: boolean }): void;
  /** 현재 줌 레벨. */
  getZoom(): number;
  /** 리스너 해제 및 DOM 참조 정리. */
  destroy(): void;
}
