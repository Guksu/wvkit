import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PanCamera, createCamera } from '../camera';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl 드래그 시작 여유(dragThreshold)와 방향 잠금.
 *
 * 계약 (dragThreshold 10):
 *  - 움직임이 10px 이하면 카메라를 움직이지 않는다 (pending).
 *  - 넘는 순간 우세 축(45°)으로 방향을 정한다. zoom ≤ 1 에서 교차 축 우세 → rejected (놓을 때까지 무시).
 *    동률(45°)은 rejected. zoom > 1 → 자유 2D pan.
 *  - touch/pen 이고 그 방향을 브라우저가 pan 할 터치(touch-action)면 rejected — pointercancel 을 기다린다.
 *  - 기준점을 여유만큼 당겨 잡아 튀지 않는다: 축 잠금은 그 축만 ±10, 자유 pan 은 움직인 방향으로 10.
 *  - 핀치 뒤 남은 손가락 pan 은 여유 없이 바로. 포인터 캡처는 dragging 이 된 뒤에만.
 *  - dragThreshold 0 → 이전 동작 (첫 move 부터, 잠금 없음).
 *
 * rootSize 400×600, 가로 패널 x = 0/400/800/1200, snapThreshold 0.3, resistance 0.2.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  root.style.touchAction = 'none';
  document.body.appendChild(root);
  return root;
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
];

type Init = { pointerId: number; clientX: number; clientY: number; pointerType?: string };

