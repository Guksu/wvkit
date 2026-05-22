import { useSafeArea } from '@guksu/wvkit-react';
import { DemoCard, DataRow } from './ui';

export function SafeAreaDemo() {
  const { top, right, bottom, left } = useSafeArea();

  return (
    <DemoCard
      title="useSafeArea"
      description="env(safe-area-inset-*) CSS 값을 JavaScript로 읽어 반응형으로 제공합니다. 노치·다이나믹 아일랜드·홈 인디케이터 인셋을 JS에서 직접 활용할 수 있습니다."
      note="실제 WebView(노치 기기)에서 확인하면 0이 아닌 값이 표시됩니다."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DataRow label="top" value={`${top}px`} />
        <DataRow label="right" value={`${right}px`} />
        <DataRow label="bottom" value={`${bottom}px`} />
        <DataRow label="left" value={`${left}px`} />
      </div>

      <div style={visualStyle}>
        <div style={{ ...insetIndicator, top: 0, left: 0, right: 0, height: Math.max(top, 2), background: top > 0 ? token.primary : token.border }} />
        <div style={{ ...insetIndicator, bottom: 0, left: 0, right: 0, height: Math.max(bottom, 2), background: bottom > 0 ? token.primary : token.border }} />
        <div style={{ ...insetIndicator, top: 0, left: 0, bottom: 0, width: Math.max(left, 2), background: left > 0 ? token.primary : token.border }} />
        <div style={{ ...insetIndicator, top: 0, right: 0, bottom: 0, width: Math.max(right, 2), background: right > 0 ? token.primary : token.border }} />
        <span style={{ fontSize: 12, color: token.textMuted }}>safe area 시각화</span>
      </div>
    </DemoCard>
  );
}

const token = {
  primary: '#4f46e5',
  border: '#e5e7eb',
  textMuted: '#9ca3af',
};

const visualStyle: React.CSSProperties = {
  position: 'relative',
  marginTop: 16,
  height: 80,
  borderRadius: 8,
  border: `1px solid ${token.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  background: '#fafafa',
};

const insetIndicator: React.CSSProperties = {
  position: 'absolute',
  minWidth: 2,
  minHeight: 2,
  opacity: 0.4,
};
