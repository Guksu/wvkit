import { useVirtualKeyboard } from '@guksu/wvkit-react';
import { DemoCard, DataRow } from './ui';
import { useLang } from './LangContext';

export function VirtualKeyboardDemo() {
  const { isOpen, keyboardHeight } = useVirtualKeyboard();
  const { tr } = useLang();
  const s = tr.virtualKeyboard;

  return (
    <DemoCard title={s.title} description={s.description} note={s.note}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <DataRow label="isOpen" value={String(isOpen)} valueColor={isOpen ? '#4f46e5' : '#6b7280'} />
        <DataRow label="keyboardHeight" value={`${keyboardHeight}px`} />
      </div>

      {isOpen && (
        <div style={detectedBar}>
          <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
            {s.detected} — {keyboardHeight}px
          </span>
        </div>
      )}

      <input type="text" placeholder={s.placeholder} style={inputStyle} data-testid="vk-input" />
    </DemoCard>
  );
}

const detectedBar: React.CSSProperties = {
  background: '#eef2ff', border: '1px solid #c7d2fe',
  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 16,
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};
