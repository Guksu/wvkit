import { useCallback, useState } from 'react';
import { usePullToRefresh } from '@guksu/wvkit-react';
import type { PullToRefreshState } from '@guksu/wvkit-react';
import { DemoCard, ControlGrid, ControlItem, DataRow, inputStyle, checkboxRowStyle } from './ui';
import { useLang } from './LangContext';

const INITIAL_ITEMS = Array.from({ length: 20 }, (_, i) => ({ id: `seed-${i}`, label: `Item ${i}` }));
interface ListItem { id: string; label: string; }

interface DemoOptions {
  threshold: number; maxDistance: number; resistance: number;
  enabled: boolean; disableOverscrollContain: boolean;
}

const indicatorColor = (state: PullToRefreshState) => {
  if (state === 'armed') return '#4f46e5';
  if (state === 'refreshing') return '#f59e0b';
  if (state === 'resetting') return '#22c55e';
  return '#9ca3af';
};

function PullToRefreshInstance(props: DemoOptions & { items: ListItem[]; onRefresh: () => Promise<void> }) {
  const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
    onRefresh: props.onRefresh,
    threshold: props.threshold, maxDistance: props.maxDistance,
    resistance: props.resistance, enabled: props.enabled,
    disableOverscrollContain: props.disableOverscrollContain,
  });
  const { tr } = useLang();
  const s = tr.pullToRefresh;

  const indicatorText = (st: PullToRefreshState, prog: number) => {
    if (st === 'idle') return s.idle;
    if (st === 'pulling') return s.pulling(Math.min(100, Math.round(prog * 100)));
    if (st === 'armed') return s.armed;
    if (st === 'refreshing') return s.refreshing;
    if (st === 'resetting') return s.resetting;
    return '';
  };

  return (
    <>
      <div style={previewWrap}>
        <div style={{
          ...indicator, color: indicatorColor(state),
          transform: `translateY(${Math.max(-48, distance - 48)}px)`,
          transition: (state === 'idle' || state === 'resetting') ? 'transform 0.2s ease-out' : 'none',
        }}>
          {indicatorText(state, progress)}
        </div>
        <div ref={containerRef} style={listWrap}>
          {props.items.map((item) => (
            <div key={item.id} style={{ ...listItem, color: item.id.startsWith('refresh-') ? '#4f46e5' : '#374151' }}>
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <DataRow label="state" value={state} valueColor={indicatorColor(state)} />
        <DataRow label="distance" value={`${Math.round(distance)}px`} />
        <DataRow label="progress" value={progress.toFixed(2)} />
      </div>

      <button type="button" onClick={() => { void trigger(); }} style={triggerBtn}>
        {s.triggerBtn}
      </button>
    </>
  );
}

export function PullToRefreshDemo() {
  const [threshold, setThreshold] = useState(60);
  const [maxDistance, setMaxDistance] = useState(120);
  const [resistance, setResistance] = useState(0.5);
  const [enabled, setEnabled] = useState(true);
  const [disableOverscrollContain, setDisableOverscrollContain] = useState(false);
  const [items, setItems] = useState<ListItem[]>(INITIAL_ITEMS);

  const { tr } = useLang();
  const s = tr.pullToRefresh;
  const c = tr.controls;

  const remountKey = [threshold, maxDistance, resistance, enabled, disableOverscrollContain].join('|');

  const handleRefresh = useCallback(async () => {
    await new Promise<void>((r) => setTimeout(r, 1500));
    const now = new Date().toLocaleTimeString();
    setItems((prev) => [{ id: `refresh-${Date.now()}`, label: `Refreshed at ${now}` }, ...prev]);
  }, []);

  return (
    <DemoCard title={s.title} description={s.description} note={s.note}>
      <ControlGrid>
        <ControlItem label={c.threshold}>
          <input type="number" min={10} max={200} step={5} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.maxDistance}>
          <input type="number" min={20} max={300} step={10} value={maxDistance}
            onChange={(e) => setMaxDistance(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.resistance}>
          <input type="number" min={0} max={1} step={0.1} value={resistance}
            onChange={(e) => setResistance(Number(e.target.value))} style={inputStyle} />
        </ControlItem>
        <ControlItem label={c.enabled}>
          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span style={{ fontSize: 13 }}>{String(enabled)}</span>
          </label>
        </ControlItem>
        <ControlItem label={c.disableOverscrollContain} span>
          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={disableOverscrollContain}
              onChange={(e) => setDisableOverscrollContain(e.target.checked)} />
            <span style={{ fontSize: 13 }}>{String(disableOverscrollContain)}</span>
          </label>
        </ControlItem>
      </ControlGrid>

      <PullToRefreshInstance
        key={remountKey}
        threshold={threshold} maxDistance={maxDistance} resistance={resistance}
        enabled={enabled} disableOverscrollContain={disableOverscrollContain}
        items={items} onRefresh={handleRefresh}
      />
    </DemoCard>
  );
}

const previewWrap: React.CSSProperties = {
  position: 'relative', height: 280, borderRadius: 10,
  border: '1px solid #e5e7eb', overflow: 'hidden', background: '#fff',
};
const indicator: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 48,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
  fontSize: 13, fontWeight: 600, pointerEvents: 'none', zIndex: 1,
};
const listWrap: React.CSSProperties = {
  position: 'absolute', inset: 0, overflowY: 'auto',
  background: '#fff', touchAction: 'pan-y',
};
const listItem: React.CSSProperties = {
  padding: '11px 14px', borderBottom: '1px solid #f3f4f6',
  fontSize: 13, fontFamily: 'monospace',
};
const triggerBtn: React.CSSProperties = {
  marginTop: 12, width: '100%', padding: '11px', fontSize: 13,
  fontWeight: 600, border: '1.5px solid #4f46e5', borderRadius: 8,
  background: '#fff', color: '#4f46e5', cursor: 'pointer', fontFamily: 'inherit',
};
