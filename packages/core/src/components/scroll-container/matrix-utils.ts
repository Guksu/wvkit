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

/**
 * 줌 고무줄(rubber band). `[minZoom, maxZoom]` 밖의 줌은 배율(로그) 공간에서 `resistance ∈ [0,1]` 지수로 감쇠.
 *
 *   raw < min → min × (raw / min)^resistance,  raw > max → max × (raw / max)^resistance
 *
 * 선형 감쇠가 아니라 배율 감쇠를 쓰는 이유: 줌은 곱셈량이라 선형으로 빼면 resistance 1에서 0에 닿아
 * 앵커 보정(÷zoom)이 발산한다. 배율 감쇠는 raw > 0인 한 항상 양수다.
 *
 *   minZoom=1, raw=0.5, resistance=0.2 → 0.5^0.2 ≈ 0.87
 *   resistance=0 → 하드 클램프, resistance=1 → 제한 없음 (엣지 저항과 같은 규약)
 */
export function applyZoomResistance(
  raw: number,
  minZoom: number,
  maxZoom: number,
  resistance: number,
): number {
  if (!(raw > 0)) return minZoom;
  if (maxZoom < minZoom) return clamp(raw, minZoom, maxZoom);
  if (raw < minZoom) return minZoom * (raw / minZoom) ** resistance;
  if (raw > maxZoom) return maxZoom * (raw / maxZoom) ** resistance;
  return raw;
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
 * 짧은 플릭 판정 — Android ViewPager `determineTargetPage` 의 플릭 조건과 같다.
 *
 * 손가락이 페이저 축으로 `minDistance` px 넘게 움직였고 놓는 속도가 `minVelocity` px/ms 를 넘으면
 * 거리 비율과 상관없이 정한다: 속도가 움직인 방향과 같으면 그쪽으로 한 칸, 반대면 제자리.
 * 조건을 넘지 못하면 `null` — 거리 비율 판정(`decideSnapTarget`)에 맡긴다.
 *
 *   ViewPager: MIN_DISTANCE_FOR_FLING = 25dp, MIN_FLING_VELOCITY = 400dp/s (CSS px ≈ dp → 0.4 px/ms)
 *
 * `moved`·`velocity` 는 인덱스가 커지는 방향이 + 인 값, `fingerDistance` 는 누른 지점부터의 축 거리(크기).
 */
export function flingTarget(
  startIndex: number,
  fingerDistance: number,
  moved: number,
  velocity: number,
  panelCount: number,
  minDistance = 25,
  minVelocity = 0.4,
): number | null {
  if (panelCount <= 0 || moved === 0) return null;
  if (!(fingerDistance > minDistance && Math.abs(velocity) > minVelocity)) return null;
  const target =
    Math.sign(velocity) === Math.sign(moved) ? startIndex + Math.sign(moved) : startIndex;
  return clamp(target, 0, panelCount - 1);
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

/**
 * 줌 `zoom` 에서 패널 하나를 볼 때 카메라(축 좌표)의 정착 위치와 움직일 수 있는 범위.
 *
 * 뷰포트 반폭은 `viewport / (2·zoom)`. 카메라가 패널 안을 보는 범위는 s 공간(인덱스가 커지는 쪽이 +)에서
 *   lo = 패널 시작 + 뷰포트 반폭,  hi = 패널 끝 − 뷰포트 반폭
 * - lo ≤ hi (패널이 보이는 폭보다 넓다): 그 범위 안에서 pan. 정착 위치는 center 정렬이면 패널 중심, start 면 lo.
 * - lo > hi (패널이 화면 안에 다 들어온다): 범위는 한 점. center 정렬은 패널 중심, start 는 패널 시작이 화면 시작에 붙는 lo.
 *
 * 패널 크기 = 뷰포트 크기(기본 레이아웃)면 범위 반폭은 `zoomedHalfExtent` 와 같고 정착 위치는 패널 중심이다.
 * `forward` 는 인덱스가 커지는 방향의 축 부호 (가로 x: +1, 세로 y: −1 — 패널이 아래(−y)로 쌓인다).
 */
export function panelCameraRange(
  center: number,
  size: number,
  viewport: number,
  zoom: number,
  align: 'center' | 'start',
  forward: 1 | -1,
): { rest: number; min: number; max: number } {
  const sc = forward * center;
  const z = zoom > 0 ? zoom : 1;
  const half = (viewport > 0 ? viewport : size) / (2 * z);
  const lo = sc - size / 2 + half;
  const hi = sc + size / 2 - half;
  const restS = align === 'start' ? lo : sc;
  const [minS, maxS] = lo <= hi ? [lo, hi] : [restS, restS];
  // 축 좌표로 되돌린다 (forward −1 이면 부호와 대소가 뒤집힌다)
  return forward === 1
    ? { rest: restS, min: minS, max: maxS }
    : { rest: -restS, min: -maxS, max: -minS };
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

/**
 * 릴리스 속도에 이어지는 스냅 트윈 시간(ms).
 *
 * easeOutCubic의 t=0 기울기는 3이므로 트윈의 초기 속도는 `3·distance / duration`이다.
 * 손가락이 놓인 순간의 속도 `velocityToward`(목표 방향 양수, 단위/ms)와 이어지도록
 * `duration = 3·distance / velocityToward`로 잡는다 — 빨리 튕길수록 짧고 단호하게, 천천히 놓을수록 길게.
 *
 *  - 상한은 거리에 비례: `minMs + (distance / referenceDistance) · (maxMs − minMs)` (작은 복귀는 짧게)
 *  - 목표와 반대 방향 속도(엣지 저항 구간에서 바깥으로 튕김)나 정지 상태면 상한을 그대로 쓴다
 *  - 하한 `minMs` 아래로는 내려가지 않는다 (너무 빠른 플릭도 눈에 보이게)
 */
export function snapDurationMs(
  distance: number,
  velocityToward: number,
  referenceDistance: number,
  minMs: number,
  maxMs: number,
): number {
  const d = Math.abs(distance);
  const ref = referenceDistance > 0 ? referenceDistance : 1;
  const cap = clamp(minMs + (d / ref) * (maxMs - minMs), minMs, maxMs);
  if (!(velocityToward > 0) || d === 0) return cap;
  return clamp((3 * d) / velocityToward, minMs, cap);
}

/**
 * 관성 투영 — 릴리스 속도로 감속했을 때 멈추는 위치.
 *
 * iOS UIScrollView의 감속(프레임당 0.998, ms 기준)과 같은 지수 감쇠를 쓰면 총 이동거리는
 * `v / (1 − rate)` 이다. rate 0.998 → 속도(단위/ms) × 500.
 */
export function projectInertia(
  position: number,
  velocityPerMs: number,
  decelerationRate = 0.998,
): number {
  const r = decelerationRate > 0 && decelerationRate < 1 ? decelerationRate : 0.998;
  return position + velocityPerMs / (1 - r);
}
