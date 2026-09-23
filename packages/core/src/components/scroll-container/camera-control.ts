import type { PanCamera } from './camera';
import {
  applyResistance,
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
 *  - 1 pointer: axis-constrained pan + 엣지 저항
 *  - 2 pointer: 핀치 줌 + 줌 중심점 anchor (enablePinchZoom=true 일 때만)
 *  - 1 pointer 해제 → 스냅 결정 → 릴리스 트윈 시작 → onPanRelease (트윈은 컨트롤이 직접 소유)
 *  - 명령형 animateToIndex/animateToZoom: easeOutCubic RAF 트윈(고정 300ms), 진행 중이면 cancel 후 재시작
 *
 * 관성(릴리스 속도 반영):
 *  - 릴리스 트윈 시간은 `snapDurationMs`로 손가락 속도에 이어지게 정한다 — 빠른 플릭 120ms까지,
 *    느린 릴리스 최대 400ms(줌 상태 자유 pan은 800ms). 프로그램 호출(scrollTo/zoomTo)은 고정 300ms.
 *  - 페이저(zoom ≤ 1)는 네이티브 페이저처럼 한 제스처에 최대 한 패널만 넘긴다 (`decideSnapTarget`).
 *  - 줌 상태 pan: 놓은 위치가 패널 범위 안이면 `projectInertia`(iOS 감속 0.998/ms)로 멈출 위치를 구해
 *    그 패널의 가장자리 안에서 멈춘다 — 관성만으로는 다음 패널로 넘어가지 않는다 (iOS 사진 뷰어와 같음).
 *    놓은 위치가 이미 가장자리 밖(gap·저항 구간)이면 `resolveZoomedRelease`가 방향·속도로 스냅을 정한다.
 *
 * 줌 상태(zoom > 1)의 pan:
 *  - pan 경계가 첫/끝 패널의 줌 반폭(`zoomedHalfExtent`)만큼 바깥으로 넓어져 패널 가장자리까지 볼 수 있다.
 *  - 릴리스 시 패널 중심으로 되돌리지 않는다. 패널 범위 안이면 그 자리에 머물고, 패널 사이 gap이면
 *    `resolveZoomedRelease`가 진행 방향·속도로 앞/뒤 패널의 가까운 가장자리를 고른다.
 *  - zoom ≤ 1 이면 기존 계약(패널 중심 스냅, `decideSnapTarget`) 그대로.
 */

const TWEEN_DURATION_MS = 300;
const VELOCITY_SAMPLE_WINDOW_MS = 100;
/** 릴리스 스냅 트윈 시간 범위 — 페이저 스냅 */
const SNAP_MIN_MS = 120;
const SNAP_MAX_MS = 400;
/** 줌 상태 자유 pan 감속의 상한 (한 패널 안에서 멀리 흘러갈 수 있으므로 더 길게) */
const ZOOMED_PAN_MAX_MS = 800;

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
  /** 카메라가 변경됨. 호출자는 requestRender 수행. */
  onChange: () => void;
  /**
   * Pan 제스처 종료 → 스냅 결정된 패널 인덱스. 카메라 복귀/스냅 트윈은 이 콜백 직전에 컨트롤이
   * 이미 시작했으므로 호출자는 상태(활성 인덱스·가상화)만 갱신하면 된다.
   */
  onPanRelease: (targetIndex: number) => void;
  /** Pinch 제스처 종료 → 최종 줌 레벨. */
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
    onChange,
    onPanRelease,
    onPinchRelease,
  } = opts;

  const axis: 'x' | 'y' = direction === 'horizontal' ? 'x' : 'y';

  // --- 포인터 추적 ---
  const pointers = new Map<number, { x: number; y: number }>();

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

  function currentActiveIndex(): number {
    return nearestPanelIndex(camera.position[axis], positions, axis);
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

    // 축 제약
    if (axis === 'x') targetY = panStart.cameraY;
    else targetX = panStart.cameraX;

    // 엣지 저항 (줌 상태면 경계가 패널 가장자리까지 넓어진다)
    const bounds = panBoundsAlongAxis(z);
    if (axis === 'x') {
      targetX = applyResistance(targetX, bounds.min, bounds.max, resistance);
    } else {
      targetY = applyResistance(targetY, bounds.min, bounds.max, resistance);
    }

    // 속도 샘플 (release 시 사용)
    const now = performance.now();
    const prevValue = camera.position[axis];
    const newValue = axis === 'x' ? targetX : targetY;
    panStart.lastDelta = newValue - prevValue;
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

    // 줌 상태: 중심 복귀 대신 "그 자리 유지 / 가장자리 복귀 / gap 스냅" — 별도 경로
    if (camera.zoom > 1) {
      releaseZoomed(start, camera.zoom);
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
      startTween(targetPos.x, targetPos.y, camera.zoom, duration);
    }
    onPanRelease(target);
  }

  /**
   * zoom > 1 릴리스. 축 값을 "인덱스 증가 방향이 +"인 s 좌표로 바꿔 `resolveZoomedRelease`에 넘긴다.
   * (X축: s = x, Y축: s = −y — 패널이 아래(−y)로 쌓이므로 부호 반전)
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
    if (Math.abs(distance) > 1e-6) {
      const velocityAxisPerMs = start.lastDelta / dt;
      const velocityToward = velocityAxisPerMs * Math.sign(distance);
      const duration = snapDurationMs(
        distance,
        velocityToward,
        panelSizeAt(index),
        SNAP_MIN_MS,
        maxMs,
      );
      startTween(
        axis === 'x' ? targetAxisValue : camera.position.x,
        axis === 'y' ? targetAxisValue : camera.position.y,
        zoom,
        duration,
      );
    }
    onPanRelease(index);
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
    const newZoom = clamp(pinchStart.zoom * zoomFactor, minZoom, maxZoom);

    // 손가락 중점 아래 월드 점이 그대로 머물도록 카메라 위치 보정
    //   newCameraX = worldAnchor.x - (midpoint.x - rootW/2) / newZoom
    //   newCameraY = worldAnchor.y + (midpoint.y - rootH/2) / newZoom
    const { width, height } = getRootSize();
    let newCameraX = pinchStart.worldAnchor.x - (midpoint.x - width / 2) / newZoom;
    let newCameraY = pinchStart.worldAnchor.y + (midpoint.y - height / 2) / newZoom;

    // 축 제약: pan 성분은 축 위에만, 줌은 항상 적용.
    // 축 방향 성분에는 1손가락 pan과 동일하게 엣지 저항 적용 — 없으면 간격을 유지한
    // 두 손가락 이동(two-finger pan)으로 카메라가 무제한 이탈해 콘텐츠가 화면 밖으로 사라진다.
    // 경계는 새 줌 기준 (줌인할수록 가장자리까지 갈 수 있는 여유가 커진다).
    const bounds = panBoundsAlongAxis(newZoom);
    if (axis === 'x') {
      newCameraX = applyResistance(newCameraX, bounds.min, bounds.max, resistance);
      newCameraY = pinchStart.cameraY;
    } else {
      newCameraY = applyResistance(newCameraY, bounds.min, bounds.max, resistance);
      newCameraX = pinchStart.cameraX;
    }

    camera.position.x = newCameraX;
    camera.position.y = newCameraY;
    camera.zoom = newZoom;
    onChange();
  }

  function endPinch(): void {
    if (!pinchStart) return;
    const finalZoom = camera.zoom;
    pinchStart = null;
    onPinchRelease(finalZoom);
  }

  // --- 포인터 이벤트 핸들러 ---
  // m-5: 캡처된 pointerId를 추적해 destroy 시점에 남은 캡처를 일괄 release.
  const capturedPointerIds = new Set<number>();

  function onPointerDown(ev: PointerEvent): void {
    // 사용자 입력 시작 → 진행 중 트윈 취소
    cancelAnimationInternal();
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try {
      root.setPointerCapture(ev.pointerId);
      capturedPointerIds.add(ev.pointerId);
    } catch {
      // happy-dom 등 일부 환경은 setPointerCapture 미지원 — 무시
    }
    if (pointers.size === 1) {
      startPan(ev.pointerId);
    } else if (pointers.size === 2 && enablePinchZoom) {
      panStart = null;
      startPinch();
    }
    // enablePinchZoom=false에서 두 번째 포인터는 무시 (헷갈리지 않게)
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinchStart) {
      updatePinch();
    } else if (panStart) {
      updatePan();
    }
  }

  function onPointerEnd(ev: PointerEvent): void {
    if (!pointers.has(ev.pointerId)) return;
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
      if (pointers.size === 0) endPan();
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
    startTween(target.x, target.y, camera.zoom);
  }

  /**
   * 줌 변경 시 카메라가 머물 위치. 현재 가장 가까운 패널의 새 줌 기준 범위 밖이면 가장자리로,
   * zoom ≤ 1 이면 반폭이 0이라 패널 중심으로 끌어온다 (줌아웃 후 패널 사이에 걸치지 않게).
   */
  function positionWithinPanelForZoom(zoom: number): { x: number; y: number } {
    const i = currentActiveIndex();
    const center = positions[i];
    if (!center) return { x: camera.position.x, y: camera.position.y };
    const e = halfExtentAt(i, zoom);
    const v = clamp(camera.position[axis], center[axis] - e, center[axis] + e);
    return axis === 'x' ? { x: v, y: camera.position.y } : { x: camera.position.x, y: v };
  }

  function animateToZoom(level: number, animated: boolean): void {
    const z = clamp(level, minZoom, maxZoom);
    const { x, y } = positionWithinPanelForZoom(z);
    if (!animated) {
      cancelAnimationInternal();
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
  }

  return {
    animateToIndex,
    animateToZoom,
    cancelAnimation: cancelAnimationInternal,
    destroy,
  };
}
