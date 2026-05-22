import { useScrollLock } from '@guksu/wvkit-react';
import { DemoCard } from './ui';

export function ScrollLockDemo() {
  const { lock, unlock, isLocked } = useScrollLock();

  return (
    <DemoCard
      title="useScrollLock"
      description="레이아웃 이동 없이 body 스크롤을 잠급니다. 모달·드로어·바텀시트가 열릴 때 배경이 스크롤되는 현상을 방지합니다."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ ...statusDot, background: isLocked ? '#ef4444' : '#22c55e' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: isLocked ? '#ef4444' : '#22c55e' }}>
          {isLocked ? '스크롤 잠금 중' : '스크롤 활성'}
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

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
        잠금 후 페이지를 스크롤해보세요. body가 움직이지 않습니다.
      </p>
    </DemoCard>
  );
}

const statusDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
};

const btn: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
};

const btnDanger: React.CSSProperties = {
  background: '#fee2e2',
  color: '#dc2626',
};

const btnSuccess: React.CSSProperties = {
  background: '#dcfce7',
  color: '#16a34a',
};
