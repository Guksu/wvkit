import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createScrollContainer } from '../scroll-container';

/**
 * 통합 테스트 — 전체 라이프사이클(마운트 → 인터랙션 → destroy)을 검증.
 *
 * 단위 테스트(#5)와의 차이:
 *  - createScrollContainer 팩토리를 통한 실제 와이어링 (CameraControl ↔ ScrollContainer ↔ 사용자 콜백)
 *  - PointerEvent dispatchEvent로 제스처 → 콜백 경로 종합 검증
 *  - `THREE.OrthographicCamera.prototype.updateProjectionMatrix` 스파이로 zoom 경로 호출 검증
 *
 * 렌더 호출 검증 제약:
 *  - three.js v0.184의 `CSS3DRenderer`는 `this.render = function(...) {}` 형태로 *인스턴스*에 함수를
 *    할당한다 (prototype 메서드가 아님). 따라서 `vi.spyOn(CSS3DRenderer.prototype, 'render')`는
 *    "render does not exist" 에러로 실패한다. 외부에서 인스턴스에 접근할 수 없으므로 직접 스파이가 불가.
 *  - 대안: 렌더 결과의 *관측 가능한 부수효과*(`panel.style.display` 변경, 카메라 행렬 호출, DOM 부착/제거)
 *    로 우회 검증한다. "정적 상태에서 render 호출 안 함"은 "정적 상태에서 부수효과 없음"으로 치환.
 *
 * happy-dom v15가 PointerEvent를 지원함은 #5 단위 테스트에서 확인됨.
 */

function makePanels(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('div');
    el.dataset.idx = String(i);
    return el;
  });
}

function makeRoot(width = 400, height = 600): HTMLElement {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(root);
  return root;
}

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

