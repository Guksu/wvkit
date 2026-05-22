import { useScrollLock } from '@guksu/wvkit-react';
import { DemoCard } from './ui';
import { useLang } from './LangContext';

export function ScrollLockDemo() {
  const { lock, unlock, isLocked } = useScrollLock();
  const { tr } = useLang();
  const s = tr.scrollLock;

  return (
    <DemoCard title={s.title} description={s.description}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ ...dot, background: isLocked ? '#ef4444' : '#22c55e' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: isLocked ? '#ef4444' : '#22c55e' }}>
          {isLocked ? s.locked : s.unlocked}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={lock} disabled={isLocked} style={{ ...btn, ...btnDanger, opacity: isLocked ? 0.4 : 1 }}>
          lock()
        </button>
        <button type="button" onClick={unlock} disabled={!isLocked} style={{ ...btn, ...btnSuccess, opacity: !isLocked ? 0.4 : 1 }}>
          unlock()
        </button>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>{s.hint}</p>
    </DemoCard>
  );
}

const dot: React.CSSProperties = { width: 10, height: 10, borderRadius: '50%' };

const btn: React.CSSProperties = {
  padding: '10px 20px', fontSize: 13, fontWeight: 600,
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'inherit', transition: 'opacity 0.15s',
};
const btnDanger: React.CSSProperties = { background: '#fee2e2', color: '#dc2626' };
const btnSuccess: React.CSSProperties = { background: '#dcfce7', color: '#16a34a' };
