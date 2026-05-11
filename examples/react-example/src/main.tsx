import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useSafeArea, useScrollLock, useVirtualKeyboard } from '@wvkit/react';

function SafeAreaDemo() {
  const { top, right, bottom, left } = useSafeArea();
  const rows: [string, number][] = [['top', top], ['right', right], ['bottom', bottom], ['left', left]];
  return (
    <section>
      <h2 style={{ margin: '0 0 8px' }}>useSafeArea</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key}>
              <td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: 80 }}>{key}</td>
              <td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{value}px</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ScrollLockDemo() {
  const { lock, unlock, isLocked } = useScrollLock();
  return (
    <section>
      <h2 style={{ margin: '0 0 8px' }}>useScrollLock</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555' }}>
        상태: <strong style={{ color: isLocked ? '#c62828' : '#2e7d32' }}>{isLocked ? '잠금' : '해제'}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={lock} disabled={isLocked}
          style={{ padding: '8px 16px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, opacity: isLocked ? 0.5 : 1 }}>
          스크롤 잠금
        </button>
        <button onClick={unlock} disabled={!isLocked}
          style={{ padding: '8px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, opacity: !isLocked ? 0.5 : 1 }}>
          스크롤 해제
        </button>
      </div>
      {Array.from({ length: 15 }, (_, i) => (
        <p key={i} style={{ margin: '4px 0', fontSize: 13, color: '#bbb' }}>스크롤 테스트 {i + 1}</p>
      ))}
    </section>
  );
}

function VirtualKeyboardDemo() {
  const { isOpen, keyboardHeight } = useVirtualKeyboard();
  return (
    <section>
      <h2 style={{ margin: '0 0 8px' }}>useVirtualKeyboard</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold', width: 120 }}>isOpen</td>
            <td style={{ padding: '6px 12px', border: '1px solid #ddd', color: isOpen ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
              {String(isOpen)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #ddd', fontWeight: 'bold' }}>keyboardHeight</td>
            <td style={{ padding: '6px 12px', border: '1px solid #ddd' }}>{keyboardHeight}px</td>
          </tr>
        </tbody>
      </table>
      <input
        type="text"
        placeholder="탭해서 키보드 열기"
        style={{ width: '100%', padding: '10px 12px', fontSize: 16, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}
      />
      <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        인풋에 포커스하면 isOpen / keyboardHeight가 갱신됩니다
      </p>
    </section>
  );
}

function App() {
  return (
    <div style={{ fontFamily: 'monospace', padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>wvkit 데모</h1>
      <SafeAreaDemo />
      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />
      <ScrollLockDemo />
      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />
      <VirtualKeyboardDemo />
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
