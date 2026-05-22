import { useSafeArea } from '@guksu/wvkit-react';
import { DemoCard, DataRow } from './ui';
import { useLang } from './LangContext';

export function SafeAreaDemo() {
  const { top, right, bottom, left } = useSafeArea();
  const { tr } = useLang();
  const s = tr.safeArea;

  return (
    <DemoCard title={s.title} description={s.description} note={s.note}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DataRow label="top" value={`${top}px`} />
        <DataRow label="right" value={`${right}px`} />
        <DataRow label="bottom" value={`${bottom}px`} />
        <DataRow label="left" value={`${left}px`} />
      </div>

      <div style={visualStyle}>
        <div style={{ ...inset, top: 0, left: 0, right: 0, height: Math.max(top, 2), background: top > 0 ? PRIMARY : BORDER }} />
        <div style={{ ...inset, bottom: 0, left: 0, right: 0, height: Math.max(bottom, 2), background: bottom > 0 ? PRIMARY : BORDER }} />
        <div style={{ ...inset, top: 0, left: 0, bottom: 0, width: Math.max(left, 2), background: left > 0 ? PRIMARY : BORDER }} />
        <div style={{ ...inset, top: 0, right: 0, bottom: 0, width: Math.max(right, 2), background: right > 0 ? PRIMARY : BORDER }} />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{s.visualization}</span>
      </div>
    </DemoCard>
  );
}

const PRIMARY = '#4f46e5';
const BORDER = '#e5e7eb';

const visualStyle: React.CSSProperties = {
  position: 'relative', marginTop: 16, height: 80,
  borderRadius: 8, border: `1px solid ${BORDER}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  overflow: 'hidden', background: '#fafafa',
};

const inset: React.CSSProperties = {
  position: 'absolute', minWidth: 2, minHeight: 2, opacity: 0.4,
};
