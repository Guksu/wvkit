import type * as THREE from 'three';
import {
  applyResistance,
  clamp,
  decideSnapTarget,
  easeOutCubic,
  nearestPanelIndex,
  screenPointToWorld,
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
 *  - 1 pointer 해제 → 스냅 결정 → onPanRelease
 *  - 명령형 animateToIndex/animateToZoom: easeOutCubic RAF 트윈, 진행 중이면 cancel 후 재시작
 */

const TWEEN_DURATION_MS = 300;
const VELOCITY_SAMPLE_WINDOW_MS = 100;

export interface CameraControlOptions {
  root: HTMLElement;
  camera: THREE.OrthographicCamera;
  /** 'both' → 'horizontal' 폴백이 이미 적용된 축. */
  direction: 'horizontal' | 'vertical';
  positions: ReadonlyArray<{ x: number; y: number }>;
  /** 현재 카메라 frustum 크기 (root client size). 리사이즈 후 변할 수 있음. */
  getRootSize: () => { width: number; height: number };
  snapThreshold: number;
  resistance: number;
  minZoom: number;
  maxZoom: number;
  enablePinchZoom: boolean;
  /** 카메라가 변경됨. 호출자는 requestRender 수행. */
  onChange: () => void;
  /** Pan 제스처 종료 → 스냅 결정된 패널 인덱스. */
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

  // --- 경계 계산 (축별) ---
  function panBoundsAlongAxis(): { min: number; max: number } {
    if (positions.length === 0) return { min: 0, max: 0 };
    // positions.length === 0 가드로 첫/마지막 요소는 안전히 존재 — 단언 대신 옵셔널 체인 + ?? 0 으로 룰 회피.
    const first = positions[0]?.[axis] ?? 0;
    const last = positions[positions.length - 1]?.[axis] ?? 0;
    return { min: Math.min(first, last), max: Math.max(first, last) };
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

    // 엣지 저항
    const bounds = panBoundsAlongAxis();
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
    onPanRelease(target);
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

    // 축 제약: pan 성분은 축 위에만, 줌은 항상 적용
    if (axis === 'x') newCameraY = pinchStart.cameraY;
    else newCameraX = pinchStart.cameraX;

    camera.position.x = newCameraX;
    camera.position.y = newCameraY;
    camera.zoom = newZoom;
    camera.updateProjectionMatrix();
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
      // 한 손가락이 남았으면 pan으로 복귀
      if (pointers.size === 1) {
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

  function startTween(toX: number, toY: number, toZoom: number): void {
    cancelAnimationInternal();
    tween = {
      start: performance.now(),
      duration: TWEEN_DURATION_MS,
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
      camera.updateProjectionMatrix();
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

  function animateToZoom(level: number, animated: boolean): void {
    const z = clamp(level, minZoom, maxZoom);
    if (!animated) {
      cancelAnimationInternal();
      camera.zoom = z;
      camera.updateProjectionMatrix();
      onChange();
      return;
    }
    startTween(camera.position.x, camera.position.y, z);
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
