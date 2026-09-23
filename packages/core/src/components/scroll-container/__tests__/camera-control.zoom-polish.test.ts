import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PanCamera, createCamera } from '../camera';
import { createCameraControl } from '../camera-control';

/**
 * CameraControl 줌 마무리 단위 테스트 — 교차 축 pan · 더블탭 줌 · 줌 고무줄.
 *
 * 계약:
 *  - 교차 축(horizontal이면 Y): zoom > 1 이면 패널의 교차 축 반폭 `(crossSize/2)(1 − 1/zoom)` 안에서 pan,
 *    밖은 엣지 저항, 릴리스 시 관성 투영을 반폭 안으로 잘라 감속. zoom ≤ 1 이면 고정(페이저 계약).
 *  - 더블탭(`doubleTapZoom` 숫자): minZoom 에서 탭한 지점을 고정한 채 그 레벨로, 줌 상태면 minZoom 으로(중심).
 *    `onPinchRelease(목표 줌)` 1회, `onPanRelease` 는 내지 않는다. 판정: 눌림 ≤ 300ms·이동 ≤ 10px,
 *    첫 up → 두 번째 down ≤ 300ms, 두 down 거리 ≤ 40px.
 *  - 줌 고무줄: 핀치가 min/max 밖이면 `min × (raw/min)^resistance` 로 감쇠, `onPinchRelease` 는 경계 값,
 *    마지막 손가락 릴리스 트윈이 경계 줌으로 되돌린다.
 *
 * 수동 RAF 큐 + performance.now 스파이. rootSize 400×600, zoom 2 → 축 반폭 100 / 교차 축 반폭 150,
 * snapThreshold 0.3, resistance 0.2.
 */

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
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
  { x: 0, y: -2100 },
];

function pointerEvent(
  type: string,
  init: { pointerId: number; clientX: number; clientY: number },
): Event {
  try {
    return new PointerEvent(type, { ...init, bubbles: true });
  } catch {
    const ev = new Event(type, { bubbles: true });
    Object.assign(ev, init);
    return ev;
  }
}

