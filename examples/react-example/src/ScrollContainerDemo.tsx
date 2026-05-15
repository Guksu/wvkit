import { useMemo, useState } from 'react';
import { useScrollContainer } from '@wvkit/react';
import type { ScrollContainerDirection } from '@wvkit/react';

/**
 * ScrollContainer 데모.
 *
 * 핵심 패턴:
 *  - 패널은 `document.createElement`로 미리 만든 HTMLElement[] 를 ScrollContainer에 넘김
 *    (React JSX로 렌더하지 않음 — CSS3DRenderer가 자체 DOM 트리에 배치하기 때문)
 *  - 옵션이 변경되면 컨테이너를 완전히 재마운트 (key prop) — useScrollContainer는 마운트
 *    시점의 옵션을 고정하기 때문
 *  - visiblePanelCount는 hook이 직접 노출하지 않으니 `min(panelCount, 2*overscan + 1)`로 추정
 */

const PANEL_COUNT = 6;
const PANEL_LABELS = ['Hello', 'World', 'Three', 'Four', 'Five', 'Six'];

function buildPanels(): HTMLElement[] {
  return Array.from({ length: PANEL_COUNT }, (_, i) => {
    const el = document.createElement('div');
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.background = `hsl(${(i * 360) / PANEL_COUNT}, 60%, 70%)`;
    el.style.color = '#fff';
    el.style.fontFamily = 'monospace';
    el.style.userSelect = 'none';

    const num = document.createElement('div');
    num.textContent = String(i);
    num.style.fontSize = '72px';
    num.style.fontWeight = '700';
    num.style.lineHeight = '1';

    const label = document.createElement('div');
    label.textContent = PANEL_LABELS[i] ?? `Panel ${i}`;
    label.style.fontSize = '18px';
    label.style.marginTop = '12px';
    label.style.opacity = '0.8';

    el.appendChild(num);
    el.appendChild(label);
    return el;
  });
}

interface DemoOptions {
  direction: ScrollContainerDirection;
  overscan: number;
  snapThreshold: number;
  resistance: number;
  minZoom: number;
  maxZoom: number;
  enablePinchZoom: boolean;
}

/**
 * 내부 컴포넌트 — 옵션이 props로 들어오고, 마운트 시점에 useScrollContainer에 고정 전달.
 * 부모가 key prop을 바꾸면 React가 통째로 unmount/remount → 새 옵션으로 재초기화.
 */
function ScrollContainerInstance(props: DemoOptions): JSX.Element {
  // 한 번만 생성 (마운트 동안 동일 DOM 노드 유지)
  const panels = useMemo(() => buildPanels(), []);

  const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
    direction: props.direction,
    panels,
    initialIndex: 0,
    overscan: props.overscan,
    snapThreshold: props.snapThreshold,
    resistance: props.resistance,
    minZoom: props.minZoom,
    maxZoom: props.maxZoom,
    enablePinchZoom: props.enablePinchZoom,
  });

  // visiblePanelCount 추정: 양쪽 overscan + 활성 패널, 패널 총 수로 클램프
  const visiblePanelCount = Math.min(PANEL_COUNT, 2 * props.overscan + 1);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 360,
          position: 'relative',
          background: '#111',
          overflow: 'hidden',
          touchAction: 'none', // pointer 제스처가 브라우저 스크롤로 새지 않게
          borderRadius: 8,
        }}
      />
      <pre
        style={{
          margin: '12px 0 0',
          padding: 10,
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#333',
        }}
      >
        {JSON.stringify(
          {
            activeIndex,
            activeZoom: Number(activeZoom.toFixed(3)),
            visiblePanelCount,
            direction: props.direction,
            overscan: props.overscan,
            enablePinchZoom: props.enablePinchZoom,
          },
          null,
          2,
        )}
      </pre>

      <h3 style={{ margin: '16px 0 6px', fontSize: 14 }}>scrollTo</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <button type="button" onClick={() => scrollTo(0, { animated: true })} style={btnStyle}>
          scrollTo(0) animated
        </button>
        <button type="button" onClick={() => scrollTo(2, { animated: true })} style={btnStyle}>
          scrollTo(2) animated
        </button>
        <button type="button" onClick={() => scrollTo(PANEL_COUNT - 1, { animated: true })} style={btnStyle}>
          scrollTo(last) animated
        </button>
        <button type="button" onClick={() => scrollTo(0, { animated: false })} style={btnStyle}>
          scrollTo(0) instant
        </button>
        <button type="button" onClick={() => scrollTo(2, { animated: false })} style={btnStyle}>
          scrollTo(2) instant
        </button>
        <button
          type="button"
          onClick={() => scrollTo(PANEL_COUNT - 1, { animated: false })}
          style={btnStyle}
        >
          scrollTo(last) instant
        </button>
      </div>

      <h3 style={{ margin: '16px 0 6px', fontSize: 14 }}>zoomTo</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <button type="button" onClick={() => zoomTo(1, { animated: true })} style={btnStyle}>
          zoomTo(1) animated
        </button>
        <button type="button" onClick={() => zoomTo(2, { animated: true })} style={btnStyle}>
          zoomTo(2) animated
        </button>
        <button type="button" onClick={() => zoomTo(3, { animated: true })} style={btnStyle}>
          zoomTo(3) animated
        </button>
        <button type="button" onClick={() => zoomTo(1, { animated: false })} style={btnStyle}>
          zoomTo(1) instant
        </button>
        <button type="button" onClick={() => zoomTo(2, { animated: false })} style={btnStyle}>
          zoomTo(2) instant
        </button>
        <button type="button" onClick={() => zoomTo(3, { animated: false })} style={btnStyle}>
          zoomTo(3) instant
        </button>
      </div>
    </>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 6px',
  fontSize: 11,
  border: '1px solid #ddd',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'monospace',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: 12,
  color: '#555',
  gap: 2,
};

const inputStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: 13,
  border: '1px solid #ccc',
  borderRadius: 4,
  fontFamily: 'monospace',
};

export function ScrollContainerDemo(): JSX.Element {
  const [direction, setDirection] = useState<ScrollContainerDirection>('horizontal');
  const [overscan, setOverscan] = useState(1);
  const [snapThreshold, setSnapThreshold] = useState(0.3);
  const [resistance, setResistance] = useState(0.2);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [enablePinchZoom, setEnablePinchZoom] = useState(true);

  // 옵션 변경 시 컨테이너 재마운트 (useScrollContainer는 마운트 시점 옵션 고정)
  const remountKey = [
    direction,
    overscan,
    snapThreshold,
    resistance,
    minZoom,
    maxZoom,
    enablePinchZoom,
  ].join('|');

  return (
    <section>
      <h2 style={{ margin: '0 0 8px' }}>ScrollContainer</h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#777' }}>
        손가락 드래그/마우스 드래그로 패널 전환 · 두 손가락 핀치 줌 · 옵션 변경 시 자동 재마운트
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 16,
          padding: 10,
          background: '#fafafa',
          borderRadius: 6,
          border: '1px solid #eee',
        }}
      >
        <label style={labelStyle}>
          <span>direction</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as ScrollContainerDirection)}
            style={inputStyle}
          >
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
            <option value="both">both (1차 horizontal 폴백)</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span>overscan: {overscan}</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={overscan}
            onChange={(e) => setOverscan(Number(e.target.value))}
          />
        </label>

        <label style={labelStyle}>
          <span>snapThreshold</span>
          <input
            type="number"
            min={0.05}
            max={1}
            step={0.05}
            value={snapThreshold}
            onChange={(e) => setSnapThreshold(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>resistance</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={resistance}
            onChange={(e) => setResistance(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>minZoom</span>
          <input
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            value={minZoom}
            onChange={(e) => setMinZoom(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>maxZoom</span>
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.5}
            value={maxZoom}
            onChange={(e) => setMaxZoom(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={{ ...labelStyle, gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={enablePinchZoom}
            onChange={(e) => setEnablePinchZoom(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          <span>enablePinchZoom</span>
        </label>
      </div>

      <ScrollContainerInstance
        key={remountKey}
        direction={direction}
        overscan={overscan}
        snapThreshold={snapThreshold}
        resistance={resistance}
        minZoom={minZoom}
        maxZoom={maxZoom}
        enablePinchZoom={enablePinchZoom}
      />
    </section>
  );
}
