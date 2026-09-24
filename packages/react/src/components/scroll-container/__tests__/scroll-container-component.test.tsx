import { act, render } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ScrollContainer,
  type ScrollContainerHandle,
  type ScrollContainerProps,
  ScrollPanel,
} from '../scroll-container-component';

/**
 * 컴포넌트 API — <ScrollContainer> + <ScrollPanel>.
 * happy-dom 은 레이아웃이 없어 host 폭이 0 → core 는 1px 로 본다. 패널 i 의 중심 x = i (gap 0) 로 순서를 읽는다.
 */

const h = React.createElement;

/** data-testid 등 data-* 속성은 createElement 의 props 타입에 없어 캐스트로 넘긴다 (JSX 에서는 허용된다) */
function sc(
  props: Record<string, unknown> & { ref?: React.Ref<ScrollContainerHandle> },
  ...children: React.ReactNode[]
) {
  return h(ScrollContainer, props as unknown as ScrollContainerProps, ...children);
}

/** host > [숨은 표시 상자, core 렌더러] — 렌더러 > scene > 패널들 */
function sceneOf(host: HTMLElement): HTMLElement | null {
  const renderer = Array.from(host.children).find((c) => !(c as HTMLElement).hidden) as
    | HTMLElement
    | undefined;
  return (renderer?.firstElementChild as HTMLElement | null | undefined) ?? null;
}

