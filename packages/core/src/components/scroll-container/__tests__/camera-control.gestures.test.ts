import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CameraControl } from '../camera-control';
import { createCameraControl } from '../camera-control';
import { screenPointToWorld } from '../matrix-utils';

/**
 * CameraControl 제스처 수식 단위 테스트 (Sprint 2 · B-05).
 *
 * PointerEvent 시퀀스 → camera.position/zoom 정확값, onPanRelease/onPinchRelease 인자를
 * matrix-utils 순수 함수 수식에서 도출한 기대값으로 고정한다.
 *
 * 그룹:
 *  A. updatePan 수식 — 축 제약 / 엣지 저항 / zoom 스케일
 *  B. endPan 스냅 방향 — dragRatio + velocityRatio×0.3 vs snapThreshold (performance.now 목킹)
 *  C. 핀치 줌 — 배율 / 앵커 보정 / 클램프 / two-finger pan 저항 / cross-axis 고정
 *  D. 다지 승계 — 2→1 pan 복귀(재앵커), 3→2 pinch 재시작
 *
 * 공통 상수: rootSize 400×600, snapThreshold 0.3, resistance 0.2, zoom [1,3],
 * velocityWeight 0.3 (matrix-utils decideSnapTarget 기본값).
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

// happy-dom v15는 PointerEvent 클래스를 지원. setPointerCapture는 소스에서 try/catch 가드됨.
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

describe('createCameraControl — 제스처 수식 (Sprint 2 B-05)', () => {
  let root: HTMLElement;
  let camera: THREE.OrthographicCamera;
  let control: CameraControl | null;
  // performance.now를 결정적으로 제어 — move 사이 `now`를 증가시켜 속도/지터를 재현.
  let now: number;

  beforeEach(() => {
    root = makeRoot();
    camera = makeCamera();
    control = null;
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    control?.destroy();
    root.remove();
    vi.restoreAllMocks();
  });

  function createControl(extra: Partial<Parameters<typeof createCameraControl>[0]> = {}) {
    const onChange = vi.fn();
    const onPanRelease = vi.fn();
    const onPinchRelease = vi.fn();
    control = createCameraControl({
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
    return { control, onChange, onPanRelease, onPinchRelease };
  }

  function down(pointerId: number, clientX: number, clientY: number): void {
    root.dispatchEvent(pointerEvent('pointerdown', { pointerId, clientX, clientY }));
  }
  function move(pointerId: number, clientX: number, clientY: number): void {
    root.dispatchEvent(pointerEvent('pointermove', { pointerId, clientX, clientY }));
  }
  function up(pointerId: number, clientX: number, clientY: number): void {
    root.dispatchEvent(pointerEvent('pointerup', { pointerId, clientX, clientY }));
  }

  // ─── 그룹 A — updatePan 수식 ───────────────────────────────────────────────

  describe('updatePan 수식 (축 제약 · 엣지 저항 · zoom 스케일)', () => {
    it('A1: 전진 pan — camera.x = start − dx/zoom (부호·수식)', () => {
      const { control: c } = createControl();
      c.animateToIndex(0, false); // camera x=0 고정
      down(1, 200, 300);
      now = 16;
      move(1, 150, 300); // dx = -50, zoom = 1
      expect(camera.position.x).toBe(50); // 0 − (−50)/1
      expect(camera.position.y).toBe(0);
    });

    it('A2: 대각 이동 시 cross-axis 불변 — 대각 스크롤 방지', () => {
      const { control: c } = createControl();
      c.animateToIndex(0, false);
      down(1, 200, 300);
      now = 16;
      move(1, 150, 200); // dx = -50, dy = -100 (대각)
      expect(camera.position.x).toBe(50);
      expect(camera.position.y).toBe(0); // horizontal에서 y는 절대 불변
    });

    it('A3: min 경계 밖 pan은 엣지 저항으로 감쇠 — applyResistance 일치', () => {
      const { control: c } = createControl();
      c.animateToIndex(0, false); // index 0 = min 경계 (x=0)
      down(1, 200, 300);
      now = 16;
      move(1, 300, 300); // dx = +100 → raw target −100 < min 0
      expect(camera.position.x).toBe(-20); // 0 − 100×0.2
      expect(camera.position.y).toBe(0);
    });

    it('A4: zoom=2에서 pan 거리는 1/zoom로 스케일 — dx/zoom', () => {
      const { control: c } = createControl();
      c.animateToIndex(0, false);
      c.animateToZoom(2, false);
      down(1, 200, 300);
      now = 16;
      move(1, 100, 300); // dx = -100
      expect(camera.position.x).toBe(50); // 0 − (−100)/2
      expect(camera.position.y).toBe(0);
    });

    it('A5: vertical 축 pan — camera.y = start + dy/zoom, x 불변', () => {
      const { control: c } = createControl({
        direction: 'vertical',
        positions: VERTICAL_POSITIONS,
      });
      c.animateToIndex(0, false); // camera y = -300
      down(1, 200, 300);
      now = 16;
      move(1, 200, 200); // dy = -100
      expect(camera.position.y).toBe(-400); // −300 + (−100)/1
      expect(camera.position.x).toBe(0);
    });
  });

  // ─── 그룹 B — endPan 스냅 방향 ─────────────────────────────────────────────
  // effective = dragRatio + velocityRatio×0.3, threshold 0.3, panelSize 400.

  describe('endPan 스냅 방향 (dragRatio · velocityRatio · 지터 보정)', () => {
    it('B1: 전진 스냅 — dragRatio 0.4 > threshold → onPanRelease(1)', () => {
      const { control: c, onPanRelease } = createControl();
      c.animateToIndex(0, false);
      down(1, 200, 300); // t=0
      now = 100;
      move(1, 120, 300); // dx=-80 → x=80
      now = 200;
      move(1, 40, 300); // dx=-160 → x=160, lastDelta=80, interval=100
      now = 300;
      up(1, 40, 300); // dt=max(1,100,100)=100 → velocityRatio=0.2, effective=0.46
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(1);
    });

    it('B2: 후진 스냅 — dragRatio −0.4 < −threshold → onPanRelease(0)', () => {
      const { control: c, onPanRelease } = createControl();
      c.animateToIndex(1, false); // camera x=400
      down(1, 200, 300);
      now = 100;
      move(1, 280, 300); // dx=+80 → x=320
      now = 200;
      move(1, 360, 300); // dx=+160 → x=240, lastDelta=-80
      now = 300;
      up(1, 360, 300); // effective = −0.4 + (−0.2)×0.3 = −0.46
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(0);
    });

    it('B3: 서브임계값 저속 드래그는 원위치로 스냅 — onPanRelease(1)', () => {
      const { control: c, onPanRelease } = createControl();
      c.animateToIndex(1, false); // camera x=400
      down(1, 200, 300);
      now = 100;
      move(1, 160, 300); // dx=-40 → x=440, dragRatio=0.1, lastDelta=40, interval=100
      now = 200;
      up(1, 160, 300); // velocityRatio=0.1 → effective=0.13 < 0.3
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(1); // 원위치 유지
    });

    it('B4: 플릭 — 저드래그(0.15) + 고속도(velocityRatio 1.0) → 전진 스냅', () => {
      const { control: c, onPanRelease } = createControl();
      c.animateToIndex(0, false);
      down(1, 200, 300); // t=0
      now = 100;
      move(1, 180, 300); // dx=-20 → x=20, interval=100
      now = 110;
      move(1, 140, 300); // 추가 -40 → x=60, lastDelta=40, interval=10
      now = 111;
      up(1, 140, 300);
      // dt = max(1, 10, 1) = 10 → velocityRatio = (40/400)×(100/10) = 1.0
      // effective = 60/400 + 1.0×0.3 = 0.15 + 0.3 = 0.45 > 0.3
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(1);
    });

    it('B5: 지터 가드 — 마지막 미세 역방향 move가 스냅 방향을 뒤집지 않는다 (dt 하한 회귀)', () => {
      const { control: c, onPanRelease } = createControl();
      c.animateToIndex(0, false);
      down(1, 200, 300); // t=0
      now = 100;
      move(1, 120, 300); // x=80
      now = 200;
      move(1, 40, 300); // x=160 (dx=-160 도달)
      now = 300;
      move(1, 48, 300); // 지터: dx=+8 → x=152, lastDelta=-8, interval=100
      now = 302;
      up(1, 48, 300); // release는 지터 move 2ms 후
      // 보정식: dt = max(1, lastMoveInterval=100, sinceLastMove=2) = 100
      //   → velocityRatio = (−8/400)×(100/100) = −0.02
      //   → effective = 152/400 − 0.02×0.3 = 0.38 − 0.006 = 0.374 > 0.3 → 전진
      // 버그 재발 시(dt=2): velocityRatio=−1.0 → effective=0.08 → 0으로 오스냅되어 실패
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(1);
    });
  });

  // ─── 그룹 C — 핀치 줌 + 앵커 보정 ──────────────────────────────────────────

  describe('핀치 줌 (배율 · 앵커 보정 · 클램프 · two-finger pan 저항)', () => {
    it('C1: 핀치 줌인 배율 — dist 200→300이면 zoom 1.5', () => {
      const { control: c, onChange } = createControl();
      c.animateToIndex(0, false);
      const updateSpy = vi.spyOn(camera, 'updateProjectionMatrix');
      onChange.mockClear();
      down(1, 100, 300);
      down(2, 300, 300); // dist 200
      move(1, 50, 300);
      move(2, 350, 300); // dist 300 → factor 1.5
      expect(camera.zoom).toBe(1.5);
      expect(updateSpy).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();
    });

    it('C2: 앵커 보정 — 줌 후에도 midpoint 아래 월드 점(anchor)이 불변', () => {
      const { control: c } = createControl();
      c.animateToIndex(1, false); // camera x=400
      down(1, 200, 300);
      down(2, 360, 300); // dist 160, mid (280,300) → worldAnchor.x = (280−200)/1 + 400 = 480
      move(1, 180, 300);
      move(2, 380, 300); // dist 200 → factor 1.25, mid (280,300)
      expect(camera.zoom).toBe(1.25);
      expect(camera.position.x).toBe(416); // 480 − (280−200)/1.25 = 480 − 64
      // 앵커 왕복 검증: 같은 스크린 midpoint가 여전히 같은 월드 점을 가리킨다
      const world = screenPointToWorld(
        280,
        300,
        camera.position.x,
        camera.position.y,
        camera.zoom,
        400,
        600,
      );
      expect(world.x).toBeCloseTo(480, 10);
    });

    it('C3: 줌 클램프 — factor가 min/max zoom 밖이면 잘리고 position은 유한값', () => {
      const { control: c } = createControl();
      c.animateToIndex(0, false);
      // 줌인: dist 100 → 1000, factor 10 → maxZoom 3으로 클램프
      down(1, 150, 300);
      down(2, 250, 300); // dist 100, mid (200,300)
      move(1, -300, 300);
      move(2, 700, 300); // dist 1000
      expect(camera.zoom).toBe(3);
      expect(Number.isFinite(camera.position.x)).toBe(true);
      up(1, -300, 300);
      up(2, 700, 300);
      // 줌아웃: zoom 3에서 dist 300 → 30, factor 0.1 → 0.3 → minZoom 1로 클램프
      down(1, 50, 300);
      down(2, 350, 300); // dist 300
      move(1, 185, 300);
      move(2, 215, 300); // dist 30
      expect(camera.zoom).toBe(1);
      expect(Number.isFinite(camera.position.x)).toBe(true);
    });

    it('C4: endPinch — 한 손가락 up 시 onPinchRelease가 camera.zoom으로 정확히 1회', () => {
      const { control: c, onPinchRelease } = createControl();
      c.animateToIndex(0, false);
      down(1, 100, 300);
      down(2, 300, 300);
      move(1, 50, 300);
      move(2, 350, 300); // zoom 1.5
      up(1, 50, 300);
      expect(onPinchRelease).toHaveBeenCalledTimes(1);
      expect(onPinchRelease).toHaveBeenCalledWith(1.5);
      up(2, 350, 300);
      expect(onPinchRelease).toHaveBeenCalledTimes(1); // 두 번째 up은 pinch 콜백을 다시 안 냄
    });

    it('C5: two-finger pan에도 엣지 저항 적용 — 콘텐츠 이탈 방지', () => {
      const { control: c } = createControl();
      c.animateToIndex(0, false); // min 경계
      down(1, 100, 300);
      down(2, 300, 300); // dist 200, mid (200,300) → worldAnchor (0,0)
      // 간격을 유지한 채 두 손가락 +200px 평행이동 → mid 400, raw camera −200
      move(1, 300, 300);
      move(2, 500, 300);
      expect(camera.position.x).toBe(-40); // 0 − 200×0.2 (저항 적용, −200 아님)
      expect(camera.position.y).toBe(0);
      expect(camera.zoom).toBe(1); // 간격 동일 → 줌 불변
    });

    it('C6: 핀치 중 cross-axis(y) 고정 — midpoint y가 움직여도 horizontal에서 y 불변', () => {
      const { control: c } = createControl();
      c.animateToIndex(1, false);
      const pinchStartY = camera.position.y; // 0
      down(1, 200, 300);
      down(2, 360, 300);
      // 비대칭 move — midpoint y 300 → 250
      move(1, 180, 200);
      move(2, 380, 300);
      expect(camera.position.y).toBe(pinchStartY);
    });
  });

  // ─── 그룹 D — 다지 승계 (onPointerEnd) ─────────────────────────────────────

  describe('다지 승계 (2→1 pan 복귀 · 3→2 pinch 재시작)', () => {
    it('D1: 2→1 승계 — pinch 종료 후 남은 손가락이 재앵커된 pan으로 복귀', () => {
      const { control: c, onPanRelease, onPinchRelease } = createControl();
      c.animateToIndex(0, false);
      down(1, 100, 300);
      down(2, 300, 300);
      move(1, 50, 300);
      move(2, 350, 300); // zoom 1.5, camera x=0 (mid 고정)
      now = 1000;
      up(2, 350, 300); // pinch 종료 → pan 승계 (startPan(1): camera 0, pointer (50,300) 기준 재앵커)
      expect(onPinchRelease).toHaveBeenCalledTimes(1);
      expect(onPinchRelease).toHaveBeenCalledWith(1.5);
      now = 1100;
      move(1, 30, 300); // 승계 후 델타만 반영: dx=-20 → x = 0 + 20/1.5
      // 승계 없이 최초 down(100,300) 기준이면 dx=-70 → x=46.67로 어긋난다
      expect(camera.position.x).toBeCloseTo(20 / 1.5, 10);
      now = 1200;
      up(1, 30, 300); // dragRatio≈0.033, velocityRatio≈0.033 → effective 0.043 < 0.3
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(0);
    });

    it('D2: 3→2 승계 — 하나 up 시 onPinchRelease 1회 후 pinch 재시작, 제스처가 죽지 않는다', () => {
      const { control: c, onPinchRelease } = createControl();
      c.animateToIndex(0, false);
      down(1, 100, 300);
      down(2, 300, 300); // pinch는 2번째 down에서 시작 (dist 200)
      down(3, 200, 100); // 3번째 down은 무시 분기 (size 3)
      up(1, 100, 300); // 3→2: endPinch 후 남은 (300,300),(200,100)으로 재시작
      expect(onPinchRelease).toHaveBeenCalledTimes(1);
      expect(onPinchRelease).toHaveBeenCalledWith(1); // 이동 없었으므로 zoom 1
      // 재시작 dist = hypot(100,200) → 벌리는 move로 zoom이 계속 변한다
      move(2, 400, 300); // 새 dist = hypot(200,200)
      const expectedZoom = Math.hypot(200, 200) / Math.hypot(100, 200);
      expect(camera.zoom).toBeCloseTo(expectedZoom, 10);
      expect(camera.zoom).not.toBe(1);
    });
  });

  // ─── 그룹 E — 경계·가드 (제스처 경로 커버리지 보강 · T-03 threshold 램프 지원) ──

  describe('경계·가드 (빈 positions · vertical 스냅/핀치 · 무효 포인터)', () => {
    it('E1: 빈 positions — pan은 zero-bounds 저항으로 감쇠되고 release는 onPanRelease(0)', () => {
      const { onPanRelease } = createControl({ positions: [] });
      down(1, 200, 300);
      now = 100;
      move(1, 250, 300); // dx=+50 → targetX = 0 − 50/1 = −50 < min 0 (zero bounds) → 저항: −50×0.2
      expect(camera.position.x).toBe(-10);
      now = 200;
      up(1, 250, 300);
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(0);
    });

    it('E2: vertical 전진 스냅 — dy 드래그의 부호 반전(dragRatio/velocityRatio) 후 onPanRelease(1)', () => {
      const { control: c, onPanRelease } = createControl({
        direction: 'vertical',
        positions: VERTICAL_POSITIONS,
      });
      c.animateToIndex(0, false); // camera y = −300
      down(1, 200, 300);
      now = 100;
      move(1, 200, 180); // dy=−120 → y=−420
      now = 200;
      move(1, 200, 60); // dy=−240 → y=−540, lastDelta=−120, interval=100
      now = 300;
      up(1, 200, 60);
      // panelSize = height 600. dragRatio = −(−240/600) = 0.4, velocityRatio = −(−120/600) = 0.2
      // effective = 0.4 + 0.2×0.3 = 0.46 > 0.3 → 전진
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(1);
    });

    it('E3: rootSize 0 — panelSize `|| 1` 폴백으로 NaN 없이 스냅이 결정된다', () => {
      const { control: c, onPanRelease } = createControl({
        getRootSize: () => ({ width: 0, height: 0 }),
      });
      c.animateToIndex(0, false);
      down(1, 200, 300);
      now = 100;
      move(1, 150, 300); // dx=−50 → x=50, panelSize=0→1 → dragRatio 50
      now = 200;
      up(1, 150, 300);
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(1); // NaN이면 decideSnapTarget 비교가 전부 false → 0
    });

    it('E4: vertical 핀치 — y축에 엣지 저항, x축은 pinchStart에 고정', () => {
      const { control: c } = createControl({
        direction: 'vertical',
        positions: VERTICAL_POSITIONS,
      });
      c.animateToIndex(0, false); // camera y = −300 (max 경계)
      down(1, 150, 300);
      down(2, 250, 300); // dist 100, mid (200,300) → worldAnchor (0, −300)
      move(1, 100, 400);
      move(2, 300, 400); // dist 200 → zoom 2, mid (200,400)
      expect(camera.zoom).toBe(2);
      // rawY = −300 + (400−300)/2 = −250 > max −300 → 저항: −300 + 50×0.2 = −290
      expect(camera.position.y).toBe(-290);
      expect(camera.position.x).toBe(0); // vertical에서 x 불변
    });

    it('E5: 추적되지 않은 pointerId의 move/up은 무시된다', () => {
      const { onPanRelease, onPinchRelease, onChange } = createControl();
      move(99, 100, 300); // down 없는 move
      up(99, 100, 300); // down 없는 up
      expect(camera.position.x).toBe(0);
      expect(onChange).not.toHaveBeenCalled();
      expect(onPanRelease).not.toHaveBeenCalled();
      expect(onPinchRelease).not.toHaveBeenCalled();
    });

    it('E6: enablePinchZoom=false에서 첫 손가락 up 후 남은 손가락 move는 카메라를 바꾸지 않는다', () => {
      const { onPanRelease } = createControl({ enablePinchZoom: false });
      down(1, 200, 300);
      down(2, 300, 300); // pinch 비활성 → 두 번째 포인터는 무시
      up(1, 200, 300); // panStart는 pointer 1 기준으로 남음
      move(2, 100, 300); // 죽은 panStart 앵커 → updatePan 가드로 무시
      expect(camera.position.x).toBe(0);
      up(2, 100, 300); // 마지막 up에서 release는 발화
      expect(onPanRelease).toHaveBeenCalledTimes(1);
      expect(onPanRelease).toHaveBeenCalledWith(0); // 이동 반영 없음 → 원위치
    });

    it('E7: 제스처 중 destroy — 캡처된 포인터가 일괄 release된다 (m-5)', () => {
      const setCapture = vi.fn();
      const releaseCapture = vi.fn();
      Object.assign(root, {
        setPointerCapture: setCapture,
        releasePointerCapture: releaseCapture,
      });
      const { control: c } = createControl();
      down(1, 200, 300);
      expect(setCapture).toHaveBeenCalledWith(1);
      c.destroy();
      expect(releaseCapture).toHaveBeenCalledWith(1);
    });
  });
});
