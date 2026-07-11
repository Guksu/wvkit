import { useScrollLock } from '@guksu/wvkit-react';
import { DemoCard } from './ui';
import { useLang } from './LangContext';

export function ScrollLockDemo() {
  const { lock, unlock, isLocked } = useScrollLock();
  // 2번째 인스턴스 — 중첩 lock의 prev-값 복원 의미론(e2e TC-24-02) 검증용
  const { lock: lock2, unlock: unlock2, isLocked: isLocked2 } = useScrollLock();
  const { tr } = useLang();
  const s = tr.scrollLock;

  return (
    <DemoCard title={s.title} description={s.description}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ ...dot, background: isLocked ? '#ef4444' : '#22c55e' }} />
        <span
          style={{ fontSize: 14, fontWeight: 600, color: isLocked ? '#ef4444' : '#22c55e' }}
          data-testid="lock-status"
          data-locked={isLocked ? 'true' : 'false'}
        >
          {isLocked ? s.locked : s.unlocked}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={lock}
          disabled={isLocked}
          style={{ ...btn, ...btnDanger, opacity: isLocked ? 0.4 : 1 }}
          data-testid="lock-btn"
        >
          lock()
        </button>
        <button
          type="button"
          onClick={unlock}
          disabled={!isLocked}
          style={{ ...btn, ...btnSuccess, opacity: !isLocked ? 0.4 : 1 }}
          data-testid="unlock-btn"
        >
          unlock()
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 12px' }}>
        <div style={{ ...dot, background: isLocked2 ? '#ef4444' : '#22c55e' }} />
        <span
          style={{ fontSize: 14, fontWeight: 600, color: isLocked2 ? '#ef4444' : '#22c55e' }}
          data-testid="lock2-status"
          data-locked={isLocked2 ? 'true' : 'false'}
        >
          #2 {isLocked2 ? s.locked : s.unlocked}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={lock2}
          disabled={isLocked2}
          style={{ ...btn, ...btnDanger, opacity: isLocked2 ? 0.4 : 1 }}
          data-testid="lock2-btn"
        >
          lock() #2
        </button>
        <button
          type="button"
          onClick={unlock2}
          disabled={!isLocked2}
          style={{ ...btn, ...btnSuccess, opacity: !isLocked2 ? 0.4 : 1 }}
          data-testid="unlock2-btn"
        >
          unlock() #2
        </button>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>{s.hint}</p>

      {/* body를 실제 스크롤 가능하게 만드는 스페이서 — unlock 위치 복원(e2e TC-24-01) 검증용 */}
      <div data-testid="scroll-spacer" style={{ height: 1600 }} />
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
