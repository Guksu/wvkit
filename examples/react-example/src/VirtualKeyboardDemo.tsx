import { useVirtualKeyboard } from '@guksu/wvkit-react';
import { DemoCard, DataRow } from './ui';

export function VirtualKeyboardDemo() {
  const { isOpen, keyboardHeight } = useVirtualKeyboard();

  return (
    <DemoCard
      title="useVirtualKeyboard"
      description="visualViewport 리사이즈 델타를 분석해 소프트 키보드의 열림/닫힘 상태와 높이를 추론합니다. iOS·Android 각각에 맞는 휴리스틱이 내장되어 있습니다."
      note="아래 인풋을 탭하면 키보드 상태 변화를 확인할 수 있습니다."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <DataRow
          label="isOpen"
          value={String(isOpen)}
          valueColor={isOpen ? '#4f46e5' : '#6b7280'}
        />
        <DataRow label="keyboardHeight" value={`${keyboardHeight}px`} />
      </div>

      {isOpen && (
        <div style={keyboardBar}>
          <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
            키보드 감지됨 — {keyboardHeight}px
          </span>
        </div>
      )}

      <input
        type="text"
        placeholder="탭해서 키보드 열기"
        style={inputStyle}
      />
    </DemoCard>
  );
}

const keyboardBar: React.CSSProperties = {
  background: '#eef2ff',
  border: '1px solid #c7d2fe',
  borderRadius: 8,
  padding: '8px 12px',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 16,
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};