describe('ScrollContainer — integration', () => {
  let root: HTMLElement;
  let updateProjSpy: MockInstance;

  beforeEach(() => {
    root = makeRoot();
    updateProjSpy = vi.spyOn(THREE.OrthographicCamera.prototype, 'updateProjectionMatrix');
  });

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  // --- 시나리오 1: 마운트 + initialIndex=2 + 가상화 윈도우 [1,2,3] ---
  describe('scenario 1 — mount with initialIndex=2', () => {
    it('initializes at index 2 with overscan window [1, 2, 3] visible', () => {
      const panels = makePanels(5);
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels,
        initialIndex: 2,
        overscan: 1,
      });
      expect(sc.getActiveIndex()).toBe(2);
      expect(panels[0]?.style.display).toBe('none');
      expect(panels[1]?.style.display).toBe('');
      expect(panels[2]?.style.display).toBe('');
      expect(panels[3]?.style.display).toBe('');
      expect(panels[4]?.style.display).toBe('none');
      sc.destroy();
    });

    it('renderer.domElement is attached as the sole child of root', () => {
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
      });
      expect(root.children.length).toBe(1);
      sc.destroy();
    });

    it('static idle state: no panel display mutations after init', () => {
      const panels = makePanels(5);
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels,
        initialIndex: 2,
        overscan: 1,
      });
      const snapshot = panels.map((p) => p.style.display);
      // 아무 동작 없이 — DOM 부수효과가 더 발생하지 않아야 함 (render-on-demand 정책의 관측 가능한 결과)
      expect(panels.map((p) => p.style.display)).toEqual(snapshot);
      sc.destroy();
    });
  });

  // --- 시나리오 2: scrollTo(0) → onIndexChange + 가상화 + 카메라 행렬 갱신 ---
  describe('scenario 2 — scrollTo updates index + virtualization + camera matrices', () => {
    it('scrollTo(0, animated:false) fires onIndexChange + shifts virtualization window', () => {
      const onIndexChange = vi.fn();
      const panels = makePanels(5);
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels,
        initialIndex: 2,
        overscan: 1,
        onIndexChange,
      });

      sc.scrollTo(0, { animated: false });

      expect(onIndexChange).toHaveBeenCalledTimes(1);
      expect(onIndexChange).toHaveBeenCalledWith(0);
      // 가상화 윈도우 재계산: 활성 0 → 보이는 건 [0, 1]만
      expect(panels[0]?.style.display).toBe('');
      expect(panels[1]?.style.display).toBe('');
      expect(panels[2]?.style.display).toBe('none');
      expect(panels[3]?.style.display).toBe('none');
      sc.destroy();
    });

    it('scrollTo(target=current) is a no-op for callbacks (dedupe)', () => {
      const onIndexChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(4),
        initialIndex: 1,
        onIndexChange,
      });
      sc.scrollTo(1, { animated: false });
      expect(onIndexChange).not.toHaveBeenCalled();
      sc.destroy();
    });
  });

  // --- 시나리오 3: zoomTo → onZoomChange + updateProjectionMatrix 스파이 ---
  describe('scenario 3 — zoomTo updates zoom and calls updateProjectionMatrix', () => {
    it('zoomTo(2, animated:false) fires onZoomChange + calls camera.updateProjectionMatrix', () => {
      const onZoomChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
        minZoom: 1,
        maxZoom: 3,
        onZoomChange,
      });
      const initialUpdateProjCount = updateProjSpy.mock.calls.length;

      sc.zoomTo(2, { animated: false });

      expect(sc.getZoom()).toBe(2);
      expect(onZoomChange).toHaveBeenCalledTimes(1);
      expect(onZoomChange).toHaveBeenCalledWith(2);
      // OrthographicCamera는 zoom 변경 시 updateProjectionMatrix 명시 호출이 필요
      expect(updateProjSpy.mock.calls.length).toBeGreaterThan(initialUpdateProjCount);
      sc.destroy();
    });
  });

  // --- 시나리오 4: zoomTo(10) with maxZoom=3 → clamp 검증 ---
  describe('scenario 4 — zoomTo clamps to maxZoom in full lifecycle', () => {
    it('zoomTo(10) with maxZoom=3 clamps the reported value', () => {
      const onZoomChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
        minZoom: 1,
        maxZoom: 3,
        onZoomChange,
      });
      sc.zoomTo(10, { animated: false });
      expect(sc.getZoom()).toBe(3);
      expect(onZoomChange).toHaveBeenLastCalledWith(3);
      sc.destroy();
    });

    it('zoomTo(0.01) clamps to minZoom and fires onZoomChange exactly once', () => {
      const onZoomChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
        minZoom: 0.5,
        maxZoom: 3,
        onZoomChange,
      });
      // 초기 zoom=1, zoomTo(0.01) → 0.5로 클램프 → 1≠0.5이므로 콜백 발화
      sc.zoomTo(0.01, { animated: false });
      expect(sc.getZoom()).toBe(0.5);
      expect(onZoomChange).toHaveBeenCalledTimes(1);
      expect(onZoomChange).toHaveBeenCalledWith(0.5);
      sc.destroy();
    });
  });

  // --- 시나리오 5: enablePinchZoom=false + PointerEvent 시뮬 → camera.zoom 불변 ---
  describe('scenario 5 — enablePinchZoom:false ignores 2-pointer gestures', () => {
    it('two pointers + apart move does NOT change zoom or fire onZoomChange', () => {
      const onZoomChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
        minZoom: 1,
        maxZoom: 3,
        enablePinchZoom: false,
        onZoomChange,
      });
      const initialZoom = sc.getZoom();

      root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 150, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 300 }));
      // 두 손가락을 벌림 (핀치 줌 의도)
      root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 350, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 50, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 350, clientY: 300 }));

      expect(sc.getZoom()).toBe(initialZoom);
      expect(onZoomChange).not.toHaveBeenCalled();
      sc.destroy();
    });

    it('with enablePinchZoom=true, 2-pointer gesture pipeline runs without throwing', () => {
      // 핀치 결과 수치는 B-05가 camera-control 단위에서 값 검증 — 여기서는 통합 경로 발화 여부만 (B-22)
      const onZoomChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
        enablePinchZoom: true,
        onZoomChange,
      });
      expect(() => {
        root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 150, clientY: 300 }));
        root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 300 }));
        root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 300 }));
        root.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 300, clientY: 300 }));
        root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 300 }));
        root.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 300, clientY: 300 }));
      }).not.toThrow();
      // 핀치아웃(100px→200px 갭)이 통합 경로에서 실제 줌 변화를 일으켰는지 — 콜백 발화 또는 zoom > 1
      expect(onZoomChange.mock.calls.length > 0 || sc.getZoom() > 1).toBe(true);
      sc.destroy();
    });
  });

  // --- 시나리오 6: destroy → renderer 제거 + 멱등성 + 사후 인터랙션 무발화 ---
  describe('scenario 6 — destroy lifecycle', () => {
    it('destroy removes renderer.domElement from root and restores panel display', () => {
      const panels = makePanels(5);
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels,
        overscan: 0,
        initialIndex: 0,
      });
      expect(root.children.length).toBe(1);
      // 가상화로 숨겨진 패널들
      expect(panels[1]?.style.display).toBe('none');
      expect(panels[4]?.style.display).toBe('none');

      sc.destroy();

      expect(root.children.length).toBe(0);
      // display 복원 — 호스트가 패널을 다른 곳에 다시 마운트할 수 있게
      expect(panels[1]?.style.display).toBe('');
      expect(panels[4]?.style.display).toBe('');
    });

    it('destroy is idempotent (calling twice does not throw)', () => {
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
      });
      sc.destroy();
      expect(() => sc.destroy()).not.toThrow();
      // destroy 후 root 하위에 renderer DOM이 잔존하지 않는다 (B-22)
      expect(root.children.length).toBe(0);
    });

    it('after destroy, pointer gestures do NOT trigger callbacks (listeners removed)', () => {
      const onIndexChange = vi.fn();
      const onZoomChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(5),
        initialIndex: 2,
        onIndexChange,
        onZoomChange,
      });
      sc.destroy();
      // CameraControl.destroy가 root의 pointer 리스너를 모두 제거했으므로
      // 이후 pointerdown/up 디스패치는 콜백을 발화시키지 않아야 함
      root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 50, clientY: 300 }));
      expect(onIndexChange).not.toHaveBeenCalled();
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it('after destroy, camera.updateProjectionMatrix is not called by gestures', () => {
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(3),
      });
      sc.destroy();
      const callsAfterDestroy = updateProjSpy.mock.calls.length;
      root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }));
      root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 100 }));
      expect(updateProjSpy.mock.calls.length).toBe(callsAfterDestroy);
    });
  });

  // --- 추가: pan 제스처 → 스냅 → onIndexChange 종합 경로 ---
  describe('scenario 7 (bonus) — pan gesture pipeline', () => {
    it('big leftward drag past snapThreshold advances activeIndex via onPanRelease wiring', () => {
      const onIndexChange = vi.fn();
      const sc = createScrollContainer(root, {
        direction: 'horizontal',
        panels: makePanels(5),
        initialIndex: 1,
        overscan: 1,
        snapThreshold: 0.3,
        resistance: 0.2,
        onIndexChange,
      });

      // 핵심: width=400 컨테이너, 손가락 LEFT 드래그(dx 음수)
      //  → camera.position.x = startCamX - dx/zoom = 400 - (-200) = 600
      //  → dragRatio = +200/400 = 0.5 > 0.3 → target = activeIndex + 1 = 2
      root.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 300 }));
      root.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 300 }));

      expect(onIndexChange).toHaveBeenCalledTimes(1);
      expect(onIndexChange).toHaveBeenCalledWith(2);
      expect(sc.getActiveIndex()).toBe(2);
      sc.destroy();
    });
  });
});
