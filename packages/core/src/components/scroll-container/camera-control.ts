import type { PanCamera } from './camera';
import {
  applyResistance,
  applyZoomResistance,
  cameraPosForAnchor,
  clamp,
  decideSnapTarget,
  easeOutCubic,
  nearestPanelIndex,
  projectInertia,
  resolveZoomedRelease,
  screenPointToWorld,
  snapDurationMs,
  zoomedHalfExtent,
} from './matrix-utils';

/**
 * 입력(pointer/touch) → 카메라 조작을 담당하는 컨트롤러.
 *
 * 단일 책임: 카메라 행렬만 만진다. 활성 인덱스/가상화/사용자 콜백 갱신은
 * 호출자(ScrollContainer)가 `onChange` / `onPanRelease` / `onPinchRelease` 콜백을 통해 처리한다.
 *
 * 지원 제스처:
 *  - 1 pointer: axis-constrained pan + 엣지 저항 (zoom > 1 이면 교차 축도 패널 범위 안에서 pan)
 *  - 2 pointer: 핀치 줌 + 줌 중심점 anchor (enablePinchZoom=true 일 때만), min/max 줌 밖은 고무줄
 *  - 더블탭: `doubleTapZoom` 레벨 ↔ `minZoom` 토글 (doubleTapZoom 이 숫자일 때만)
 *  - 1 pointer 해제 → 스냅 결정 → 릴리스 트윈 시작 → onPanRelease (트윈은 컨트롤이 직접 소유)
 *  - pointercancel(브라우저가 터치를 가져감, 예: `pan-y` 패널의 세로 스크롤) → 이동을 시작 위치로 되돌림
 *  - 명령형 animateToIndex/animateToZoom: easeOutCubic RAF 트윈(고정 300ms), 진행 중이면 cancel 후 재시작
 *
 * 좌표: 모든 포인터 좌표는 root 좌상단 기준이다 (제스처 시작 시 `getBoundingClientRect`를 한 번 읽어 고정).
 * clientX/Y를 그대로 쓰면 root가 페이지 (0,0)에 있지 않을 때 핀치·더블탭의 앵커가 어긋난다.
 *
 * 관성(릴리스 속도 반영):
 *  - 릴리스 트윈 시간은 `snapDurationMs`로 손가락 속도에 이어지게 정한다 — 빠른 플릭 120ms까지,
 *    느린 릴리스 최대 400ms(줌 상태 자유 pan은 800ms). 프로그램 호출(scrollTo/zoomTo)은 고정 300ms.
 *  - 페이저(zoom ≤ 1)는 네이티브 페이저처럼 한 제스처에 최대 한 패널만 넘긴다 (`decideSnapTarget`).
 *  - 줌 상태 pan: 놓은 위치가 패널 범위 안이면 `projectInertia`(iOS 감속 0.998/ms)로 멈출 위치를 구해
 *    그 패널의 가장자리 안에서 멈춘다 — 관성만으로는 다음 패널로 넘어가지 않는다 (iOS 사진 뷰어와 같음).
 *    놓은 위치가 이미 가장자리 밖(gap·저항 구간)이면 `resolveZoomedRelease`가 방향·속도로 스냅을 정한다.
 *    교차 축도 같은 투영을 패널의 교차 축 범위 안으로 잘라 감속한다.
 *
 * 줌 상태(zoom > 1)의 pan:
 *  - pan 경계가 첫/끝 패널의 줌 반폭(`zoomedHalfExtent`)만큼 바깥으로 넓어져 패널 가장자리까지 볼 수 있다.
 *  - 교차 축(horizontal이면 Y)은 패널의 교차 축 반폭 안에서 pan 된다 (밖은 엣지 저항, 릴리스 시 복귀).
 *    zoom ≤ 1 이면 반폭이 0 이라 교차 축은 고정 — 대각 드래그가 축만 움직이는 페이저 계약 그대로.
 *  - 릴리스 시 패널 중심으로 되돌리지 않는다. 패널 범위 안이면 그 자리에 머물고, 패널 사이 gap이면
 *    `resolveZoomedRelease`가 진행 방향·속도로 앞/뒤 패널의 가까운 가장자리를 고른다.
 *  - zoom ≤ 1 이면 기존 계약(패널 중심 스냅, `decideSnapTarget`) 그대로.
 *
 * 줌 고무줄:
 *  - 핀치가 `minZoom`/`maxZoom`을 넘으면 `applyZoomResistance`로 감쇠된 줌을 보여주고, 마지막 손가락을
 *    떼는 릴리스 트윈에서 경계 줌으로 되돌린다 (`onPinchRelease`는 항상 경계 안 값을 낸다).
 *  - 핀치 중 교차 축은 새 줌의 반폭 안으로 하드 클램프한다 (저항 없음) — 줌아웃으로 반폭이 0에
 *    가까워질 때 중심으로 연속적으로 수렴하게.
 */