describe('createCameraControl — 줌 마무리 (교차 축 pan · 더블탭 · 줌 고무줄)', () => {
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

  /** 트윈 종료까지 시간을 넘긴 뒤 잔여 프레임 전부 실행 (릴리스 최대 800ms, 프로그램 300ms). */
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
      onChange,
      onPanRelease,
      onPinchRelease,
      ...extra,
    });
    return { control, onPanRelease, onPinchRelease, onChange };
  }

  const down = (id: number, x: number, y: number) =>
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId: id, clientX: x, clientY: y }));
  const move = (id: number, x: number, y: number) =>
    root.dispatchEvent(pointerEvent('pointermove', { pointerId: id, clientX: x, clientY: y }));
  const up = (id: number, x: number, y: number) =>
    root.dispatchEvent(pointerEvent('pointerup', { pointerId: id, clientX: x, clientY: y }));

  /** 한 번의 탭 (down → 50ms → up, 같은 좌표) */
  function tap(x: number, y: number): void {
    down(1, x, y);
    now += 50;
    up(1, x, y);
  }

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

  // ─── X — 교차 축 pan ────────────────────────────────────────────────────────

  describe('교차 축 pan (zoom > 1 에서만, 패널 교차 축 반폭 안)', () => {
    it('X1: zoom 2 horizontal — 세로 드래그가 camera.y 를 dy/zoom 만큼 움직이고 정지 릴리스 후 그 자리 유지', () => {
      const { control, onPanRelease } = makeControl();
      control.animateToIndex(0, false);
      control.animateToZoom(2, false);
      down(1, 200, 300);
      now += 16;
      move(1, 200, 240); // dy=−60 → y = 0 + (−60)/2 = −30 (반폭 150 안)
      expect(camera.position.y).toBe(-30);
      expect(camera.position.x).toBe(0);
      now += 200;
      move(1, 200, 240); // 멈춤 → 관성 없음
      now += 16;
      up(1, 200, 240);
      expect(onPanRelease).toHaveBeenCalledWith(0);
      expect(rafQueue.size).toBe(0); // 목표 = 현재 → 트윈 없음
      settle();
      expect(camera.position.y).toBe(-30);
      control.destroy();
    });

    it('X2: zoom 2 — 교차 축 반폭(150) 밖은 엣지 저항, 릴리스하면 반폭 경계로 복귀', () => {
      const { control } = makeControl();
      control.animateToIndex(0, false);
      control.animateToZoom(2, false);
      down(1, 200, 300);
      now += 16;
      move(1, 200, 700); // dy=+400 → raw y = 200 > 150 → 150 + 50×0.2 = 160
      expect(camera.position.y).toBeCloseTo(160, 10);
      now += 16;
      up(1, 200, 700);
      expect(rafQueue.size).toBe(1);
      settle();
      expect(camera.position.y).toBe(150);
      expect(camera.position.x).toBe(0);
      expect(camera.zoom).toBe(2);
      control.destroy();
    });

    it('X3: zoom 1 — 대각 드래그의 세로 성분은 무시된다 (교차 축 고정, 페이저 계약 유지)', () => {
      const { control } = makeControl();
      control.animateToIndex(0, false);
      down(1, 200, 300);
      now += 16;
      move(1, 150, 240); // dx=−50 → x=50, dy=−60 → 무시
      expect(camera.position.x).toBe(50);
      expect(camera.position.y).toBe(0);
      control.destroy();
    });

    it('X4: zoom 2 — 세로 플릭은 관성 투영(속도×500)을 반폭 안으로 잘라 감속한다', () => {
      const { control } = makeControl();
      control.animateToIndex(0, false);
      control.animateToZoom(2, false);
      down(1, 200, 300);
      now += 16;
      move(1, 200, 280); // dy=−20 → y=−10, lastDeltaCross=−10, 간격 16ms → 속도 −0.625/ms
      now += 16;
      up(1, 200, 280); // 투영 −10 − 312.5 = −322.5 → 반폭 −150 으로 클램프
      settle();
      expect(camera.position.y).toBe(-150);
      expect(camera.position.x).toBe(0);
      control.destroy();
    });

    it('X5: animateToZoom 은 교차 축도 새 줌의 반폭 안으로 끌어온다 (1 이면 중심)', () => {
      const { control } = makeControl();
      control.animateToIndex(0, false);
      control.animateToZoom(2, false);
      camera.position.y = 120;
      control.animateToZoom(1.5, false); // 교차 반폭 300×(1−1/1.5) = 100
      expect(camera.position.y).toBeCloseTo(100, 10);
      control.animateToZoom(1, false);
      expect(camera.position.y).toBe(0);
      expect(camera.position.x).toBe(0);
      control.destroy();
    });

    it('X6: vertical zoom 2 — 교차 축은 X: 가로 드래그가 camera.x 를 반폭(100) 안에서 움직인다', () => {
      const { control } = makeControl({ direction: 'vertical', positions: VERTICAL_POSITIONS });
      control.animateToIndex(0, false); // y=−300
      control.animateToZoom(2, false);
      down(1, 200, 300);
      now += 16;
      move(1, 260, 300); // dx=+60 → x = 0 − 60/2 = −30
      expect(camera.position.x).toBe(-30);
      expect(camera.position.y).toBe(-300);
      now += 16;
      move(1, 500, 300); // dx=+300 → raw −150 < −100 → −100 − 50×0.2 = −110
      expect(camera.position.x).toBeCloseTo(-110, 10);
      now += 16;
      up(1, 500, 300);
      settle();
      expect(camera.position.x).toBe(-100);
      control.destroy();
    });
  });

  // ─── C — pointercancel ──────────────────────────────────────────────────────

  describe('pointercancel (브라우저가 터치를 가져감)', () => {
    const cancel = (id: number, x: number, y: number) =>
      root.dispatchEvent(pointerEvent('pointercancel', { pointerId: id, clientX: x, clientY: y }));

    it('C1: zoom 2 에서 교차 축으로 움직인 뒤 pointercancel → 시작 위치로 되돌리는 트윈, 인덱스 유지', () => {
      const { control, onPanRelease } = makeControl();
      control.animateToIndex(0, false);
      control.animateToZoom(2, false);
      down(1, 200, 300);
      now += 16;
      move(1, 200, 240); // y = −30 (pan-y 패널이면 여기서 브라우저가 스크롤을 시작해 cancel 을 낸다)
      now += 16;
      cancel(1, 200, 240);
      expect(onPanRelease).toHaveBeenCalledWith(0);
      expect(rafQueue.size).toBe(1);
      settle();
      expect(camera.position.y).toBe(0); // up 이었다면 −30 에 머물렀을 것
      expect(camera.position.x).toBe(0);
      expect(camera.zoom).toBe(2);
      control.destroy();
    });

    it('C2: zoom 1 에서 threshold 를 넘게 끌어도 pointercancel 이면 스냅하지 않고 시작 패널로 복귀', () => {
      const { control, onPanRelease } = makeControl();
      control.animateToIndex(0, false);
      down(1, 300, 300);
      now += 100;
      move(1, 100, 300); // x = 200 → dragRatio 0.5 (up 이면 패널 1 로 스냅)
      now += 16;
      cancel(1, 100, 300);
      expect(onPanRelease).toHaveBeenCalledWith(0);
      settle();
      expect(camera.position.x).toBe(0);
      control.destroy();
    });

    it('C3: pointercancel 은 탭이 아니며 직전 탭 기록도 지운다', () => {
      const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(300, 300);
      now += 100;
      down(1, 300, 300);
      now += 30;
      cancel(1, 300, 300);
      now += 100;
      tap(300, 300); // 기록이 지워졌으므로 첫 탭
      expect(onPinchRelease).not.toHaveBeenCalled();
      control.destroy();
    });
  });

  // ─── T — 더블탭 줌 ──────────────────────────────────────────────────────────

  describe('더블탭 줌 (doubleTapZoom)', () => {
    it('T1: minZoom 에서 더블탭 → 탭한 지점을 고정한 채 doubleTapZoom 으로 확대, onPinchRelease(2), onPanRelease 없음', () => {
      const { control, onPanRelease, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(300, 300); // 첫 탭 → 일반 릴리스 (onPanRelease 1회)
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      now += 100;
      tap(300, 300); // 두 번째 탭 (첫 up 뒤 100ms) → 더블탭
      expect(onPinchRelease).toHaveBeenCalledTimes(1);
      expect(onPinchRelease).toHaveBeenCalledWith(2);
      expect(onPanRelease).toHaveBeenCalledTimes(1); // 더블탭은 pan 릴리스가 아니다
      settle();
      expect(camera.zoom).toBe(2);
      // 탭 지점 (300,300) 아래 월드 점 x=100 이 줌 뒤에도 같은 화면 위치: cameraX = 100 − 100/2 = 50
      expect(camera.position.x).toBe(50);
      expect(camera.position.y).toBe(0);
      expect((100 - camera.position.x) * camera.zoom + 200).toBe(300);
      control.destroy();
    });

    it('T2: 줌 상태에서 더블탭 → minZoom 으로, 카메라는 패널 중심', () => {
      const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      control.animateToZoom(2, false);
      camera.position.x = 60;
      camera.position.y = -40;
      tap(100, 100);
      now += 80;
      tap(110, 105); // 40px 안·300ms 안 → 더블탭
      expect(onPinchRelease).toHaveBeenCalledWith(1);
      settle();
      expect(camera.zoom).toBe(1);
      expect(camera.position.x).toBe(0);
      expect(camera.position.y).toBe(0);
      control.destroy();
    });

    it('T3: 두 탭 사이가 300ms 를 넘으면 더블탭이 아니다 — 두 번째 탭이 새 첫 탭이 된다', () => {
      const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(300, 300);
      now += 400;
      tap(300, 300);
      expect(onPinchRelease).not.toHaveBeenCalled();
      expect(camera.zoom).toBe(1);
      now += 100;
      tap(300, 300); // 직전 탭(두 번째)과 이어짐 → 더블탭
      expect(onPinchRelease).toHaveBeenCalledWith(2);
      control.destroy();
    });

    it('T4: 10px 넘게 움직인 눌림은 탭이 아니고, 직전 탭 기록도 지운다', () => {
      const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(300, 300);
      now += 100;
      down(1, 300, 300);
      now += 30;
      move(1, 330, 300); // 30px 이동 → 탭 아님
      now += 30;
      up(1, 330, 300);
      expect(onPinchRelease).not.toHaveBeenCalled();
      now += 100;
      tap(330, 300); // 직전 기록이 지워졌으므로 이것은 첫 탭
      expect(onPinchRelease).not.toHaveBeenCalled();
      control.destroy();
    });

    it('T5: 300ms 넘게 누른 뒤 떼면 탭이 아니다', () => {
      const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(300, 300);
      now += 100;
      down(1, 300, 300);
      now += 400; // 길게 누름
      up(1, 300, 300);
      expect(onPinchRelease).not.toHaveBeenCalled();
      control.destroy();
    });

    it('T6: doubleTapZoom 기본값(false)이면 연속 탭에도 줌이 바뀌지 않는다', () => {
      const { control, onPinchRelease } = makeControl();
      control.animateToIndex(0, false);
      tap(300, 300);
      now += 100;
      tap(300, 300);
      expect(onPinchRelease).not.toHaveBeenCalled();
      expect(camera.zoom).toBe(1);
      control.destroy();
    });

    it('T7: 두 손가락이 닿았던 눌림은 탭이 아니다 (핀치 뒤 남은 손가락 up 이 더블탭으로 오인되지 않음)', () => {
      const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(300, 300);
      now += 100;
      down(1, 300, 300);
      down(2, 320, 300);
      now += 30;
      up(2, 320, 300); // pinch 종료 → onPinchRelease(1) (줌 변화 없음)
      now += 30;
      up(1, 300, 300); // 남은 손가락 up → 일반 릴리스, 더블탭 아님
      expect(onPinchRelease).toHaveBeenCalledTimes(1);
      expect(onPinchRelease).toHaveBeenCalledWith(1);
      expect(camera.zoom).toBe(1);
      control.destroy();
    });

    it('T8: vertical — 더블탭 앵커가 교차 축(X)에도 적용된다', () => {
      const { control, onPinchRelease } = makeControl({
        direction: 'vertical',
        positions: VERTICAL_POSITIONS,
        doubleTapZoom: 2,
      });
      control.animateToIndex(0, false); // (0, −300)
      tap(300, 300);
      now += 100;
      tap(300, 300);
      expect(onPinchRelease).toHaveBeenCalledWith(2);
      settle();
      expect(camera.zoom).toBe(2);
      expect(camera.position.x).toBe(50); // 월드 x=100 고정 → 100 − 100/2
      expect(camera.position.y).toBe(-300); // 화면 중앙 탭 → 축은 그대로
      control.destroy();
    });

    it('T9: root 가 페이지 (0,0) 에 있지 않아도 더블탭 앵커는 root 기준 좌표를 쓴다', () => {
      root.getBoundingClientRect = () =>
        ({
          left: 100,
          top: 50,
          right: 500,
          bottom: 650,
          width: 400,
          height: 600,
          x: 100,
          y: 50,
        }) as DOMRect;
      const { control } = makeControl({ doubleTapZoom: 2 });
      control.animateToIndex(0, false);
      tap(400, 350); // 로컬 (300, 300)
      now += 100;
      tap(400, 350);
      settle();
      expect(camera.zoom).toBe(2);
      expect(camera.position.x).toBe(50);
      control.destroy();
    });
  });

  // ─── T10 — 끊긴 줌 트윈 ───────────────────────────────────────────────────

  it('T10: 더블탭 줌인 트윈을 탭으로 끊어도 릴리스가 정착 줌(2)으로 이어가고, 다음 더블탭은 줌아웃이다', () => {
    const { control, onPinchRelease } = makeControl({ doubleTapZoom: 2 });
    control.animateToIndex(0, false);
    tap(300, 300);
    now += 100;
    tap(300, 300); // 더블탭 → zoom 2 트윈 시작
    now += 60;
    flushFrame(); // 60ms 진행 → 중간 줌
    const mid = camera.zoom;
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(2);
    now += 400;
    tap(300, 300); // 트윈 취소 + 릴리스 → 정착 줌 2 로 이어간다 (중간값에 멈추지 않음)
    settle();
    expect(camera.zoom).toBe(2);
    now += 400;
    tap(300, 300);
    now += 100;
    tap(300, 300); // 더블탭 → 줌아웃
    expect(onPinchRelease).toHaveBeenLastCalledWith(1);
    settle();
    expect(camera.zoom).toBe(1);
    control.destroy();
  });

  // ─── R — 줌 고무줄 ──────────────────────────────────────────────────────────

  describe('줌 고무줄 (min/max 밖 핀치)', () => {
    it('R1: minZoom 아래로 핀치 → 배율 감쇠(0.5^0.2), onPinchRelease(1), 마지막 손가락 릴리스가 1로 되돌린다', () => {
      const { control, onPinchRelease } = makeControl();
      control.animateToIndex(0, false);
      down(1, 100, 300);
      down(2, 300, 300); // dist 200, mid (200,300) → 앵커 (0,0)
      move(1, 150, 300);
      move(2, 250, 300); // dist 100 → raw 0.5 → 1 × 0.5^0.2
      expect(camera.zoom).toBeCloseTo(0.5 ** 0.2, 10);
      expect(camera.position.x).toBe(0);
      now += 16;
      up(1, 150, 300);
      expect(onPinchRelease).toHaveBeenCalledWith(1); // 범위 밖 값을 보고하지 않는다
      now += 16;
      up(2, 250, 300);
      expect(rafQueue.size).toBe(1); // 복귀 트윈
      settle();
      expect(camera.zoom).toBe(1);
      expect(camera.position.x).toBe(0);
      expect(camera.position.y).toBe(0);
      control.destroy();
    });

    it('R2: maxZoom 위로 핀치 → 감쇠된 줌을 보여주다 릴리스 후 maxZoom 으로 복귀 (줌 상태 릴리스 경로)', () => {
      const { control, onPinchRelease, onPanRelease } = makeControl();
      control.animateToIndex(0, false);
      down(1, 150, 300);
      down(2, 250, 300); // dist 100, mid (200,300)
      move(1, -300, 300);
      move(2, 700, 300); // dist 1000 → raw 10 → 3 × (10/3)^0.2
      expect(camera.zoom).toBeGreaterThan(3);
      now += 16;
      up(1, -300, 300);
      expect(onPinchRelease).toHaveBeenCalledWith(3);
      now += 16;
      up(2, 700, 300);
      expect(onPanRelease).toHaveBeenCalledWith(0);
      settle();
      expect(camera.zoom).toBe(3);
      expect(camera.position.x).toBe(0);
      control.destroy();
    });

    it('R3: 감쇠된 줌으로 남은 손가락이 pan 하다 놓아도 정착 줌은 minZoom, 페이저 스냅 계약 유지', () => {
      const { control, onPanRelease } = makeControl();
      control.animateToIndex(0, false);
      down(1, 100, 300);
      down(2, 300, 300);
      move(1, 150, 300);
      move(2, 250, 300); // zoom ≈ 0.87
      now += 16;
      up(1, 150, 300); // 남은 손가락 2 → pan 승계
      now += 16;
      move(2, 210, 300); // dx=−40 → x = 40/0.87 ≈ 46 (dragRatio 0.115 < 0.3 → 패널 0 유지)
      expect(camera.position.x).toBeGreaterThan(40);
      now += 200;
      move(2, 210, 300); // 멈춤 → 속도 0 (플릭이 아님)
      now += 16;
      up(2, 210, 300);
      expect(onPanRelease).toHaveBeenCalledWith(0);
      settle();
      expect(camera.zoom).toBe(1);
      expect(camera.position.x).toBe(0);
      control.destroy();
    });

    it('R4: resistance 0 → 하드 클램프 (기존 동작), 릴리스 트윈 없음', () => {
      const { control, onPinchRelease } = makeControl({ resistance: 0 });
      control.animateToIndex(0, false);
      down(1, 100, 300);
      down(2, 300, 300);
      move(1, 150, 300);
      move(2, 250, 300);
      expect(camera.zoom).toBe(1);
      now += 16;
      up(1, 150, 300);
      now += 200;
      move(2, 250, 300);
      now += 16;
      up(2, 250, 300);
      expect(onPinchRelease).toHaveBeenCalledWith(1);
      // 줌 1·위치 0 그대로 → 페이저 릴리스 트윈(거리 0)만 돌고 값 불변
      settle();
      expect(camera.zoom).toBe(1);
      expect(camera.position.x).toBe(0);
      control.destroy();
    });
  });
});