describe('createCameraControl — 드래그 시작 여유 · 방향 잠금', () => {
  let root: HTMLElement;
  let camera: PanCamera;
  let rafQueue: Map<number, FrameRequestCallback>;
  let rafIdSeq: number;
  let now: number;

  function flushFrame(): boolean {
    const first = rafQueue.entries().next();
    if (first.done) return false;
    const [id, cb] = first.value;
    rafQueue.delete(id);
    cb(now);
    return true;
  }

  function settle(): void {
    now += 900;
    for (let i = 0; i < 20 && flushFrame(); i++) {
      // no-op
    }
  }

  function makeControl(extra: Partial<Parameters<typeof createCameraControl>[0]> = {}) {
    const onPanRelease = vi.fn();
    const onPinchRelease = vi.fn();
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
      dragThreshold: 10,
      onChange,
      onPanRelease,
      onPinchRelease,
      ...extra,
    });
    return { control, onPanRelease, onPinchRelease, onChange };
  }

  function fire(type: string, init: Init, target: EventTarget = root): void {
    const ev = new PointerEvent(type, { pointerType: 'mouse', ...init, bubbles: true });
    target.dispatchEvent(ev);
  }
  const down = (x: number, y: number, t?: EventTarget, pointerType = 'mouse', id = 1) =>
    fire('pointerdown', { pointerId: id, clientX: x, clientY: y, pointerType }, t);
  const move = (x: number, y: number, t?: EventTarget, pointerType = 'mouse', id = 1) =>
    fire('pointermove', { pointerId: id, clientX: x, clientY: y, pointerType }, t);
  const up = (x: number, y: number, t?: EventTarget, pointerType = 'mouse', id = 1) =>
    fire('pointerup', { pointerId: id, clientX: x, clientY: y, pointerType }, t);

  beforeEach(() => {
    root = makeRoot();
    camera = createCamera();
    rafQueue = new Map();
    rafIdSeq = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafIdSeq += 1;
      rafQueue.set(rafIdSeq, cb);
      return rafIdSeq;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafQueue.delete(id);
    });
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    root.remove();
  });

  it('D1: 10px 이하 움직임은 카메라를 움직이지 않고, 넘으면 기준점을 10px 당겨 잡아 튀지 않는다', () => {
    const { control, onChange } = makeControl();
    control.animateToIndex(0, false);
    onChange.mockClear();
    down(300, 300);
    move(294, 300); // 6px — 여유 안
    move(291, 302); // |d| ≈ 9.2 — 여유 안
    expect(camera.position.x).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    move(270, 300); // 30px → 가로 잠금, 기준점 290 → camera x = 290 − 270 = 20 (당기지 않았으면 30)
    expect(camera.position.x).toBe(20);
    move(250, 300);
    expect(camera.position.x).toBe(40);
    control.destroy();
  });

  it('D2: zoom 1 에서 교차 축(세로) 우세 → 이 제스처는 끝까지 무시, 놓으면 제자리', () => {
    const { control, onPanRelease } = makeControl();
    control.animateToIndex(0, false);
    down(200, 300);
    move(195, 280); // dx −5, dy −20 → 세로 우세 → rejected
    move(100, 270); // 이후 가로로 크게 움직여도 무시 (한 번 정한 방향은 유지)
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0);
    up(100, 270);
    expect(onPanRelease).toHaveBeenCalledWith(0);
    settle();
    expect(camera.position.x).toBe(0);
    control.destroy();
  });

  it('D3: 45° 동률은 페이저가 받지 않고, 44° 쪽(가로가 조금 더 큼)은 가로로 잠근다', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    down(200, 300);
    move(185, 285); // |dx| = |dy| = 15 → rejected
    move(150, 285);
    expect(camera.position.x).toBe(0);
    up(150, 285);
    settle();
    down(200, 300);
    move(185, 285.5); // |dx| 15 > |dy| 14.5 → 가로 잠금, 기준점 190 → x = 190 − 185 = 5
    expect(camera.position.x).toBe(5);
    expect(camera.position.y).toBe(0); // zoom 1 → 교차 축 고정
    control.destroy();
  });

  it('D4: zoom 2 는 자유 2D pan — 움직인 방향으로 10px 당겨 잡는다', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(200, 300);
    move(170, 260); // d = (−30, −40), |d| 50 → 기준점 (194, 292)
    // camera x = 0 − (170 − 194)/2 = 12, y = 0 + (260 − 292)/2 = −16
    expect(camera.position.x).toBe(12);
    expect(camera.position.y).toBe(-16);
    control.destroy();
  });

  it('D5: pan-y 스크롤 패널 위 터치 — 세로 우세는 zoom 2 에서도 브라우저 몫(무시), 가로 우세는 드래그', () => {
    const panel = document.createElement('div');
    panel.style.overflowY = 'auto';
    panel.style.touchAction = 'pan-y';
    root.appendChild(panel);
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(200, 300, panel, 'touch');
    move(198, 270, panel, 'touch'); // 세로 우세 → 브라우저가 스크롤할 터치 → rejected
    move(190, 200, panel, 'touch');
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0);
    up(190, 200, panel, 'touch');
    settle();
    down(200, 300, panel, 'touch');
    move(170, 305, panel, 'touch'); // 가로 우세 → pan-y 는 가로를 허용하지 않음 → 페이저 드래그
    expect(camera.position.x).not.toBe(0);
    control.destroy();
  });

  it('D6: 같은 pan-y 패널이라도 마우스는 touch-action 과 무관 — zoom 2 세로 드래그가 카메라를 움직인다', () => {
    const panel = document.createElement('div');
    panel.style.overflowY = 'auto';
    panel.style.touchAction = 'pan-y';
    root.appendChild(panel);
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToZoom(2, false);
    down(200, 300, panel, 'mouse');
    move(200, 260, panel, 'mouse'); // 기준점 (200, 290) → y = (260 − 290)/2 = −15
    expect(camera.position.y).toBe(-15);
    control.destroy();
  });

  it('D7: 칩 줄(overflow-x auto, pan-x pan-y) 위 가로 터치 → 브라우저가 칩을 스크롤할 몫이라 페이저는 무시', () => {
    const panel = document.createElement('div');
    panel.style.overflowY = 'auto';
    panel.style.touchAction = 'pan-y';
    const chips = document.createElement('div');
    chips.style.overflowX = 'auto';
    chips.style.touchAction = 'pan-x pan-y';
    panel.appendChild(chips);
    root.appendChild(panel);
    const { control } = makeControl();
    control.animateToIndex(0, false);
    down(300, 100, chips, 'touch');
    move(260, 100, chips, 'touch');
    expect(camera.position.x).toBe(0);
    control.destroy();
  });

  it('D8: 호스트(touch-action: none) 안 스크롤 없는 카드 위 터치 → 브라우저 몫이 아니므로 가로 드래그', () => {
    const card = document.createElement('div');
    root.appendChild(card);
    const { control } = makeControl();
    control.animateToIndex(0, false);
    down(300, 300, card, 'touch');
    move(260, 300, card, 'touch'); // 기준점 290 → x = 30
    expect(camera.position.x).toBe(30);
    control.destroy();
  });

  it('D9: 여유 안의 떨린 탭(4px)은 여전히 탭 — 더블탭 줌이 되고, 그 전까지 카메라는 흔들리지 않는다', () => {
    const { control, onChange, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
    control.animateToIndex(0, false);
    onChange.mockClear();
    down(300, 300);
    move(304, 300);
    now += 50;
    up(304, 300);
    now += 100;
    down(302, 301);
    move(298, 301);
    expect(onChange).not.toHaveBeenCalled(); // 두 번의 떨림 모두 카메라 무변화
    now += 50;
    up(298, 301);
    expect(onPinchRelease).toHaveBeenCalledWith(2);
    control.destroy();
  });

  it('D10: 포인터 캡처는 드래그가 시작된 뒤에만 — 여유 안·무시된 제스처는 캡처하지 않는다', () => {
    const setCapture = vi.fn();
    const releaseCapture = vi.fn();
    Object.assign(root, { setPointerCapture: setCapture, releasePointerCapture: releaseCapture });
    const { control } = makeControl();
    control.animateToIndex(0, false);
    down(300, 300);
    move(294, 300); // 6px — 슬롭(3px)은 넘었지만 여유 안
    expect(setCapture).not.toHaveBeenCalled();
    up(294, 300);
    down(300, 300);
    move(298, 270); // 세로 우세 → rejected
    expect(setCapture).not.toHaveBeenCalled();
    up(298, 270);
    down(300, 300);
    move(270, 300); // 가로 드래그 시작
    expect(setCapture).toHaveBeenCalledTimes(1);
    up(270, 300);
    expect(releaseCapture).toHaveBeenCalledTimes(1);
    control.destroy();
  });

  it('D11: 핀치가 끝나고 남은 손가락의 pan 은 여유 없이 바로 따라간다', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    down(150, 300, root, 'touch', 1);
    down(250, 300, root, 'touch', 2); // 핀치 시작
    up(150, 300, root, 'touch', 1); // 핀치 끝 → 손가락 2 가 pan 승계
    const x0 = camera.position.x;
    move(246, 300, root, 'touch', 2); // 4px — 여유가 있었다면 무시됐을 거리
    expect(camera.position.x).toBe(x0 + 4);
    control.destroy();
  });

  it('D12: vertical 페이저는 세로 잠금 — 가로 우세는 무시, 세로는 y 만 10px 당겨 잡는다', () => {
    const { control } = makeControl({ direction: 'vertical', positions: VERTICAL_POSITIONS });
    control.animateToIndex(0, false); // y = −300
    down(200, 300);
    move(160, 305); // 가로 우세 → rejected
    expect(camera.position.y).toBe(-300);
    up(160, 305);
    settle();
    down(200, 300);
    move(200, 270); // 세로 잠금, 기준점 y 290 → camera y = −300 + (270 − 290) = −320
    expect(camera.position.y).toBe(-320);
    expect(camera.position.x).toBe(0);
    control.destroy();
  });

  it('D13: 여유 안에서 pointercancel → 카메라 무변화, onPanRelease(시작 인덱스)', () => {
    const { control, onPanRelease, onChange } = makeControl();
    control.animateToIndex(1, false);
    onChange.mockClear();
    down(200, 300, root, 'touch');
    move(198, 294, root, 'touch');
    fire('pointercancel', { pointerId: 1, clientX: 198, clientY: 294, pointerType: 'touch' });
    expect(onPanRelease).toHaveBeenCalledWith(1);
    expect(rafQueue.size).toBe(0);
    expect(camera.position.x).toBe(400);
    expect(onChange).not.toHaveBeenCalled();
    control.destroy();
  });

  it('D14: 스냅 트윈 중에 닿은 세로 제스처(무시됨)를 놓으면 가까운 패널로 마저 정착한다', () => {
    const { control } = makeControl();
    control.animateToIndex(0, false);
    control.animateToIndex(1, true); // 0 → 400 트윈 (300ms)
    now += 150;
    flushFrame(); // 절반 시간 → x = 400 × easeOutCubic(0.5) = 350
    expect(camera.position.x).toBe(350);
    down(200, 300); // 트윈 잡기 (취소)
    move(198, 270); // 세로 우세 → rejected
    up(198, 270);
    settle();
    expect(camera.position.x).toBe(400);
    control.destroy();
  });

  it('D15: dragThreshold 0 → 이전 동작 (첫 move 부터, 세로 우세 대각에도 가로 성분만큼 움직임)', () => {
    const { control } = makeControl({ dragThreshold: 0 });
    control.animateToIndex(0, false);
    down(200, 300);
    move(195, 280);
    expect(camera.position.x).toBe(5);
    control.destroy();
  });
});
