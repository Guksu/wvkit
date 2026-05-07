import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useSafeArea } from '@wvkit/react';

function App() {
  const { top, right, bottom, left } = useSafeArea();

  return (
    <div style={{ fontFamily: 'monospace', padding: '16px' }}>
      <h1>useSafeArea 테스트</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {[
            ['top', top],
            ['right', right],
            ['bottom', bottom],
            ['left', left],
          ].map(([key, value]) => (
            <tr key={key as string}>
              <td style={{ padding: '8px', border: '1px solid #ccc', fontWeight: 'bold' }}>{key}</td>
              <td style={{ padding: '8px', border: '1px solid #ccc' }}>{value}px</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '24px', fontSize: '14px', color: '#666' }}>
        기기를 회전하거나 화면 크기를 바꾸면 값이 갱신됩니다.
      </p>

      <div
        style={{
          marginTop: '24px',
          background: '#f0f0f0',
          paddingTop: top,
          paddingRight: right,
          paddingBottom: bottom,
          paddingLeft: left,
        }}
      >
        <div style={{ background: '#4caf50', color: '#fff', padding: '12px', borderRadius: '4px' }}>
          이 영역은 safe area inset만큼 padding이 적용됩니다
        </div>
      </div>
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