/** scene 안 패널들을 x 좌표 순으로 — 각 패널의 텍스트 */
function panelTexts(host: HTMLElement): string[] {
  const scene = sceneOf(host);
  if (!scene) return [];
  return Array.from(scene.children)
    .map((p) => ({
      x: Number(
        /translate\((-?[\d.]+)px/.exec((p as HTMLElement).style.transform)?.[1] ?? Number.NaN,
      ),
      text: p.textContent ?? '',
    }))
    .sort((a, b) => a.x - b.x)
    .map((p) => p.text);
}

function Pager(props: {
  items: string[];
  gap?: number;
  initialIndex?: number;
  onIndexChange?: (i: number) => void;
  handle?: React.Ref<ScrollContainerHandle>;
  overscan?: number;
}) {
  return sc(
    {
      direction: 'horizontal',
      'data-testid': 'host',
      className: 'pager',
      overscan: props.overscan ?? 10,
      ...(props.gap !== undefined && { gap: props.gap }),
      ...(props.initialIndex !== undefined && { initialIndex: props.initialIndex }),
      ...(props.onIndexChange && { onIndexChange: props.onIndexChange }),
      ...(props.handle && { ref: props.handle }),
    },
    props.items.map((t) => h(ScrollPanel, { key: t }, h('p', null, t))),
  );
}

describe('ScrollContainer · ScrollPanel (React 컴포넌트)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('C1: 자식 순서대로 패널을 만들고 내용은 core scene 안의 패널 요소에 그린다 · host 속성·스타일', () => {
    const { getByTestId } = render(h(Pager, { items: ['a', 'b', 'c'] }));
    const host = getByTestId('host');
    expect(host.className).toBe('pager');
    expect(host.style.position).toBe('relative');
    expect(host.style.touchAction).toBe('none');
    expect(panelTexts(host)).toEqual(['a', 'b', 'c']);
  });

  it('C2: 보던 패널 앞에 끼워 넣으면 onIndexChange(새 번호) · 다시 마운트 없음', () => {
    const onIndexChange = vi.fn();
    const { getByTestId, rerender } = render(
      h(Pager, { items: ['a', 'b', 'c'], initialIndex: 1, onIndexChange }),
    );
    const host = getByTestId('host');
    const renderer = sceneOf(host)?.parentElement;
    act(() => {
      rerender(h(Pager, { items: ['new', 'a', 'b', 'c'], initialIndex: 1, onIndexChange }));
    });
    expect(panelTexts(host)).toEqual(['new', 'a', 'b', 'c']);
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(sceneOf(host)?.parentElement).toBe(renderer);
  });

  it('C3: 감싼 컴포넌트·Fragment·조건부 렌더가 있어도 화면에 쓴 순서를 따른다', () => {
    function Wrapped(props: { t: string }) {
      return h(React.Fragment, null, h(ScrollPanel, null, h('p', null, props.t)));
    }
    function App(props: { showB: boolean }) {
      return sc(
        { direction: 'horizontal', 'data-testid': 'host', overscan: 10 },
        h(ScrollPanel, null, h('p', null, 'a')),
        props.showB ? h(Wrapped, { t: 'b' }) : null,
        h(React.Fragment, null, h(ScrollPanel, null, h('p', null, 'c'))),
      );
    }
    const { getByTestId, rerender } = render(h(App, { showB: false }));
    const host = getByTestId('host');
    expect(panelTexts(host)).toEqual(['a', 'c']);
    act(() => {
      rerender(h(App, { showB: true }));
    });
    expect(panelTexts(host)).toEqual(['a', 'b', 'c']);
  });

  it('C4: 옵션 prop 을 바꾸면 같은 인스턴스가 반영한다 (gap)', () => {
    const { getByTestId, rerender } = render(h(Pager, { items: ['a', 'b'], gap: 0 }));
    const host = getByTestId('host');
    const second = () =>
      Array.from(sceneOf(host)?.children ?? []).find((p) => p.textContent === 'b') as HTMLElement;
    expect(second().style.transform).toContain('translate(1px, 0px)');
    act(() => {
      rerender(h(Pager, { items: ['a', 'b'], gap: 10 }));
    });
    expect(second().style.transform).toContain('translate(11px, 0px)');
  });

  it('C5: 패널이 모두 없어지면 렌더러를 거두고, 다시 생기면 만든다', () => {
    const { getByTestId, rerender } = render(h(Pager, { items: ['a'] }));
    const host = getByTestId('host');
    expect(sceneOf(host)).not.toBeNull();
    act(() => {
      rerender(h(Pager, { items: [] }));
    });
    expect(sceneOf(host)).toBeNull();
    act(() => {
      rerender(h(Pager, { items: ['z'] }));
    });
    expect(panelTexts(host)).toEqual(['z']);
  });

  it('C6: ref 핸들로 scrollTo · getActiveIndex', () => {
    const onIndexChange = vi.fn();
    const ref = React.createRef<ScrollContainerHandle>();
    render(h(Pager, { items: ['a', 'b', 'c'], onIndexChange, handle: ref }));
    act(() => {
      ref.current?.scrollTo(2, { animated: false });
    });
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(ref.current?.getActiveIndex()).toBe(2);
    expect(ref.current?.getZoom()).toBe(1);
  });

  it('C7: label 은 패널 요소의 aria-label — 없으면 a11y 의 "n / N"', () => {
    const { getByTestId } = render(
      sc(
        { direction: 'horizontal', 'data-testid': 'host', overscan: 10 },
        h(ScrollPanel, { label: '추천' }, 'a'),
        h(ScrollPanel, null, 'b'),
      ),
    );
    const panels = Array.from(sceneOf(getByTestId('host'))?.children ?? []);
    const byText = (t: string) => panels.find((p) => p.textContent === t);
    expect(byText('a')?.getAttribute('aria-label')).toBe('추천');
    expect(byText('b')?.getAttribute('aria-label')).toBe('2 / 2');
  });

  it('C8: 세로 페이저 + panelHeight 면 패널 요소 높이를 px 로 맞춘다', () => {
    const { getByTestId } = render(
      sc(
        {
          direction: 'vertical',
          panelHeight: (i: number) => 200 + i * 100,
          'data-testid': 'host',
          overscan: 10,
        },
        h(ScrollPanel, null, 'a'),
        h(ScrollPanel, null, 'b'),
      ),
    );
    const panels = Array.from(sceneOf(getByTestId('host'))?.children ?? []) as HTMLElement[];
    const heights = panels
      .sort((x, y) => (x.textContent ?? '').localeCompare(y.textContent ?? ''))
      .map((p) => p.style.height);
    expect(heights).toEqual(['200px', '300px']);
  });

  it('C9: StrictMode 에서도 렌더러는 하나, 패널은 자식 수만큼', () => {
    const { getByTestId } = render(h(React.StrictMode, null, h(Pager, { items: ['a', 'b', 'c'] })));
    const host = getByTestId('host');
    expect(host.children.length).toBe(2); // 숨은 표시 상자 + 렌더러
    expect(panelTexts(host)).toEqual(['a', 'b', 'c']);
  });

  it('C10: SSR — 서버 렌더는 오류 없이 host 와 표시 요소만 (패널 내용은 브라우저에서)', () => {
    const html = renderToString(h(Pager, { items: ['a', 'b'] }));
    expect(html).toContain('data-testid="host"');
    expect(html).toContain('data-scroll-panel');
    expect(html).not.toContain('<p>a</p>');
  });

  it('C11: 언마운트하면 인스턴스를 정리한다 (host 에 core 렌더러가 남지 않음)', () => {
    const { getByTestId, unmount } = render(h(Pager, { items: ['a', 'b'] }));
    const host = getByTestId('host');
    expect(sceneOf(host)).not.toBeNull();
    unmount();
    // React 는 떼어 낸 host 의 자기 자식(숨은 표시 상자)은 비우지 않는다 — core 렌더러만 없어졌는지 본다
    expect(sceneOf(host)).toBeNull();
    expect(host.children.length).toBe(1);
  });

  it('C12: label 을 나중에 거두면 우리가 붙인 것만 지운다', () => {
    function App(props: { label?: string }) {
      return sc(
        { direction: 'horizontal', 'data-testid': 'host', overscan: 10 },
        h(ScrollPanel, props.label === undefined ? null : { label: props.label }, 'a'),
      );
    }
    const { getByTestId, rerender } = render(h(App, { label: '추천' }));
    const panel = () => sceneOf(getByTestId('host'))?.firstElementChild;
    expect(panel()?.getAttribute('aria-label')).toBe('추천');
    act(() => {
      rerender(h(App, {}));
    });
    expect(panel()?.hasAttribute('aria-label')).toBe(false);
  });
});
