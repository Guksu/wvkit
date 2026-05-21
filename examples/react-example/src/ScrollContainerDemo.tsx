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
// 패널별 내부 콘텐츠 높이 배율 (컨테이너 높이 대비). 가로 swipe + 패널별 독립 세로 스크롤 검증용.
const PANEL_CONTENT_MULTIPLIERS = [1, 2, 4, 1, 8, 1.5];

function buildPanels(): HTMLElement[] {
  return Array.from({ length: PANEL_COUNT }, (_, i) => {
    const el = document.createElement('div');
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.background = `hsl(${(i * 360) / PANEL_COUNT}, 60%, 70%)`;
    el.style.color = '#fff';
    el.style.fontFamily = 'monospace';
    el.style.userSelect = 'none';
    // 내부 세로 스크롤 허용. touch-action: pan-y 로 vertical 제스처는 브라우저가 처리,
    // 부모 ScrollContainer의 horizontal 제스처와 자연 분리.
    el.style.overflowY = 'auto';
    el.style.overflowX = 'hidden';
    el.style.touchAction = 'pan-y';

    const multiplier = PANEL_CONTENT_MULTIPLIERS[i] ?? 1;

    // 내부 콘텐츠: 컨테이너의 multiplier 배수 높이
    const inner = document.createElement('div');
    inner.style.minHeight = `${multiplier * 100}%`;
    inner.style.padding = '20px';
    inner.style.boxSizing = 'border-box';
    inner.style.display = 'flex';
    inner.style.flexDirection = 'column';
    inner.style.gap = '16px';
    inner.style.alignItems = 'center';

    // 헤더: 인덱스 + 라벨 + 스크롤 길이 안내
    const header = document.createElement('div');
    header.style.textAlign = 'center';

    const num = document.createElement('div');
    num.textContent = String(i);
    num.style.fontSize = '72px';
    num.style.fontWeight = '700';
    num.style.lineHeight = '1';

    const label = document.createElement('div');
    label.textContent = PANEL_LABELS[i] ?? `Panel ${i}`;
    label.style.fontSize = '18px';
    label.style.marginTop = '8px';
    label.style.opacity = '0.85';

    const scrollHint = document.createElement('div');
    scrollHint.textContent =
      multiplier <= 1 ? '세로 스크롤 없음' : `세로 스크롤 ${multiplier}× (위/아래로 드래그)`;
    scrollHint.style.fontSize = '11px';
    scrollHint.style.marginTop = '6px';
    scrollHint.style.opacity = '0.7';

    header.appendChild(num);
    header.appendChild(label);
    header.appendChild(scrollHint);
    inner.appendChild(header);

    // 스크롤 가시화: multiplier가 1보다 크면 일렬로 번호 박스 추가
    if (multiplier > 1) {
      const itemCount = Math.max(0, Math.round((multiplier - 1) * 6));
      for (let k = 1; k <= itemCount; k++) {
        const item = document.createElement('div');
        item.textContent = `item ${k}`;
        item.style.width = '70%';
        item.style.padding = '10px 14px';
        item.style.background = 'rgba(0,0,0,0.18)';
        item.style.borderRadius = '6px';
        item.style.fontSize = '13px';
        item.style.textAlign = 'center';
        inner.appendChild(item);
      }

      // 끝 표시
      const tail = document.createElement('div');
      tail.textContent = '— end —';
      tail.style.fontSize = '11px';
      tail.style.opacity = '0.6';
      tail.style.marginTop = '8px';
      inner.appendChild(tail);
    }

    el.appendChild(inner);
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