const TWEEN_DURATION_MS = 300;
const VELOCITY_SAMPLE_WINDOW_MS = 100;
/** 릴리스 스냅 트윈 시간 범위 — 페이저 스냅 */
const SNAP_MIN_MS = 120;
const SNAP_MAX_MS = 400;
/** 줌 상태 자유 pan 감속의 상한 (한 패널 안에서 멀리 흘러갈 수 있으므로 더 길게) */
const ZOOMED_PAN_MAX_MS = 800;
/**
 * 탭·더블탭 판정 (Android GestureDetector 계열 값).
 *  - 탭: 눌린 시간 ≤ 300ms, down→up 이동 ≤ 10px
 *  - 더블탭: 첫 탭 up → 두 번째 down 간격 ≤ 300ms, 두 down 위치 거리 ≤ 40px
 */
const TAP_MAX_MS = 300;
const TAP_SLOP_PX = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST_PX = 40;

export interface CameraControlOptions {
  root: HTMLElement;
  camera: PanCamera;
  /** 'both' → 'horizontal' 폴백이 이미 적용된 축. */
  direction: 'horizontal' | 'vertical';
  positions: ReadonlyArray<{ x: number; y: number }>;
  /**
   * 패널별 축 방향 크기(px). `positions`와 같은 인덱스·같은 배열 참조를 유지하면 리사이즈 반영이 함께 된다.
   * 생략하거나 항목이 없으면 root client size(축 방향)를 쓴다. 줌 상태 pan 경계 계산에만 사용.
   */
  panelSizes?: ReadonlyArray<number>;
  /** 현재 카메라 frustum 크기 (root client size). 리사이즈 후 변할 수 있음. */
  getRootSize: () => { width: number; height: number };
  snapThreshold: number;
  resistance: number;
  minZoom: number;
  maxZoom: number;
  enablePinchZoom: boolean;
  /** 더블탭 줌 목표 레벨. `false`(기본)면 더블탭을 추적하지 않는다. */
  doubleTapZoom?: number | false;
  /** 카메라가 변경됨. 호출자는 requestRender 수행. */
  onChange: () => void;
  /**
   * Pan 제스처 종료 → 스냅 결정된 패널 인덱스. 카메라 복귀/스냅 트윈은 이 콜백 직전에 컨트롤이
   * 이미 시작했으므로 호출자는 상태(활성 인덱스·가상화)만 갱신하면 된다.
   */
  onPanRelease: (targetIndex: number) => void;
  /**
   * 줌 제스처 종료(핀치 릴리스 또는 더블탭) → 최종 줌 레벨. 항상 `[minZoom, maxZoom]` 안의 값이며,
   * 고무줄로 범위 밖에 있던 카메라 줌은 릴리스 트윈이 이 값으로 되돌린다.
   */
  onPinchRelease: (newZoom: number) => void;
}

export interface CameraControl {
  /** 지정 패널로 카메라 이동. animated=true면 easeOutCubic 트윈, false면 즉시. */
  animateToIndex(index: number, animated: boolean): void;
  /** 지정 줌으로 변경. animated=true면 트윈, false면 즉시. */
  animateToZoom(level: number, animated: boolean): void;
  /** 진행 중인 RAF 트윈을 즉시 취소 (카메라 위치는 그대로). */
  cancelAnimation(): void;
  /** 리스너/트윈/포인터 캡처 일괄 해제. */
  destroy(): void;
}

