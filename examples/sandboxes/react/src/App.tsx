import { StableInputDisplay, usePullToRefresh, useStableInput } from '@guksu/wvkit-react';
import { useState } from 'react';

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

export function App() {
  // --- PullToRefresh ---
  const [items, setItems] = useState<string[]>(() => [
    'Pull down inside the list to refresh',
    'Works on touch devices and DevTools mobile emulation',
  ]);

  const { containerRef, state, distance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setItems((prev) => [`#${prev.length + 1} — refreshed at ${formatTime(new Date())}`, ...prev]);
    },
  });

  // --- StableInput ---
  const [value, setValue] = useState('');
  const inputProps = useStableInput({
    placeholder: 'Type here — layout stays put on iOS',
    onChange: (v) => setValue(v),
  });

  return (
    <div className="app">
      <h1>wvkit sandbox (React)</h1>

      <section className="section">
        <h2>PullToRefresh — headless pull-to-refresh</h2>
        <div ref={containerRef} className="ptr-container">
          {/* Headless: you render the indicator yourself. progress goes 0 → 1 → beyond */}
          <div
            className="ptr-indicator"
            style={{ opacity: progress, transform: `translateY(${distance}px)` }}
          >
            {state === 'refreshing' ? 'Refreshing…' : state === 'armed' ? 'Release to refresh' : 'Pull to refresh'}
          </div>
          {items.map((item) => (
            <div key={item} className="ptr-item">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>StableInput — iOS keyboard layout-shift prevention</h2>
        <StableInputDisplay {...inputProps} className="stable-input-display" />
        <p className="value-echo">value: {value || '(empty)'}</p>
      </section>
    </div>
  );
}
