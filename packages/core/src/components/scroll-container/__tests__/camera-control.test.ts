import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl 단위 테스트.
 *
 * 명령형 API(animateToIndex/Zoom)는 happy-dom에서 그대로 검증.
 * PointerEvent 기반 제스처(pan/snap/핀치)는 happy-dom의 한계로 일부 케이스만 검증하고
 * 나머지는 통합 테스트(#8)에 위임. happy-dom v15는 PointerEvent를 기본 지원함.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

function makeCamera(width = 400, height = 600): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    2000,
  );
  cam.position.set(0, 0, 1000);
  return cam;
}

const HORIZONTAL_POSITIONS = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 800, y: 0 },
  { x: 1200, y: 0 },
];

const VERTICAL_POSITIONS = [
  { x: 0, y: -300 },
  { x: 0, y: -900 },
  { x: 0, y: -1500 },
  { x: 0, y: -2100 },
];

describe('createCameraControl — animateToIndex (animated=false)', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;
  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
  });
  afterEach(() => {
    root.remove();
  });

  it('horizontal direction: animateToIndex moves camera.position.x only (axis constraint)', () => {
    const onChange = vi.fn();
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange,
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.animateToIndex(2, false);
    expect(camera.position.x).toBe(800);
    expect(camera.position.y).toBe(0);
    expect(onChange).toHaveBeenCalled();
    control.destroy();
  });

  it('vertical direction: animateToIndex moves camera.position.y only (axis constraint)', () => {
    const control = createCameraControl({
      root,
      camera,
      direction: 'vertical',
      positions: VERTICAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.animateToIndex(2, false);
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(-1500);
    control.destroy();
  });

  it('clamps out-of-range index', () => {
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.animateToIndex(99, false);
    expect(camera.position.x).toBe(1200); // last index = 3 → x=1200
    control.animateToIndex(-5, false);
    expect(camera.position.x).toBe(0);
    control.destroy();
  });

  it('no-op when positions array is empty', () => {
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: [],
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    const beforeX = camera.position.x;
    expect(() => control.animateToIndex(0, false)).not.toThrow();
    expect(camera.position.x).toBe(beforeX);
    control.destroy();
  });
});

describe('createCameraControl — animateToZoom (animated=false)', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;
  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
  });
  afterEach(() => {
    root.remove();
  });

  function makeControl(extra: Partial<Parameters<typeof createCameraControl>[0]> = {}) {
    return createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
      ...extra,
    });
  }

  it('clamps to maxZoom and calls updateProjectionMatrix', () => {
    const updateSpy = vi.spyOn(camera, 'updateProjectionMatrix');
    const control = makeControl();
    control.animateToZoom(10, false);
    expect(camera.zoom).toBe(3);
    expect(updateSpy).toHaveBeenCalled();
    control.destroy();
  });

  it('clamps to minZoom', () => {
    const control = makeControl();
    control.animateToZoom(0.1, false);
    expect(camera.zoom).toBe(1);
    control.destroy();
  });

  it('fires onChange callback', () => {
    const onChange = vi.fn();
    const control = makeControl({ onChange });
    control.animateToZoom(2, false);
    expect(onChange).toHaveBeenCalled();
    control.destroy();
  });
});

describe('createCameraControl — destroy + listener cleanup', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;
  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
  });
  afterEach(() => {
    root.remove();
  });

  it('removes all pointer listeners on destroy', () => {
    const removeSpy = vi.spyOn(root, 'removeEventListener');
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.destroy();
    // pointerdown / move / up / cancel / leave 5종 모두 해제되어야 함
    const types = removeSpy.mock.calls.map((c) => c[0] as string);
    expect(types).toContain('pointerdown');
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    expect(types).toContain('pointercancel');
    expect(types).toContain('pointerleave');
  });

  it('cancelAnimation is callable when no tween is running (no-op)', () => {
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    const xBefore = camera.position.x;
    const yBefore = camera.position.y;
    expect(() => control.cancelAnimation()).not.toThrow();
    // 트윈이 없을 때 cancelAnimation은 카메라를 건드리지 않는다 (B-22)
    expect(camera.position.x).toBe(xBefore);
    expect(camera.position.y).toBe(yBefore);
    control.destroy();
  });

  it('destroy is idempotent', () => {
    const removeSpy = vi.spyOn(root, 'removeEventListener');
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange: vi.fn(),
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.destroy();
    const removeCallsAfterFirstDestroy = removeSpy.mock.calls.length;
    const xAfterFirstDestroy = camera.position.x;
    const yAfterFirstDestroy = camera.position.y;
    expect(() => control.destroy()).not.toThrow();
    // 2차 destroy는 리스너 재해제·카메라 변형 없이 완전 no-op (B-22)
    expect(removeSpy.mock.calls.length).toBe(removeCallsAfterFirstDestroy);
    expect(camera.position.x).toBe(xAfterFirstDestroy);
    expect(camera.position.y).toBe(yAfterFirstDestroy);
  });
});

describe('createCameraControl — enablePinchZoom flag', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;
  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
  });
  afterEach(() => {
    root.remove();
  });

  // happy-dom v15는 PointerEvent 클래스를 지원함. setPointerCapture는 try/catch로 가드됨.
  function pointerEvent(type: string, init: { pointerId: number; clientX: number; clientY: number }): Event {
    try {
      return new PointerEvent(type, { ...init, bubbles: true });
    } catch {
      // 폴백: Event + 속성 부여
      const ev = new Event(type, { bubbles: true });
      Object.assign(ev, init);
      return ev;
    }
  }

  it('enablePinchZoom=false: two-pointer gesture does not change camera.zoom', () => {
    const onChange = vi.fn();
    const onPinchRelease = vi.fn();
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: false,
      onChange,
      onPanRelease: vi.fn(),
      onPinchRelease,
    });

    const initialZoom = camera.zoom;
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 300, clientY: 300 }));
    // Move pointers apart — should NOT trigger pinch update because enablePinchZoom is false
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 350, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 50, clientY: 300 }));
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 350, clientY: 300 }));

    expect(camera.zoom).toBe(initialZoom);
    expect(onPinchRelease).not.toHaveBeenCalled();
    control.destroy();
  });
});

describe('createCameraControl — onChange is fired on camera mutation', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;
  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
  });
  afterEach(() => {
    root.remove();
  });

  it('animateToIndex (animated=false) fires onChange once', () => {
    const onChange = vi.fn();
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange,
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.animateToIndex(1, false);
    expect(onChange).toHaveBeenCalledTimes(1);
    control.destroy();
  });

  it('animateToZoom (animated=false) fires onChange once', () => {
    const onChange = vi.fn();
    const control = createCameraControl({
      root,
      camera,
      direction: 'horizontal',
      positions: HORIZONTAL_POSITIONS,
      getRootSize: () => ({ width: 400, height: 600 }),
      snapThreshold: 0.3,
      resistance: 0.2,
      minZoom: 1,
      maxZoom: 3,
      enablePinchZoom: true,
      onChange,
      onPanRelease: vi.fn(),
      onPinchRelease: vi.fn(),
    });
    control.animateToZoom(2, false);
    expect(onChange).toHaveBeenCalledTimes(1);
    control.destroy();
  });
});
