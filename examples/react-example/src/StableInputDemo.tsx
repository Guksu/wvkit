import { useState } from 'react';
import { useStableInput, StableInputDisplay } from '@guksu/wvkit-react';
import { DemoCard } from './ui';
import { useLang } from './LangContext';

export function StableInputDemo() {
  const [value, setValue] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const { tr } = useLang();
  const s = tr.stableInput;

  const addLog = (msg: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 4)]);

  const inputProps = useStableInput({
    placeholder: s.placeholder,
    onChange: (v) => setValue(v),
    onFocus: () => addLog('onFocus'),
    onBlur: () => addLog('onBlur'),
    onSubmit: (v) => addLog(`onSubmit("${v}")`),
    suppressLayoutShift: true,
    scrollAnchor: 'bottom',
  });

  return (
    <DemoCard title={s.title} description={s.description} note={s.note}>
      <StableInputDisplay
        {...inputProps}
        style={{
          display: 'block', width: '100%',
          border: '1.5px solid #e5e7eb', borderRadius: 8,
          padding: '12px 14px', fontSize: 16,
          boxSizing: 'border-box', fontFamily: 'inherit',
          cursor: 'text', background: '#fff',
        }}
      />

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => inputProps.focus()} style={btn}>
          focus()
        </button>
        <button
          type="button"
          onClick={() => { inputProps.setValue('Hello, WebView!'); setValue('Hello, WebView!'); }}
          style={btn}
        >
          {s.setValueBtn}
        </button>
      </div>

      {value && (
        <p style={{ marginTop: 12, fontSize: 13, color: '#374151' }}>
          value: <code style={code}>{value}</code>
        </p>
      )}

      {log.length > 0 && (
        <div style={logBox}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {s.eventLog}
          </p>
          {log.map((entry) => (
            <p key={entry} style={{ margin: '3px 0', fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>
              {entry}
            </p>
          ))}
        </div>
      )}
    </DemoCard>
  );
}

const btn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13,
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  background: '#fff', cursor: 'pointer',
  fontFamily: 'inherit', color: '#374151',
};
const code: React.CSSProperties = {
  background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 13,
};
const logBox: React.CSSProperties = {
  marginTop: 12, background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px',
};
