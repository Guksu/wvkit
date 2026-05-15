/**
 * 카메라 pan 축 제약.
 *
 * Three.js + CSS3DRenderer + OrthographicCamera 아키텍처에서 사용자가 드래그할 때
 * 카메라가 이동할 수 있는 축을 제한한다. (기존 "스와이프 방향"에서 의미 재정의됨)
 *
 * - `horizontal`: X 축 pan만 허용 — 가로 패널 전환 (네이티브 뷰페이저 패턴)
 * - `vertical`: Y 축 pan만 허용 — 세로 패널 전환
 * - `both`: X+Y 양축 pan 허용 — 대각 스크롤 가능 (정밀 제어는 CameraControl 구현에서 규정)
 */
export type ScrollContainerDirection = 'horizontal' | 'vertical' | 'both';

export interface ScrollContainerOptions {
  /** 카메라 pan 축 제약. */
  direction: ScrollContainerDirection;
  /** scene에 배치할 패널 엘리먼트들. 순서 = index. */
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
  /** 엣지 고무줄 저항값 (0 ≤ x ≤ 1). 기본값 `0.2`. */
  resistance?: number;
  /** 핀치 줌 활성화 여부. 기본값 `true`. */
  enablePinchZoom?: boolean;
  /** 최소 줌 레벨. 기본값 `1.0`. (0 초과) */
  minZoom?: number;
  /** 최대 줌 레벨. 기본값 `3.0`. (`minZoom` 이상) */
  maxZoom?: number;
  /** 줌 레벨이 변경될 때 호출. */
  onZoomChange?: (zoom: number) => void;
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
