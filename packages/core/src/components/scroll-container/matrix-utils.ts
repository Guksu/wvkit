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

/**
 * 줌 상태에서 카메라가 패널 중심에서 벗어날 수 있는 반폭(축 단위).
 *
 * 패널이 뷰포트를 꽉 채운다고 보면 zoom `z`에서 실제로 보이는 폭은 `panelSize / z`.
 * 카메라가 패널 가장자리까지 가려면 중심에서 `(panelSize − panelSize / z) / 2` 만큼 움직여야 한다.
 *
 *   panelSize=400, zoom=2 → 100   (뷰포트에 패널 절반만 보이므로 좌우 100px씩 여유)
 *   zoom ≤ 1              → 0     (패널 전체가 보이므로 pan 여지 없음 — 기존 스냅 계약 그대로)
 */
export function zoomedHalfExtent(panelSize: number, zoom: number): number {
  if (!(zoom > 1) || !(panelSize > 0)) return 0;
  return (panelSize / 2) * (1 - 1 / zoom);
}

export interface ZoomedReleaseResult {
  /** 릴리스 후 활성으로 볼 패널 인덱스. */
  index: number;
  /** 카메라가 트윈으로 도달할 목표 위치 (`s` 좌표). */
  target: number;
}

/**
 * 줌 상태(zoom > 1) pan 릴리스 결정.
 *
 * 좌표는 "인덱스가 커지는 방향이 +"인 1차원 `s` 공간이다 (X축: s = x, Y축: s = −y).
 * 패널 i는 `[centers[i] − halfExtents[i], centers[i] + halfExtents[i]]` 범위 안에서 자유롭게 pan 할 수 있다.
 *
 *  - 현재 `s`가 어떤 패널 범위 안 → 그 자리에 머문다 (중심으로 되돌리지 않음)
 *  - 첫 패널 앞 / 끝 패널 뒤 (엣지 저항 구간) → 해당 가장자리로 복귀
 *  - 두 패널 사이 간격(gap) → 진행 방향 기준 gap 통과 비율 + 속도 가중이 `snapThreshold`를 넘으면
 *    앞 패널의 가까운 가장자리로, 아니면 출발 쪽 패널의 가장자리로 스냅
 *
 * `velocity`는 s 단위 / 속도 샘플 창(100ms). gap 길이로 나눠 비율화하며 `decideSnapTarget`과 같은
 * 가중치(기본 0.3)를 쓴다.
 */
export function resolveZoomedRelease(
  s: number,
  sStart: number,
  velocity: number,
  centers: ReadonlyArray<number>,
  halfExtents: ReadonlyArray<number>,
  snapThreshold: number,
  velocityWeight = 0.3,
): ZoomedReleaseResult {
  const count = centers.length;
  if (count === 0) return { index: 0, target: s };
  const lo = (i: number): number => (centers[i] ?? 0) - (halfExtents[i] ?? 0);
  const hi = (i: number): number => (centers[i] ?? 0) + (halfExtents[i] ?? 0);

  if (s <= lo(0)) return { index: 0, target: lo(0) };
  if (s >= hi(count - 1)) return { index: count - 1, target: hi(count - 1) };

  for (let i = 0; i < count; i++) {
    if (s >= lo(i) && s <= hi(i)) return { index: i, target: s };
  }

  // 여기 도달했으면 s는 어떤 두 패널 사이 gap 안이다: hi(j) < s < lo(j+1)
  for (let j = 0; j < count - 1; j++) {
    const gapStart = hi(j);
    const gapEnd = lo(j + 1);
    if (s <= gapStart || s >= gapEnd) continue;
    const gapLen = gapEnd - gapStart;
    const velocityRatio = velocity / gapLen;
    if (s >= sStart) {
      // 전진 중: 출발 쪽(j) 가장자리에서 얼마나 건너왔는가
      const effective = (s - gapStart) / gapLen + velocityRatio * velocityWeight;
      return effective > snapThreshold
        ? { index: j + 1, target: gapEnd }
        : { index: j, target: gapStart };
    }
    // 후진 중: 출발 쪽(j+1) 가장자리에서 얼마나 건너왔는가 (속도 부호 반전)
    const effective = (gapEnd - s) / gapLen - velocityRatio * velocityWeight;
    return effective > snapThreshold
      ? { index: j, target: gapStart }
      : { index: j + 1, target: gapEnd };
  }

  // 범위가 겹치는 비정상 입력 등 — 가장 가까운 중심의 패널에 머문다
  let best = 0;
  for (let i = 1; i < count; i++) {
    if (Math.abs((centers[i] ?? 0) - s) < Math.abs((centers[best] ?? 0) - s)) best = i;
  }
  return { index: best, target: s };
}
