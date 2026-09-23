/**
 * 직교(orthographic) 카메라의 최소 표현.
 *
 * 좌표 규약은 `matrix-utils.ts`와 같다: 월드 1unit = zoom 1에서 화면 1px, +y가 위.
 * 카메라는 위치(x, y)와 배율(zoom)만 가진다 — 투영 행렬·프러스텀은 `panel-renderer.ts`가
 * CSS transform 한 줄로 대신하므로 여기서 계산하지 않는다.
 */
export interface PanCamera {
  position: { x: number; y: number };
  zoom: number;
}

export function createCamera(zoom = 1): PanCamera {
  return { position: { x: 0, y: 0 }, zoom };
}
