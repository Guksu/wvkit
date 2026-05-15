/**
 * 순수 함수 모음 — CameraControl이 사용하는 좌표 변환·easing·resistance·snap 계산.
 *
 * 모든 함수는 부수효과 없이 입력→출력 매핑만 수행하므로 단위 테스트(#5)에서 직접 검증한다.
 *
 * 좌표 규약:
 *  - 스크린: (0,0) = 좌상단, x→오른쪽, y→아래
 *  - 월드/카메라: Three.js 표준 (+y 위), OrthographicCamera frustum width = rootWidth,
 *    1px = 1 world unit at zoom=1
 *
 * 매핑 식 (OrthographicCamera 기준):
 *   screenX = (worldX - cameraX) * zoom + rootWidth/2
 *   screenY = -(worldY - cameraY) * zoom + rootHeight/2
 *   ⇔
 *   worldX = (screenX - rootWidth/2) / zoom + cameraX
 *   worldY = cameraY - (screenY - rootHeight/2) / zoom
 */

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 엣지 고무줄(rubber band). `[min, max]` 밖의 값은 `resistance ∈ [0,1]` 배율로 감쇠.
 *
 *   value=110, max=100, resistance=0.2 → 100 + 10*0.2 = 102
 */
export function applyResistance(
  value: number,
  min: number,
  max: number,
  resistance: number,
): number {
  if (max < min) return clamp(value, min, max);
  if (value < min) return min - (min - value) * resistance;
  if (value > max) return max + (value - max) * resistance;
  return value;
}

export function screenPointToWorld(
  screenX: number,
  screenY: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
  rootWidth: number,
  rootHeight: number,
): { x: number; y: number } {
  const cx = rootWidth / 2;
  const cy = rootHeight / 2;
  return {
    x: (screenX - cx) / zoom + cameraX,
    y: cameraY - (screenY - cy) / zoom,
  };
}

/**
 * 줌이 변할 때 특정 월드 좌표를 특정 스크린 좌표 위치에 고정시키기 위한 카메라 위치 계산.
 * 핀치 줌의 "손가락 중점이 같은 월드 점을 가리키도록" 보정에 사용.
 */
export function cameraPosForAnchor(
  worldX: number,
  worldY: number,
  screenX: number,
  screenY: number,
  newZoom: number,
  rootWidth: number,
  rootHeight: number,
): { x: number; y: number } {
  const cx = rootWidth / 2;
  const cy = rootHeight / 2;
  return {
    x: worldX - (screenX - cx) / newZoom,
    y: worldY + (screenY - cy) / newZoom,
  };
}

/**
 * `axis` 축에서 `cameraValue`와 가장 가까운 패널 인덱스. 동거리는 작은 인덱스 우선.
 */
export function nearestPanelIndex(
  cameraValue: number,
  positions: ReadonlyArray<{ x: number; y: number }>,
  axis: 'x' | 'y',
): number {
  const first = positions[0];
  if (!first) return 0;
  let best = 0;
  let bestDist = Math.abs(first[axis] - cameraValue);
  for (let i = 1; i < positions.length; i++) {
    const pos = positions[i];
    if (!pos) continue;
    const d = Math.abs(pos[axis] - cameraValue);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * 스냅 결정: 시작 인덱스, 드래그 비율(패널 단위), 속도 비율(패널/초)을 받아 다음 인덱스 산출.
 *
 *  - `dragRatio + velocityRatio*velocityWeight` 가 `snapThreshold` 초과면 다음/이전 패널로 이동
 *  - 그 외에는 시작 인덱스 유지
 *  - 결과는 `[0, panelCount-1]`로 클램프
 */
export function decideSnapTarget(
  startIndex: number,
  dragRatio: number,
  velocityRatio: number,
  snapThreshold: number,
  panelCount: number,
  velocityWeight = 0.3,
): number {
  if (panelCount <= 0) return 0;
  const effective = dragRatio + velocityRatio * velocityWeight;
  let target = startIndex;
  if (effective > snapThreshold) target = startIndex + 1;
  else if (effective < -snapThreshold) target = startIndex - 1;
  return clamp(target, 0, panelCount - 1);
}
