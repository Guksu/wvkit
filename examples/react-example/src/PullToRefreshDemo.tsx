import { useCallback, useState } from 'react';
import { usePullToRefresh } from '@wvkit/react';
import type { PullToRefreshState } from '@wvkit/react';

/**
 * PullToRefresh 데모.
 *
 * 핵심 패턴:
 *  - 옵션은 마운트 시점 고정이므로 옵션 변경 시 `key` prop 으로 인스턴스 재마운트
 *  - 인디케이터는 D2(헤드리스 정통) 정책에 따라 사용자가 직접 렌더링
 *    (distance / progress / state → translateY + 텍스트 매핑)
 *  - items 상태는 부모에 두어 옵션 변경 시 리스트가 리셋되지 않게 유지
 */

const INITIAL_ITEMS = Array.from({ length: 20 }, (_, i) => ({
  id: `seed-${i}`,
  label: `Item ${i}`,
}));

interface ListItem {
  id: string;
  label: string;
}

interface DemoOptions {
  threshold: number;
  maxDistance: number;
  resistance: number;
  enabled: boolean;
  disableOverscrollContain: boolean;
}

interface InstanceProps extends DemoOptions {
  items: ListItem[];
  onRefresh: () => Promise<void>;
}

const indicatorTextFor = (state: PullToRefreshState, progress: number): string => {
  switch (state) {
    case 'idle':
      return '↓ 당겨서 새로고침';
    case 'pulling':
      return `↓ 당기는 중 (${Math.min(100, Math.round(progress * 100))}%)`;
    case 'armed':
      return '↑ 놓으면 새로고침';
    case 'refreshing':
      return '⟳ 새로고침 중…';
    case 'resetting':
      return '✓ 완료';
    default:
      return '';
  }
};

const indicatorColorFor = (state: PullToRefreshState): string => {
  switch (state) {
    case 'armed':
      return '#0066cc';
    case 'refreshing':
      return '#ff6b35';
    case 'resetting':
      return '#2e7d32';
    default:
      return '#888';
  }
};

function PullToRefreshInstance(props: InstanceProps): JSX.Element {
  const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
    onRefresh: props.onRefresh,
    threshold: props.threshold,
    maxDistance: props.maxDistance,
    resistance: props.resistance,
    enabled: props.enabled,
    disableOverscrollContain: props.disableOverscrollContain,
  });

  return (
    <>
      <div
        style={{
          position: 'relative',
          height: 300,
          marginBottom: 8,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #ddd',
        }}
      >
        {/* 인디케이터: 컨테이너 상단에 absolute, distance만큼 translateY */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5faff',
            borderBottom: '1px solid #e0eef9',
            color: indicatorColorFor(state),
            fontSize: 14,
            fontWeight: 600,
            transform: `translateY(${Math.max(-60, distance - 60)}px)`,
            transition: state === 'idle' || state === 'resetting' ? 'transform 0.2s ease-out' : 'none',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {indicatorTextFor(state, progress)}
        </div>

        {/* 스크롤 컨테이너 */}
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
            background: '#fff',
            touchAction: 'pan-y',
          }}
        >
          {props.items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                fontSize: 14,
                fontFamily: 'monospace',
                color: item.id.startsWith('refresh-') ? '#0066cc' : '#333',
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <pre
        style={{
          margin: '0 0 10px',
          padding: 10,
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#333',
        }}
      >
        {JSON.stringify(
          {
            state,
            distance: Math.round(distance),
            progress: Number(progress.toFixed(2)),
            enabled: props.enabled,
          },
          null,
          2,
        )}
      </pre>

      <button
        type="button"
        onClick={() => {
          void trigger();
        }}
        style={triggerBtnStyle}
      >
        Trigger refresh manually
      </button>
    </>
  );
}

const triggerBtnStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 13,
  fontFamily: 'monospace',
  border: '1px solid #0066cc',
  borderRadius: 4,
  background: '#fff',
  color: '#0066cc',
  cursor: 'pointer',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: 12,
  color: '#555',
  gap: 2,
};

const inputStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: 13,
  border: '1px solid #ccc',
  borderRadius: 4,
  fontFamily: 'monospace',
};

export function PullToRefreshDemo(): JSX.Element {
  const [threshold, setThreshold] = useState(60);
  const [maxDistance, setMaxDistance] = useState(120);
  const [resistance, setResistance] = useState(0.5);
  const [enabled, setEnabled] = useState(true);
  const [disableOverscrollContain, setDisableOverscrollContain] = useState(false);

  // 옵션 변경 시 재마운트 (key prop 트릭)
  const remountKey = [threshold, maxDistance, resistance, enabled, disableOverscrollContain].join(
    '|',
  );

  // items는 옵션 변경에 영향 받지 않도록 부모에 보관
  const [items, setItems] = useState<ListItem[]>(INITIAL_ITEMS);

  const handleRefresh = useCallback(async () => {
    // 1.5초 비동기 시뮬
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    const now = new Date().toLocaleTimeString();
    const stamp = Date.now();
    setItems((prev) => [
      { id: `refresh-${stamp}`, label: `Refreshed at ${now}` },
      ...prev,
    ]);
  }, []);

  return (
    <section>
      <h2 style={{ margin: '0 0 8px' }}>PullToRefresh</h2>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#777' }}>
        스크롤이 맨 위일 때 아래로 당기면 새로고침. 헤드리스 콜백(`distance` / `state`) → 인디케이터는 사용자가 직접 렌더링.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 16,
          padding: 10,
          background: '#fafafa',
          borderRadius: 6,
          border: '1px solid #eee',
        }}
      >
        <label style={labelStyle}>
          <span>threshold</span>
          <input
            type="number"
            min={10}
            max={200}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>maxDistance</span>
          <input
            type="number"
            min={20}
            max={300}
            step={10}
            value={maxDistance}
            onChange={(e) => setMaxDistance(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>resistance</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={resistance}
            onChange={(e) => setResistance(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label
          style={{
            ...labelStyle,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>enabled</span>
        </label>

        <label
          style={{
            ...labelStyle,
            gridColumn: '1 / -1',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={disableOverscrollContain}
            onChange={(e) => setDisableOverscrollContain(e.target.checked)}
          />
          <span>disableOverscrollContain (native PTR 차단 끄기)</span>
        </label>
      </div>

      <PullToRefreshInstance
        key={remountKey}
        threshold={threshold}
        maxDistance={maxDistance}
        resistance={resistance}
        enabled={enabled}
        disableOverscrollContain={disableOverscrollContain}
        items={items}
        onRefresh={handleRefresh}
      />
    </section>
  );
}
