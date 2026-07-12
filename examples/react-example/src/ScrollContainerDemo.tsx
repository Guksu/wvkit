import { useMemo, useState } from 'react';
import { useScrollContainer } from '@guksu/wvkit-react/scroll-container';
import type { ScrollContainerDirection } from '@guksu/wvkit-react';
import { DemoCard, ControlGrid, ControlItem, DataRow, inputStyle, selectStyle, checkboxRowStyle } from './ui';
import { useLang } from './LangContext';

const PANEL_COUNT = 6;
const PANEL_LABELS = ['Hello', 'World', 'Three', 'Four', 'Five', 'Six'];
const PANEL_CONTENT_MULTIPLIERS = [1, 2, 4, 1, 8, 1.5];

function buildPanels(noScroll: string, verticalScroll: (n: number) => string, end: string): HTMLElement[] {
  return Array.from({ length: PANEL_COUNT }, (_, i) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      width: '100%', height: '100%',
      background: `hsl(${(i * 360) / PANEL_COUNT}, 55%, 68%)`,
      color: '#fff', fontFamily: 'system-ui, sans-serif',
      userSelect: 'none', overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y',
    });

    const multiplier = PANEL_CONTENT_MULTIPLIERS[i] ?? 1;
    const inner = document.createElement('div');
    Object.assign(inner.style, {
      minHeight: `${multiplier * 100}%`, padding: '24px 20px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      gap: '14px', alignItems: 'center',
    });

    const num = document.createElement('div');
    num.textContent = String(i);
    Object.assign(num.style, { fontSize: '72px', fontWeight: '800', lineHeight: '1', opacity: '0.9' });

    const label = document.createElement('div');
    label.textContent = PANEL_LABELS[i] ?? `Panel ${i}`;
    Object.assign(label.style, { fontSize: '18px', fontWeight: '600', opacity: '0.85' });

    const hint = document.createElement('div');
    hint.textContent = multiplier <= 1 ? noScroll : verticalScroll(multiplier);
    Object.assign(hint.style, { fontSize: '11px', opacity: '0.65', marginTop: '2px' });

    inner.appendChild(num);
    inner.appendChild(label);
    inner.appendChild(hint);

    if (multiplier > 1) {
      const count = Math.max(0, Math.round((multiplier - 1) * 6));
      for (let k = 1; k <= count; k++) {
        const item = document.createElement('div');
        item.textContent = `item ${k}`;
        Object.assign(item.style, {
          width: '70%', padding: '10px 14px', background: 'rgba(0,0,0,0.18)',
          borderRadius: '8px', fontSize: '13px', textAlign: 'center',
        });
        inner.appendChild(item);
      }
      const tail = document.createElement('div');
      tail.textContent = end;
      Object.assign(tail.style, { fontSize: '11px', opacity: '0.55', marginTop: '4px' });
      inner.appendChild(tail);
    }

    el.appendChild(inner);
    return el;
  });
}

interface DemoOptions {
  direction: ScrollContainerDirection; overscan: number;
  snapThreshold: number; resistance: number;
  minZoom: number; maxZoom: number; enablePinchZoom: boolean;
}

function ScrollContainerInstance(props: DemoOptions) {
  const { tr } = useLang();
  const sc = tr.scrollContainer;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 패널은 최초 마운트 시점의 라벨로 1회만 빌드한다(언어 전환 시 재빌드하지 않음 — 데모 의도).
  const panels = useMemo(() => buildPanels(sc.noScroll, sc.verticalScroll, sc.end), []);

  const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } = useScrollContainer({
    direction: props.direction, panels, initialIndex: 0,
    overscan: props.overscan, snapThreshold: props.snapThreshold,
    resistance: props.resistance, minZoom: props.minZoom,
    maxZoom: props.maxZoom, enablePinchZoom: props.enablePinchZoom,
  });

  return (
    <>
      <div ref={containerRef} style={canvasStyle} data-testid="sc-canvas" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <DataRow label="activeIndex" value={String(activeIndex)} />
        <DataRow label="activeZoom" value={activeZoom.toFixed(3)} />
        <DataRow label="direction" value={props.direction} />
      </div>

      <p style={sectionLabel}>{tr.scrollTo}</p>
      <div style={btnGrid}>
        {[0, 2, PANEL_COUNT - 1].map((idx) => (
          <button key={`a-${idx}`} type="button" onClick={() => scrollTo(idx, { animated: true })} style={actionBtn}>
            scrollTo({idx}) ✦
          </button>
        ))}
        {[0, 2, PANEL_COUNT - 1].map((idx) => (
          <button key={`i-${idx}`} type="button" onClick={() => scrollTo(idx, { animated: false })} style={{ ...actionBtn, ...actionBtnOutline }}>
            scrollTo({idx})
          </button>
        ))}
      </div>

      <p style={sectionLabel}>{tr.zoomTo}</p>
      <div style={btnGrid}>
        {[1, 2, 3].map((z) => (
          <button key={`za-${z}`} type="button" onClick={() => zoomTo(z, { animated: true })} style={actionBtn}>
            zoomTo({z}) ✦
          </button>
        ))}
        {[1, 2, 3].map((z) => (
          <button key={`zi-${z}`} type="button" onClick={() => zoomTo(z, { animated: false })} style={{ ...actionBtn, ...actionBtnOutline }}>
            zoomTo({z})
          </button>
        ))}
      </div>
    </>
  );
}

