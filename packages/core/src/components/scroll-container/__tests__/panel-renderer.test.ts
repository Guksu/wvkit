import { afterEach, describe, expect, it } from 'vitest';
import { createCamera } from '../camera';
import { createPanelRenderer } from '../panel-renderer';

/**
 * PanelRenderer 단위 테스트 — three.js CSS3DRenderer를 대체한 CSS transform 렌더러.
 *
 * 카메라 → scene transform 수식(`matrix-utils.ts` 규약)과 패널 부착/숨김/복원 계약을 고정한다.
 *   scene: translate(width/2 − cameraX·zoom, height/2 + cameraY·zoom) scale(zoom)
 *   panel: translate(x, −y) translate(−50%, −50%)
 */

function makePanels(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('div');
    el.dataset.idx = String(i);
    return el;
  });
}

describe('createPanelRenderer', () => {
  let root: HTMLElement;
  afterEach(() => {
    root?.remove();
  });

  it('R1: domElement > scene 구조, setSize가 두 노드에 px 크기를 기록한다', () => {
    root = document.createElement('div');
    const r = createPanelRenderer(makePanels(2));
    root.appendChild(r.domElement);
    r.setSize(400, 600);
    expect(r.domElement.firstChild).toBe(r.sceneElement);
    expect(r.domElement.style.width).toBe('400px');
    expect(r.domElement.style.height).toBe('600px');
    expect(r.sceneElement.style.width).toBe('400px');
    expect(r.sceneElement.style.height).toBe('600px');
    expect(r.domElement.style.overflow).toBe('hidden');
    r.destroy();
  });

  it('R2: setPanelPosition은 월드 y를 부호 반전해 translate(x, −y) translate(−50%, −50%)로 쓴다', () => {
    const panels = makePanels(2);
    const r = createPanelRenderer(panels);
    r.setPanelPosition(0, 400, 0);
    r.setPanelPosition(1, 0, -300);
    expect(panels[0]?.style.transform).toBe('translate(400px, 0px) translate(-50%, -50%)');
    expect(panels[1]?.style.transform).toBe('translate(0px, 300px) translate(-50%, -50%)');
    r.destroy();
  });

  it('R3: 패널은 처음 visible=true일 때만 scene에 붙고, false면 display:none (미부착 패널은 여전히 문서 밖)', () => {
    const panels = makePanels(3);
    const r = createPanelRenderer(panels);
    r.setPanelVisible(0, true);
    r.setPanelVisible(1, false);
    expect(panels[0]?.parentNode).toBe(r.sceneElement);
    expect(panels[0]?.style.display).toBe('');
    expect(panels[1]?.parentNode).toBeNull(); // lazy 이미지가 요청되지 않도록 붙이지 않는다
    expect(panels[1]?.style.display).toBe('none');
    expect(panels[2]?.parentNode).toBeNull();
    r.setPanelVisible(1, true);
    expect(panels[1]?.parentNode).toBe(r.sceneElement);
    expect(panels[1]?.style.display).toBe('');
    r.setPanelVisible(0, false);
    expect(panels[0]?.parentNode).toBe(r.sceneElement); // 한 번 붙은 패널은 떼지 않고 숨긴다
    expect(panels[0]?.style.display).toBe('none');
    r.destroy();
  });

  it('R4: render는 카메라 위치·zoom을 scene transform 한 줄로 옮기고, 값이 같으면 DOM을 다시 쓰지 않는다', () => {
    const r = createPanelRenderer(makePanels(1));
    r.setSize(400, 600);
    const camera = createCamera();
    r.render(camera);
    // 카메라 (0,0) zoom 1 → 화면 중심으로 평행이동만
    expect(r.sceneElement.style.transform).toBe('translate(200px, 300px) scale(1)');

    camera.position.x = 400;
    camera.position.y = -300;
    camera.zoom = 2;
    r.render(camera);
    // translate(200 − 400×2, 300 + (−300)×2) = translate(−600, −300)
    expect(r.sceneElement.style.transform).toBe('translate(-600px, -300px) scale(2)');

    // 같은 카메라로 다시 render → 외부에서 바꾼 값이 유지된다 (캐시 히트, DOM 미기록)
    r.sceneElement.style.transform = 'none';
    r.render(camera);
    expect(r.sceneElement.style.transform).toBe('none');
    r.destroy();
  });

  it('R5: 수식 검증 — 패널 중심의 화면 좌표가 (worldX − camX)·zoom + w/2 로 떨어진다', () => {
    // 패널 1 (x=400) 을 zoom 1.5 로 보는 카메라 x=400 → 패널 중심은 화면 중심(200, 300)
    // 패널 2 (x=800) → 화면 x = (800 − 400)×1.5 + 200 = 800
    const r = createPanelRenderer(makePanels(3));
    r.setSize(400, 600);
    const camera = createCamera(1.5);
    camera.position.x = 400;
    r.render(camera);
    const m = r.sceneElement.style.transform.match(
      /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/,
    );
    expect(m).not.toBeNull();
    const tx = Number(m?.[1]);
    const scale = Number(m?.[3]);
    const screenX = (panelX: number) => tx + panelX * scale;
    expect(screenX(400)).toBe(200);
    expect(screenX(800)).toBe(800);
    r.destroy();
  });

  it('R6: destroy는 패널을 scene에서 떼고 인라인 스타일·draggable을 원래대로 되돌린 뒤 domElement를 제거한다', () => {
    root = document.createElement('div');
    document.body.appendChild(root);
    const panels = makePanels(2);
    const p0 = panels[0] as HTMLElement;
    p0.style.position = 'relative';
    p0.style.transform = 'rotate(1deg)';
    p0.setAttribute('draggable', 'true');
    const r = createPanelRenderer(panels);
    root.appendChild(r.domElement);
    r.setPanelPosition(0, 0, 0);
    r.setPanelVisible(0, true);
    r.setPanelVisible(1, false);
    expect(p0.style.position).toBe('absolute');
    expect(p0.style.userSelect).toBe('none');
    expect(p0.getAttribute('draggable')).toBe('false');

    r.destroy();
    expect(root.contains(r.domElement)).toBe(false);
    expect(p0.parentNode).toBeNull();
    expect(p0.style.position).toBe('relative');
    expect(p0.style.transform).toBe('rotate(1deg)');
    expect(p0.style.userSelect).toBe('');
    expect(p0.getAttribute('draggable')).toBe('true');
    expect(panels[1]?.style.display).toBe('');
    expect(panels[1]?.hasAttribute('draggable')).toBe(false);
  });

  it('R7: 좌표는 소수 셋째 자리로 반올림해 기록한다 (부동소수 잔여 제거, −0 없음)', () => {
    const panels = makePanels(1);
    const r = createPanelRenderer(panels);
    r.setSize(400, 600);
    r.setPanelPosition(0, 1e-12, -1e-12);
    expect(panels[0]?.style.transform).toBe('translate(0px, 0px) translate(-50%, -50%)');
    const camera = createCamera();
    camera.position.x = 1e-12;
    r.render(camera);
    expect(r.sceneElement.style.transform).toBe('translate(200px, 300px) scale(1)');
    camera.position.x = 1 / 3;
    camera.zoom = 1.23456789;
    r.render(camera);
    // 200 − (1/3)×1.23456789 = 199.588477 → 199.588
    expect(r.sceneElement.style.transform).toBe('translate(199.588px, 300px) scale(1.235)');
    r.destroy();
  });
});
