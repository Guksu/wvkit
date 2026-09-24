import type { PanCamera } from './camera';

/**
 * 패널을 CSS transform으로 배치하는 렌더러 (three.js CSS3DRenderer 대체).
 *
 * DOM 구조:
 *   root
 *   └─ domElement   position:absolute; overflow:hidden; width/height = root 크기
 *      └─ scene     position:absolute; width/height = root 크기; transform-origin 0 0
 *         └─ panel  position:absolute; transform: translate(x, −y) translate(−50%, −50%)
 *
 * 카메라 → 화면 매핑 (`matrix-utils.ts`의 규약과 동일):
 *   screenX = (worldX − cameraX) × zoom + width / 2
 *   screenY = −(worldY − cameraY) × zoom + height / 2
 * 이를 scene 하나의 transform으로 표현한다:
 *   translate(width/2 − cameraX·zoom, height/2 + cameraY·zoom) scale(zoom)
 *
 * 패널은 처음 보이는 순간에만 scene에 붙인다(그 전까지는 문서 밖). 숨길 때는 `display:none`.
 * — 붙지 않은 패널의 `loading="lazy"` 이미지는 요청되지 않으므로 가상화 효과가 유지된다.
 */
export interface PanelRenderer {
  /** root에 붙는 렌더 표면. */
  readonly domElement: HTMLElement;
  /** 카메라 transform이 기록되는 노드 (패널들의 부모). */
  readonly sceneElement: HTMLElement;
  setSize(width: number, height: number): void;
  /** 패널 중심의 월드 좌표. */
  setPanelPosition(index: number, x: number, y: number): void;
  /**
   * 패널 폭(px)을 인라인으로 지정한다 (`panelWidth` 옵션). `null` 이면 원래 인라인 폭으로 되돌린다.
   * 지정하지 않은 패널은 건드리지 않는다 — 폭은 앱 CSS(보통 `width: 100%`)가 정한다.
   */
  setPanelWidth(index: number, width: number | null): void;
  /** 가상화 창 안/밖 토글. 처음 true가 될 때 scene에 붙는다. */
  setPanelVisible(index: number, visible: boolean): void;
  /** 카메라 상태를 scene transform에 반영. 값이 같으면 DOM을 건드리지 않는다. */
  render(camera: PanCamera): void;
  /** 패널을 scene에서 떼고 인라인 스타일을 원래대로, domElement를 제거. */
  destroy(): void;
}

interface SavedPanelStyle {
  width: string;
  position: string;
  left: string;
  top: string;
  transform: string;
  display: string;
  userSelect: string;
  draggable: string | null;
}

/** 소수 셋째 자리로 반올림 — 부동소수 잔여(199.999999999999px 등)를 transform 문자열에 남기지 않는다. */
function round3(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return r === 0 ? 0 : r; // −0 → 0
}

export function createPanelRenderer(panels: ReadonlyArray<HTMLElement>): PanelRenderer {
  const domElement = document.createElement('div');
  // 레이아웃 필수 인라인 스타일 (CLAUDE.md 예외): 렌더 표면을 root 좌상단에 오버레이.
  domElement.style.position = 'absolute';
  domElement.style.top = '0';
  domElement.style.left = '0';
  domElement.style.overflow = 'hidden';

  const sceneElement = document.createElement('div');
  sceneElement.style.position = 'absolute';
  sceneElement.style.top = '0';
  sceneElement.style.left = '0';
  sceneElement.style.transformOrigin = '0 0';
  sceneElement.style.willChange = 'transform';
  domElement.appendChild(sceneElement);

  let width = 1;
  let height = 1;
  let lastSceneTransform = '';

  const saved: SavedPanelStyle[] = panels.map((panel) => ({
    width: panel.style.width,
    position: panel.style.position,
    left: panel.style.left,
    top: panel.style.top,
    transform: panel.style.transform,
    display: panel.style.display,
    userSelect: panel.style.userSelect,
    draggable: panel.getAttribute('draggable'),
  }));

  for (const panel of panels) {
    panel.style.position = 'absolute';
    panel.style.left = '0';
    panel.style.top = '0';
    // 드래그 중 텍스트 선택·이미지 드래그가 pan을 끊지 않도록 (CSS3DObject와 동일한 기본값)
    panel.style.userSelect = 'none';
    panel.setAttribute('draggable', 'false');
  }

  function setSize(w: number, h: number): void {
    width = w;
    height = h;
    domElement.style.width = `${w}px`;
    domElement.style.height = `${h}px`;
    // 패널의 `width: 100%` 등이 root 크기를 기준으로 풀리도록 scene도 같은 크기로.
    sceneElement.style.width = `${w}px`;
    sceneElement.style.height = `${h}px`;
  }

  function setPanelPosition(index: number, x: number, y: number): void {
    const panel = panels[index];
    if (!panel) return;
    // 월드 +y는 위, CSS +y는 아래 → y 부호 반전. translate(−50%,−50%)로 패널 중심을 좌표에 맞춘다.
    panel.style.transform = `translate(${round3(x)}px, ${round3(-y)}px) translate(-50%, -50%)`;
  }

  function setPanelWidth(index: number, w: number | null): void {
    const panel = panels[index];
    if (!panel) return;
    panel.style.width = w === null ? (saved[index]?.width ?? '') : `${round3(w)}px`;
  }

  function setPanelVisible(index: number, visible: boolean): void {
    const panel = panels[index];
    if (!panel) return;
    if (visible) {
      if (panel.parentNode !== sceneElement) sceneElement.appendChild(panel);
      panel.style.display = '';
    } else {
      panel.style.display = 'none';
    }
  }

  function render(camera: PanCamera): void {
    const z = camera.zoom;
    const tx = round3(width / 2 - camera.position.x * z);
    const ty = round3(height / 2 + camera.position.y * z);
    const transform = `translate(${tx}px, ${ty}px) scale(${round3(z)})`;
    if (transform === lastSceneTransform) return;
    lastSceneTransform = transform;
    sceneElement.style.transform = transform;
  }

  function destroy(): void {
    panels.forEach((panel, i) => {
      if (panel.parentNode === sceneElement) sceneElement.removeChild(panel);
      const s = saved[i];
      if (!s) return;
      panel.style.width = s.width;
      panel.style.position = s.position;
      panel.style.left = s.left;
      panel.style.top = s.top;
      panel.style.transform = s.transform;
      panel.style.display = s.display;
      panel.style.userSelect = s.userSelect;
      if (s.draggable === null) panel.removeAttribute('draggable');
      else panel.setAttribute('draggable', s.draggable);
    });
    domElement.remove();
  }

  return {
    domElement,
    sceneElement,
    setSize,
    setPanelPosition,
    setPanelWidth,
    setPanelVisible,
    render,
    destroy,
  };
}