export function ScrollContainerDemo() {
  const [direction, setDirection] = useState<ScrollContainerDirection>('horizontal');
  const [overscan, setOverscan] = useState(1);
  const [snapThreshold, setSnapThreshold] = useState(0.3);
  const [resistance, setResistance] = useState(0.2);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [enablePinchZoom, setEnablePinchZoom] = useState(true);

  const { tr } = useLang();
  const s = tr.scrollContainer;
  const c = tr.controls;

  const remountKey = [direction, overscan, snapThreshold, resistance, minZoom, maxZoom, enablePinchZoom].join('|');

  return (
    <DemoCard title={s.title} description={s.description} note={s.note}>
      <ControlGrid>
        <ControlItem label={c.direction}>
          <select data-testid="ctl-direction" value={direction} onChange={(e) => setDirection(e.target.value as ScrollContainerDirection)} style={selectStyle}>
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
            <option value="both">both</option>
          </select>
        </ControlItem>
        <ControlItem label={c.overscan(overscan)}>
          <input type="range" min={0} max={3} step={1} value={overscan}
            onChange={(e) => setOverscan(Number(e.target.value))} />
        </ControlItem>
        <ControlItem label={c.snapThreshold}>
          <input type="number" min={0.05} max={1} step={0.05} value={snapThreshold}
            onChange={(e) => setSnapThreshold(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.resistance}>
          <input type="number" min={0} max={1} step={0.05} value={resistance}
            onChange={(e) => setResistance(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.minZoom}>
          <input type="number" min={0.1} max={5} step={0.1} value={minZoom}
            onChange={(e) => setMinZoom(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.maxZoom}>
          <input type="number" min={0.1} max={10} step={0.5} value={maxZoom}
            onChange={(e) => setMaxZoom(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.enablePinchZoom} span>
          <label style={checkboxRowStyle}>
            <input data-testid="ctl-enable-pinch-zoom" type="checkbox" checked={enablePinchZoom} onChange={(e) => setEnablePinchZoom(e.target.checked)} />
            <span style={{ fontSize: 13 }}>{String(enablePinchZoom)}</span>
          </label>
        </ControlItem>
      </ControlGrid>

      <ScrollContainerInstance key={remountKey} direction={direction} overscan={overscan}
        snapThreshold={snapThreshold} resistance={resistance}
        minZoom={minZoom} maxZoom={maxZoom} enablePinchZoom={enablePinchZoom} />
    </DemoCard>
  );
}

const canvasStyle: React.CSSProperties = {
  width: '100%', height: 320, position: 'relative',
  background: '#111', overflow: 'hidden', touchAction: 'none', borderRadius: 10,
};
const sectionLabel: React.CSSProperties = {
  margin: '16px 0 6px', fontSize: 11, fontWeight: 700,
  color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em',
};
const btnGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 };
const actionBtn: React.CSSProperties = {
  padding: '8px 4px', fontSize: 11, fontWeight: 600,
  border: 'none', borderRadius: 8, background: '#4f46e5',
  color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
};
const actionBtnOutline: React.CSSProperties = {
  background: '#fff', color: '#4f46e5', border: '1.5px solid #4f46e5',
};
