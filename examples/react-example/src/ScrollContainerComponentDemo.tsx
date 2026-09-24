import {
  ScrollContainer,
  type ScrollContainerHandle,
  ScrollPanel,
} from '@guksu/wvkit-react/scroll-container';
import { useRef, useState } from 'react';
import { useLang } from './LangContext';
import { DataRow, DemoCard } from './ui';

/**
 * 컴포넌트 API 데모 — `panels` 배열 없이 JSX 자식으로 패널을 쓴다.
 * 패널을 앞에 추가하면 보던 패널이 그대로 남고, 각 패널의 세로 스크롤 위치도 유지된다.
 */

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
/** 패널마다 세로로 스크롤할 줄 번호 */
const ROWS = Array.from({ length: 30 }, (_, k) => k + 1);

interface Item {
  id: number;
  title: string;
}

export function ScrollContainerComponentDemo() {
  const { tr } = useLang();
  const s = tr.scrollContainerComponent;
  const nextId = useRef(4);
  const [items, setItems] = useState<Item[]>(() =>
    [1, 2, 3].map((id) => ({ id, title: `${s.panel} ${id}` })),
  );
  const [index, setIndex] = useState(0);
  const sc = useRef<ScrollContainerHandle>(null);

  const add = () => {
    const id = nextId.current++;
    setItems((list) => [{ id, title: `${s.panel} ${id}` }, ...list]);
  };

  return (
    <DemoCard title={s.title} description={s.description}>
      <div style={frame}>
        <ScrollContainer
          ref={sc}
          direction="horizontal"
          panelWidth={0.86}
          gap={10}
          onIndexChange={setIndex}
          data-testid="cmp-canvas"
          aria-label={s.title}
          style={{ height: 320, borderRadius: 10, background: '#f3f4f6' }}
        >
          {items.map((item) => (
            <ScrollPanel
              key={item.id}
              label={item.title}
              data-cmp-panel={item.id}
              style={{
                overflowY: 'auto',
                touchAction: 'pan-y',
                background: '#fff',
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  padding: '12px 14px',
                  color: '#fff',
                  fontWeight: 800,
                  background: COLORS[item.id % COLORS.length],
                }}
              >
                {item.title}
              </div>
              {ROWS.map((n) => (
                <div key={n} style={{ padding: '12px 14px', borderBottom: '1px solid #eee' }}>
                  {item.title} · {n}
                </div>
              ))}
            </ScrollPanel>
          ))}
        </ScrollContainer>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <DataRow label="componentIndex" value={String(index)} />
        <DataRow label="componentPanels" value={String(items.length)} />
      </div>

      <div style={buttons}>
        <button type="button" data-testid="cmp-add-first" onClick={add} style={btn}>
          {s.addFirst}
        </button>
        <button
          type="button"
          data-testid="cmp-remove-last"
          disabled={items.length <= 1}
          onClick={() => setItems((list) => list.slice(0, -1))}
          style={btn}
        >
          {s.removeLast}
        </button>
        <button
          type="button"
          data-testid="cmp-next"
          onClick={() => sc.current?.scrollTo(index + 1)}
          style={btn}
        >
          scrollTo(+1)
        </button>
      </div>
    </DemoCard>
  );
}

const frame: React.CSSProperties = { maxWidth: 420, margin: '0 auto' };
const buttons: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' };
const btn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
};