export function createCameraControl(opts: CameraControlOptions): CameraControl {
  const {
    root,
    camera,
    direction,
    positions,
    panelSizes,
    getRootSize,
    snapThreshold,
    resistance,
    minZoom,
    maxZoom,
    enablePinchZoom,
    doubleTapZoom = false,
    onChange,
    onPanRelease,
    onPinchRelease,
  } = opts;

  const axis: 'x' | 'y' = direction === 'horizontal' ? 'x' : 'y';
  const cross: 'x' | 'y' = axis === 'x' ? 'y' : 'x';

  // --- 포인터 추적 (root 좌상단 기준 좌표) ---
  const pointers = new Map<number, { x: number; y: number }>();
  // 제스처(첫 손가락 down)마다 한 번 읽는다 — move 마다 rect를 읽으면 레이아웃 강제.
  let rootOrigin = { x: 0, y: 0 };

  function toLocal(ev: PointerEvent): { x: number; y: number } {
    return { x: ev.clientX - rootOrigin.x, y: ev.clientY - rootOrigin.y };
  }

  type PanState = {
    cameraX: number;
    cameraY: number;
    pointerX: number;
    pointerY: number;
    pointerId: number;
    activeIndex: number;
    lastMoveTime: number;
    lastMoveInterval: number; // 직전 두 move 사이 간격(ms) — release 시 속도 계산의 분모
    lastDelta: number; // axis 방향, 카메라 단위
    lastDeltaCross: number; // 교차 축, 카메라 단위
  };
  let panStart: PanState | null = null;

  type PinchState = {
    distance: number;
    worldAnchor: { x: number; y: number };
    cameraX: number;
    cameraY: number;
    zoom: number;
  };
  let pinchStart: PinchState | null = null;

  type TweenState = {
    start: number;
    duration: number;
    fromX: number;
    fromY: number;
    fromZoom: number;
    toX: number;
    toY: number;
    toZoom: number;
  };
  let tween: TweenState | null = null;
  let rafId: number | null = null;
  /**
   * 카메라가 정착해야 할 줌 (항상 `[minZoom, maxZoom]` 안). 핀치 중 camera.zoom 은 고무줄로 범위 밖일 수 있고,
   * 줌 트윈이 탭으로 끊기면 camera.zoom 은 중간값에 멈춘다 — 릴리스와 더블탭 토글은 이 값을 기준으로 한다.
   */
  let targetZoom = clamp(camera.zoom, minZoom, maxZoom);

  // --- 탭 추적 (doubleTapZoom 이 숫자일 때만 기록) ---
  type TapRecord = { time: number; x: number; y: number };
  let pressStart: TapRecord | null = null; // 현재 한 손가락 눌림 (down 시각·위치)
  let lastTap: TapRecord | null = null; // 직전 완료된 탭 (up 시각, down 위치)

  // --- 리스너 일괄 등록/해제 ---
  const listeners: Array<() => void> = [];

  function addListener<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    handler: (ev: HTMLElementEventMap[K]) => void,
    listenerOptions?: AddEventListenerOptions,
  ): void {
    el.addEventListener(type, handler as EventListener, listenerOptions);
    listeners.push(() => el.removeEventListener(type, handler as EventListener, listenerOptions));
  }

  // --- 패널 크기 / 줌 반폭 ---
  function panelSizeAt(index: number): number {
    const explicit = panelSizes?.[index];
    if (explicit !== undefined && explicit > 0) return explicit;
    const size = getRootSize();
    return (axis === 'x' ? size.width : size.height) || 1;
  }

  function halfExtentAt(index: number, zoom: number): number {
    return zoomedHalfExtent(panelSizeAt(index), zoom);
  }

  /** 교차 축 패널 크기(px) — 패널은 교차 축으로 root를 꽉 채운다 (horizontal: 높이, vertical: 폭). */
  function crossSize(): number {
    const size = getRootSize();
    return (axis === 'x' ? size.height : size.width) || 1;
  }

  // --- 경계 계산 (축별) ---
  // zoom ≤ 1: [첫 패널 중심, 끝 패널 중심]. zoom > 1: 양 끝 패널의 줌 반폭만큼 바깥으로 넓혀
  // 줌 상태에서도 첫/끝 패널의 가장자리까지 카메라가 갈 수 있다.
  function panBoundsAlongAxis(zoom: number): { min: number; max: number } {
    const count = positions.length;
    if (count === 0) return { min: 0, max: 0 };
    // count === 0 가드로 첫/마지막 요소는 안전히 존재 — 단언 대신 옵셔널 체인 + ?? 0 으로 룰 회피.
    const first = positions[0]?.[axis] ?? 0;
    const last = positions[count - 1]?.[axis] ?? 0;
    const firstExtent = halfExtentAt(0, zoom);
    const lastExtent = halfExtentAt(count - 1, zoom);
    // X축은 인덱스가 커질수록 +, Y축은 − (패널이 아래로 쌓임) — 낮은 쪽/높은 쪽 끝에 각자의 반폭을 더한다.
    const firstIsLow = first <= last;
    return {
      min: (firstIsLow ? first : last) - (firstIsLow ? firstExtent : lastExtent),
      max: (firstIsLow ? last : first) + (firstIsLow ? lastExtent : firstExtent),
    };
  }

  /**
   * 교차 축 pan 경계 — 패널 중심(모든 패널이 같은 교차 축 좌표를 가진다)에서 교차 축 줌 반폭만큼.
   * zoom ≤ 1 이면 반폭 0 → `[중심, 중심]` (고정).
   */
  function crossBounds(zoom: number): { min: number; max: number } {
    const center = positions[currentActiveIndex()]?.[cross] ?? 0;
    const e = zoomedHalfExtent(crossSize(), zoom);
    return { min: center - e, max: center + e };
  }

  function currentActiveIndex(): number {
    return nearestPanelIndex(camera.position[axis], positions, axis);
  }

  /**
   * 주어진 줌에서 카메라가 머물 수 있는 위치 — 축은 가장 가까운 패널의 줌 범위 안으로, 교차 축은
   * 교차 축 범위 안으로 클램프. zoom ≤ 1 이면 두 반폭 모두 0 이라 패널 중심으로 끌어온다
   * (줌아웃 후 패널 사이에 걸치지 않게).
   */
  function clampIntoPanel(x: number, y: number, zoom: number): { x: number; y: number } {
    const i = currentActiveIndex();
    const center = positions[i];
    if (!center) return { x, y };
    const e = halfExtentAt(i, zoom);
    const cb = crossBounds(zoom);
    const pos = { x, y };
    const a = clamp(pos[axis], center[axis] - e, center[axis] + e);
    const c = clamp(pos[cross], cb.min, cb.max);
    return axis === 'x' ? { x: a, y: c } : { x: c, y: a };
  }

  // --- Pan ---
  function startPan(pointerId: number): void {
    const p = pointers.get(pointerId);
    if (!p) return;
    panStart = {
      cameraX: camera.position.x,
      cameraY: camera.position.y,
      pointerX: p.x,
      pointerY: p.y,
      pointerId,
      activeIndex: currentActiveIndex(),
      lastMoveTime: performance.now(),
      lastMoveInterval: 0,
      lastDelta: 0,
      lastDeltaCross: 0,
    };
  }

  function updatePan(): void {
    if (!panStart) return;
    const p = pointers.get(panStart.pointerId);
    if (!p) return;
    const dx = p.x - panStart.pointerX;
    const dy = p.y - panStart.pointerY;
    const z = camera.zoom;

    // 화면 드래그 → 카메라 이동 (월드 anchor: 손가락 아래 월드 점 고정)
    //   cameraX_new = cameraX_start - dx / zoom
    //   cameraY_new = cameraY_start + dy / zoom  (스크린 Y↓ vs 월드 Y↑ 부호 반전 포함)
    let targetX = panStart.cameraX - dx / z;
    let targetY = panStart.cameraY + dy / z;

    // 축: 엣지 저항 (줌 상태면 경계가 패널 가장자리까지 넓어진다)
    // 교차 축: zoom > 1 이면 패널의 교차 축 범위 안에서 pan (밖은 저항), zoom ≤ 1 이면 고정
    //   (대각 드래그가 축만 움직이는 페이저 계약 — 반폭 0 이면 경계가 한 점이라 잠근다)
    const bounds = panBoundsAlongAxis(z);
    const cb = crossBounds(z);
    const crossFree = cb.max > cb.min;
    if (axis === 'x') {
      targetX = applyResistance(targetX, bounds.min, bounds.max, resistance);
      targetY = crossFree ? applyResistance(targetY, cb.min, cb.max, resistance) : panStart.cameraY;
    } else {
      targetY = applyResistance(targetY, bounds.min, bounds.max, resistance);
      targetX = crossFree ? applyResistance(targetX, cb.min, cb.max, resistance) : panStart.cameraX;
    }

    // 속도 샘플 (release 시 사용)
    const now = performance.now();
    const prevValue = camera.position[axis];
    const prevCross = camera.position[cross];
    const newValue = axis === 'x' ? targetX : targetY;
    const newCross = axis === 'x' ? targetY : targetX;
    panStart.lastDelta = newValue - prevValue;
    panStart.lastDeltaCross = newCross - prevCross;
    panStart.lastMoveInterval = Math.max(1, now - panStart.lastMoveTime);
    panStart.lastMoveTime = now;

    camera.position.x = targetX;
    camera.position.y = targetY;
    onChange();
  }

  function endPan(): void {
    if (!panStart) return;
    const start = panStart;
    panStart = null;

    if (positions.length === 0) {
      onPanRelease(0);
      return;
    }

    // 정착 줌: 핀치 고무줄로 범위 밖에 남았거나 끊긴 줌 트윈의 중간값이면 릴리스 트윈이 함께 되돌린다.
    const settleZoom = targetZoom;

    // 줌 상태: 중심 복귀 대신 "그 자리 유지 / 가장자리 복귀 / gap 스냅" — 별도 경로
    if (settleZoom > 1) {
      releaseZoomed(start, settleZoom);
      return;
    }

    const size = getRootSize();
    const panelSize = (axis === 'x' ? size.width : size.height) || 1;

    const startValue = axis === 'x' ? start.cameraX : start.cameraY;
    const currentValue = camera.position[axis];
    let dragRatio = (currentValue - startValue) / panelSize;
    // Y축은 음수 방향이 forward(인덱스 증가)이므로 부호 반전
    if (axis === 'y') dragRatio = -dragRatio;

    // lastDelta는 "직전 move 한 번의 변위"이므로 분모도 move 간 간격이어야 한다.
    // release가 마지막 move 직후(1~5ms)에 오면 (now - lastMoveTime)만 쓰는 계산은
    // 속도를 수십 배 부풀려 마지막 순간의 미세 지터가 스냅 방향을 뒤집을 수 있다.
    // move 간격을 하한으로 삼고, release가 지연될수록 기존처럼 자연 감쇠시킨다.
    const sinceLastMove = performance.now() - start.lastMoveTime;
    const dt = Math.max(1, start.lastMoveInterval, sinceLastMove);
    let velocityRatio = (start.lastDelta / panelSize) * (VELOCITY_SAMPLE_WINDOW_MS / dt);
    if (axis === 'y') velocityRatio = -velocityRatio;

    const target = decideSnapTarget(
      start.activeIndex,
      dragRatio,
      velocityRatio,
      snapThreshold,
      positions.length,
    );
    // 트윈을 먼저 시작하고 콜백을 낸다 — 콜백 안에서 호출자가 scrollTo 등으로 덮어쓸 수 있게.
    // 트윈 시간은 손가락 속도에 이어지게 (빠른 플릭 → 짧고 단호하게, 느린 릴리스 → 길게).
    const targetPos = positions[target];
    if (targetPos) {
      const distance = targetPos[axis] - currentValue;
      const velocityAxisPerMs = start.lastDelta / dt;
      const velocityToward = distance === 0 ? 0 : velocityAxisPerMs * Math.sign(distance);
      const duration = snapDurationMs(
        distance,
        velocityToward,
        panelSize,
        SNAP_MIN_MS,
        SNAP_MAX_MS,
      );
      startTween(targetPos.x, targetPos.y, settleZoom, duration);
    }
    onPanRelease(target);
  }

  /**
   * zoom > 1 릴리스. 축 값을 "인덱스 증가 방향이 +"인 s 좌표로 바꿔 `resolveZoomedRelease`에 넘긴다.
   * (X축: s = x, Y축: s = −y — 패널이 아래(−y)로 쌓이므로 부호 반전)
   * `zoom`은 정착 줌(`targetZoom`) — 고무줄·끊긴 트윈으로 camera.zoom 과 다를 수 있고, 그러면 트윈이 함께 되돌린다.
   */
  function releaseZoomed(start: PanState, zoom: number): void {
    const sign = axis === 'x' ? 1 : -1;
    const centers = positions.map((p) => sign * p[axis]);
    const halfExtents = positions.map((_, i) => halfExtentAt(i, zoom));
    const s = sign * camera.position[axis];
    const sStart = sign * (axis === 'x' ? start.cameraX : start.cameraY);

    // endPan(zoom ≤ 1)과 같은 dt 하한 — 릴리스 직전 미세 지터가 속도를 부풀리지 않게
    const sinceLastMove = performance.now() - start.lastMoveTime;
    const dt = Math.max(1, start.lastMoveInterval, sinceLastMove);
    const velocityPerMs = (sign * start.lastDelta) / dt;

    // 놓은 위치가 어떤 패널의 범위 안인가? 안이면 관성으로 그 패널 가장자리까지만 감속해 멈춘다
    // (관성만으로 다음 패널로 넘어가지 않음 — iOS 사진 뷰어와 같음).
    // 밖(gap·저항 구간)이면 방향·속도로 스냅을 정한다.
    const lo = (i: number): number => (centers[i] ?? 0) - (halfExtents[i] ?? 0);
    const hi = (i: number): number => (centers[i] ?? 0) + (halfExtents[i] ?? 0);
    let inside = -1;
    for (let i = 0; i < centers.length; i++) {
      if (s >= lo(i) && s <= hi(i)) {
        inside = i;
        break;
      }
    }
    let index: number;
    let target: number;
    let maxMs: number;
    if (inside >= 0) {
      index = inside;
      target = clamp(projectInertia(s, velocityPerMs), lo(inside), hi(inside));
      maxMs = ZOOMED_PAN_MAX_MS;
    } else {
      const velocityWindow = velocityPerMs * VELOCITY_SAMPLE_WINDOW_MS;
      ({ index, target } = resolveZoomedRelease(
        s,
        sStart,
        velocityWindow,
        centers,
        halfExtents,
        snapThreshold,
      ));
      maxMs = SNAP_MAX_MS;
    }
    const targetAxisValue = sign * target;
    const distance = targetAxisValue - camera.position[axis];
    const velocityAxisPerMs = start.lastDelta / dt;

    // 교차 축: 관성 투영을 패널의 교차 축 범위 안으로 잘라 감속 (저항 구간에서 놓았으면 가장자리 복귀)
    const cb = crossBounds(zoom);
    const crossNow = camera.position[cross];
    const velocityCrossPerMs = start.lastDeltaCross / dt;
    const crossTarget = clamp(projectInertia(crossNow, velocityCrossPerMs), cb.min, cb.max);
    const crossDistance = crossTarget - crossNow;

    // 두 축이 한 트윈으로 움직인다 — 어느 축도 잘리지 않게 긴 쪽 시간을 쓴다. 줌 복귀만 있으면 고정 300ms.
    let duration = 0;
    if (Math.abs(distance) > 1e-6) {
      duration = Math.max(
        duration,
        snapDurationMs(
          distance,
          velocityAxisPerMs * Math.sign(distance),
          panelSizeAt(index),
          SNAP_MIN_MS,
          maxMs,
        ),
      );
    }
    if (Math.abs(crossDistance) > 1e-6) {
      duration = Math.max(
        duration,
        snapDurationMs(
          crossDistance,
          velocityCrossPerMs * Math.sign(crossDistance),
          crossSize(),
          SNAP_MIN_MS,
          ZOOMED_PAN_MAX_MS,
        ),
      );
    }
    if (duration > 0 || zoom !== camera.zoom) {
      startTween(
        axis === 'x' ? targetAxisValue : crossTarget,
        axis === 'y' ? targetAxisValue : crossTarget,
        zoom,
        duration > 0 ? duration : TWEEN_DURATION_MS,
      );
    }
    onPanRelease(index);
  }

  /**
   * 브라우저가 터치를 가져가면(pointercancel — 예: `pan-y` 패널에서 세로 스크롤이 시작될 때) 우리 제스처는
   * 취소다. 취소 전까지 적용된 이동을 되돌려 시작 위치로 짧게 트윈한다 — 되돌리지 않으면 네이티브 스크롤과
   * 카메라 이동이 겹쳐 콘텐츠가 두 번 움직인다 (줌 상태 교차 축 pan에서 특히 눈에 띈다). 인덱스는 그대로.
   */
  function cancelPan(): void {
    if (!panStart) return;
    const start = panStart;
    panStart = null;
    // 시작 위치가 끊긴 복귀 트윈의 중간(범위 밖)일 수 있으므로 패널 범위 안으로
    const { x, y } = clampIntoPanel(start.cameraX, start.cameraY, targetZoom);
    const d = Math.hypot(x - camera.position.x, y - camera.position.y);
    if (d > 1e-6 || targetZoom !== camera.zoom) {
      const duration = snapDurationMs(
        d,
        0,
        panelSizeAt(start.activeIndex),
        SNAP_MIN_MS,
        SNAP_MAX_MS,
      );
      startTween(x, y, targetZoom, duration);
    }
    onPanRelease(start.activeIndex);
  }

  // --- Pinch (enablePinchZoom=false면 startPinch 호출 안 됨) ---
  function startPinch(): void {
    const ids = Array.from(pointers.keys());
    const [id0, id1] = ids;
    if (id0 === undefined || id1 === undefined) return;
    const a = pointers.get(id0);
    const b = pointers.get(id1);
    if (!a || !b) return;
    const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const { width, height } = getRootSize();
    const worldAnchor = screenPointToWorld(
      midpoint.x,
      midpoint.y,
      camera.position.x,
      camera.position.y,
      camera.zoom,
      width,
      height,
    );
    pinchStart = {
      distance,
      worldAnchor,
      cameraX: camera.position.x,
      cameraY: camera.position.y,
      zoom: camera.zoom,
    };
  }

  function updatePinch(): void {
    if (!pinchStart) return;
    const ids = Array.from(pointers.keys());
    const [id0, id1] = ids;
    if (id0 === undefined || id1 === undefined) return;
    const a = pointers.get(id0);
    const b = pointers.get(id1);
    if (!a || !b) return;
    const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const zoomFactor = distance / pinchStart.distance;
    // min/max 밖은 고무줄 — 릴리스 트윈이 경계로 되돌린다 (resistance 0 이면 하드 클램프)
    const newZoom = applyZoomResistance(pinchStart.zoom * zoomFactor, minZoom, maxZoom, resistance);

    // 손가락 중점 아래 월드 점이 그대로 머물도록 카메라 위치 보정
    //   newCameraX = worldAnchor.x - (midpoint.x - rootW/2) / newZoom
    //   newCameraY = worldAnchor.y + (midpoint.y - rootH/2) / newZoom
    const { width, height } = getRootSize();
    let newCameraX = pinchStart.worldAnchor.x - (midpoint.x - width / 2) / newZoom;
    let newCameraY = pinchStart.worldAnchor.y + (midpoint.y - height / 2) / newZoom;

    // 축 방향 성분에는 1손가락 pan과 동일하게 엣지 저항 적용 — 없으면 간격을 유지한
    // 두 손가락 이동(two-finger pan)으로 카메라가 무제한 이탈해 콘텐츠가 화면 밖으로 사라진다.
    // 경계는 새 줌 기준 (줌인할수록 가장자리까지 갈 수 있는 여유가 커진다).
    // 교차 축은 새 줌의 반폭 안으로 하드 클램프 — 줌아웃으로 반폭이 0에 가까워질 때 중심으로 연속 수렴하고,
    // zoom ≤ 1 이면 반폭 0 이라 정확히 중심에 놓인다.
    const bounds = panBoundsAlongAxis(newZoom);
    const cb = crossBounds(newZoom);
    if (axis === 'x') {
      newCameraX = applyResistance(newCameraX, bounds.min, bounds.max, resistance);
      newCameraY = clamp(newCameraY, cb.min, cb.max);
    } else {
      newCameraY = applyResistance(newCameraY, bounds.min, bounds.max, resistance);
      newCameraX = clamp(newCameraX, cb.min, cb.max);
    }

    camera.position.x = newCameraX;
    camera.position.y = newCameraY;
    camera.zoom = newZoom;
    onChange();
  }

  function endPinch(): void {
    if (!pinchStart) return;
    // 고무줄로 범위 밖이면 경계 값을 보고한다 — 실제 복귀 트윈은 마지막 손가락의 릴리스(endPan)가 시작.
    const finalZoom = clamp(camera.zoom, minZoom, maxZoom);
    targetZoom = finalZoom;
    pinchStart = null;
    onPinchRelease(finalZoom);
  }

  // --- 더블탭 줌 토글 ---
  /**
   * up 시점 탭 판정. 탭이면 기록하고, 직전 탭과 이어지는 더블탭이면 true (기록 초기화).
   * 탭이 아니면(길게 누름·이동) 직전 탭 기록도 지운다.
   */
  function consumeTap(p: { x: number; y: number }): boolean {
    const press = pressStart;
    pressStart = null;
    if (!press) return false;
    const now = performance.now();
    const isTap =
      now - press.time <= TAP_MAX_MS && Math.hypot(p.x - press.x, p.y - press.y) <= TAP_SLOP_PX;
    if (!isTap) {
      lastTap = null;
      return false;
    }
    const prev = lastTap;
    if (
      prev &&
      press.time - prev.time <= DOUBLE_TAP_MS &&
      Math.hypot(press.x - prev.x, press.y - prev.y) <= DOUBLE_TAP_DIST_PX
    ) {
      lastTap = null;
      return true;
    }
    lastTap = { time: now, x: press.x, y: press.y };
    return false;
  }

  /**
   * 줌 상태면 `minZoom`으로(패널 범위 안 → zoom ≤ 1 이면 중심), 아니면 탭한 지점을 고정한 채
   * `doubleTapZoom`까지 확대. 둘 다 고정 300ms 트윈 + `onPinchRelease(목표 줌)`.
   */
  function toggleDoubleTapZoom(sx: number, sy: number): void {
    if (doubleTapZoom === false || positions.length === 0) return;
    // 판정은 정착 줌 기준 — 줌인 트윈이 첫 탭에 끊겨 camera.zoom 이 중간값이어도 토글이 뒤집히지 않게
    if (targetZoom > minZoom + 1e-6) {
      const { x, y } = clampIntoPanel(camera.position.x, camera.position.y, minZoom);
      startTween(x, y, minZoom);
      onPinchRelease(minZoom);
      return;
    }
    const z = clamp(doubleTapZoom, minZoom, maxZoom);
    const { width, height } = getRootSize();
    const world = screenPointToWorld(
      sx,
      sy,
      camera.position.x,
      camera.position.y,
      camera.zoom,
      width,
      height,
    );
    const anchored = cameraPosForAnchor(world.x, world.y, sx, sy, z, width, height);
    const { x, y } = clampIntoPanel(anchored.x, anchored.y, z);
    startTween(x, y, z);
    onPinchRelease(z);
  }

  // --- 포인터 이벤트 핸들러 ---
  // m-5: 캡처된 pointerId를 추적해 destroy 시점에 남은 캡처를 일괄 release.
  const capturedPointerIds = new Set<number>();

  function onPointerDown(ev: PointerEvent): void {
    // 사용자 입력 시작 → 진행 중 트윈 취소
    cancelAnimationInternal();
    if (pointers.size === 0) {
      const rect = root.getBoundingClientRect();
      rootOrigin = { x: rect.left, y: rect.top };
    }
    const p = toLocal(ev);
    pointers.set(ev.pointerId, p);
    try {
      root.setPointerCapture(ev.pointerId);
      capturedPointerIds.add(ev.pointerId);
    } catch {
      // happy-dom 등 일부 환경은 setPointerCapture 미지원 — 무시
    }
    if (pointers.size === 1) {
      startPan(ev.pointerId);
      pressStart = doubleTapZoom !== false ? { time: performance.now(), x: p.x, y: p.y } : null;
    } else {
      // 두 손가락 이상은 탭이 아니다
      pressStart = null;
      if (pointers.size === 2 && enablePinchZoom) {
        panStart = null;
        startPinch();
      }
      // enablePinchZoom=false에서 두 번째 포인터는 무시 (헷갈리지 않게)
    }
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, toLocal(ev));
    if (pinchStart) {
      updatePinch();
    } else if (panStart) {
      updatePan();
    }
  }

  function onPointerEnd(ev: PointerEvent): void {
    if (!pointers.has(ev.pointerId)) return;
    const p = toLocal(ev);
    pointers.delete(ev.pointerId);
    try {
      root.releasePointerCapture(ev.pointerId);
    } catch {
      // 캡처되지 않았던 경우 등 — 무시
    }
    capturedPointerIds.delete(ev.pointerId);
    if (pinchStart) {
      endPinch();
      // 남은 손가락 수에 따라 제스처 승계 — 2개 이상이면 pinch 재시작
      // (3+ 손가락에서 하나만 떼어도 제스처가 죽어 카메라가 스냅 없이 방치되는 것 방지),
      // 1개면 pan으로 복귀.
      if (pointers.size >= 2) {
        startPinch();
      } else if (pointers.size === 1) {
        const remainingId = pointers.keys().next().value as number | undefined;
        if (remainingId !== undefined) startPan(remainingId);
      }
    } else if (panStart) {
      if (pointers.size === 0) {
        if (ev.type === 'pointercancel') {
          // 브라우저가 가져간 터치 — 이동을 되돌린다. 탭 기록도 지운다.
          pressStart = null;
          lastTap = null;
          cancelPan();
        } else if (ev.type === 'pointerup' && consumeTap(p)) {
          panStart = null;
          toggleDoubleTapZoom(p.x, p.y);
        } else {
          // pointerleave(마우스가 root 밖으로) 는 탭이 아니지만 릴리스로 본다
          pressStart = null;
          endPan();
        }
      }
    }
  }

  addListener(root, 'pointerdown', onPointerDown);
  addListener(root, 'pointermove', onPointerMove);
  addListener(root, 'pointerup', onPointerEnd);
  addListener(root, 'pointercancel', onPointerEnd);
  addListener(root, 'pointerleave', onPointerEnd);

  // --- 트윈 ---
  function cancelAnimationInternal(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    tween = null;
  }

  function startTween(
    toX: number,
    toY: number,
    toZoom: number,
    durationMs = TWEEN_DURATION_MS,
  ): void {
    cancelAnimationInternal();
    targetZoom = toZoom;
    tween = {
      start: performance.now(),
      duration: Math.max(1, durationMs),
      fromX: camera.position.x,
      fromY: camera.position.y,
      fromZoom: camera.zoom,
      toX,
      toY,
      toZoom,
    };
    rafId = requestAnimationFrame(stepTween);
  }

  function stepTween(): void {
    if (!tween) return;
    const now = performance.now();
    const t = Math.min(1, (now - tween.start) / tween.duration);
    const k = easeOutCubic(t);
    camera.position.x = tween.fromX + (tween.toX - tween.fromX) * k;
    camera.position.y = tween.fromY + (tween.toY - tween.fromY) * k;
    if (tween.fromZoom !== tween.toZoom) {
      camera.zoom = tween.fromZoom + (tween.toZoom - tween.fromZoom) * k;
    }
    onChange();
    if (t < 1) {
      rafId = requestAnimationFrame(stepTween);
    } else {
      tween = null;
      rafId = null;
    }
  }

  // --- 명령형 API ---
  function animateToIndex(index: number, animated: boolean): void {
    if (positions.length === 0) return;
    const i = clamp(index, 0, positions.length - 1);
    const target = positions[i];
    if (!target) return;
    if (!animated) {
      cancelAnimationInternal();
      camera.position.x = target.x;
      camera.position.y = target.y;
      onChange();
      return;
    }
    // 줌 트윈 도중 호출돼도 중간 줌에 머물지 않도록 정착 줌으로
    startTween(target.x, target.y, targetZoom);
  }

  function animateToZoom(level: number, animated: boolean): void {
    const z = clamp(level, minZoom, maxZoom);
    // 새 줌 기준 패널 범위 밖이면 가장자리로, zoom ≤ 1 이면 반폭이 0 이라 패널 중심으로 (양 축)
    const { x, y } = clampIntoPanel(camera.position.x, camera.position.y, z);
    if (!animated) {
      cancelAnimationInternal();
      targetZoom = z;
      camera.position.x = x;
      camera.position.y = y;
      camera.zoom = z;
      onChange();
      return;
    }
    startTween(x, y, z);
  }

  function destroy(): void {
    cancelAnimationInternal();
    // m-5: 진행 중 제스처 중간에 destroy되면 setPointerCapture가 누수 — 남은 모든 캡처를 명시 release.
    for (const pid of capturedPointerIds) {
      try {
        root.releasePointerCapture(pid);
      } catch {
        // 이미 해제됐거나 미지원 환경 — 무시
      }
    }
    capturedPointerIds.clear();
    for (const off of listeners) off();
    listeners.length = 0;
    pointers.clear();
    panStart = null;
    pinchStart = null;
    pressStart = null;
    lastTap = null;
  }

  return {
    animateToIndex,
    animateToZoom,
    cancelAnimation: cancelAnimationInternal,
    destroy,
  };
}
