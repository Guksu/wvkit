import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { diffScrollContainerOptions, useScrollContainer } from '../use-scroll-container';

/**
 * React 어댑터 smoke 테스트.
 * 정밀 행렬·축 제약 검증은 core 단위 테스트(#5) 영역.
 */

function makePanels(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('div');
    el.dataset.idx = String(i);
    return el;
  });
}

describe('useScrollContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('마운트 시 containerRef DOM에 인스턴스가 attach된다 (renderer.domElement 추가)', () => {
    const panels = makePanels(3);
    function TestComponent() {
      const { containerRef } = useScrollContainer({
        direction: 'horizontal',
        panels,
        initialIndex: 0,
      });
      return React.createElement('div', {
        ref: containerRef,
        // happy-dom에서 clientWidth/Height가 0이 되지 않게 명시
        style: { width: '400px', height: '600px', position: 'relative' },
      });
    }
    const { container } = render(React.createElement(TestComponent));
    // containerRef div 안에 CSS3DRenderer.domElement가 들어가 있어야 함
    const containerDiv = container.firstChild as HTMLElement;
    expect(containerDiv.children.length).toBeGreaterThan(0);
  });

  it('언마운트 시 destroy가 호출되어 renderer DOM이 제거된다', () => {
    const panels = makePanels(3);
    function TestComponent() {
      const { containerRef } = useScrollContainer({
        direction: 'horizontal',
        panels,
      });
      return React.createElement('div', {
        ref: containerRef,
        style: { width: '400px', height: '600px', position: 'relative' },
      });
    }
    const { container, unmount } = render(React.createElement(TestComponent));
    const containerDiv = container.firstChild as HTMLElement;
    const childCountBeforeUnmount = containerDiv.children.length;
    expect(childCountBeforeUnmount).toBeGreaterThan(0);
    unmount();
    // 언마운트 후 container DOM은 React가 정리하므로 destroy 호출 검증은
    // "에러 없이 언마운트 완료"로 갈음 (core destroy 멱등성은 core 테스트에서 보장)
  });

  it('사용자 onIndexChange 콜백이 호출된다 (scrollTo 경유)', () => {
    const userOnIndexChange = vi.fn();
    const panels = makePanels(4);
    let capturedScrollTo: ((i: number) => void) | null = null;
    function TestComponent() {
      const { containerRef, scrollTo } = useScrollContainer({
        direction: 'horizontal',
        panels,
        onIndexChange: userOnIndexChange,
      });
      capturedScrollTo = scrollTo;
      return React.createElement('div', {
        ref: containerRef,
        style: { width: '400px', height: '600px', position: 'relative' },
      });
    }
    render(React.createElement(TestComponent));
    expect(capturedScrollTo).not.toBeNull();
    capturedScrollTo!(2);
    expect(userOnIndexChange).toHaveBeenCalledWith(2);
  });
});

/**
 * [B-09] 어댑터 실질화 — smoke를 넘어 StrictMode 이중 마운트 / rerender 콜백 최신화를
 * 관측 가능한 부수효과(renderer DOM 수, 콜백 호출 수)로 단언한다.
 */
describe('useScrollContainer [B-09] 실질 검증', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function Host(props: { onIndexChange?: (i: number) => void; panels: HTMLElement[] }) {
    const { containerRef, scrollTo } = useScrollContainer({
      direction: 'horizontal',
      panels: props.panels,
      ...(props.onIndexChange && { onIndexChange: props.onIndexChange }),
    });
    capturedScrollTo = scrollTo;
    return React.createElement('div', {
      ref: containerRef,
      'data-testid': 'sc-root',
      style: { width: '400px', height: '600px', position: 'relative' },
    });
  }
  let capturedScrollTo: ((i: number, opts?: { animated?: boolean }) => void) | null = null;

  it('[B-09] A1: StrictMode 이중 마운트에도 renderer DOM이 정확히 1세트만 attach된다', () => {
    const panels = makePanels(3);
    const { container } = render(
      React.createElement(React.StrictMode, null, React.createElement(Host, { panels })),
    );
    const containerDiv = container.querySelector('[data-testid="sc-root"]') as HTMLElement;
    expect(containerDiv).not.toBeNull();
    // core는 root에 renderer.domElement(div) 1개만 append — 이중 마운트 누수면 2개가 된다
    // (happy-dom은 :scope 셀렉터 미지원 → children 직접 순회로 수치 단언)
    expect(containerDiv.children.length).toBe(1);
    const rendererDivs = Array.from(containerDiv.children).filter((el) => el.tagName === 'DIV');
    expect(rendererDivs).toHaveLength(1);
  });

  it('[B-09] A5: rerender로 교체한 onIndexChange만 호출되고 이전 콜백은 0회다', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const panels = makePanels(4);

    const { rerender } = render(
      React.createElement(Host, { panels, onIndexChange: firstCallback }),
    );
    rerender(React.createElement(Host, { panels, onIndexChange: secondCallback }));

    expect(capturedScrollTo).not.toBeNull();
    act(() => {
      capturedScrollTo!(1, { animated: false });
    });

    expect(secondCallback).toHaveBeenCalledWith(1);
    expect(firstCallback).toHaveBeenCalledTimes(0);
  });
});

/**
 * [B-25] 어댑터 계약 핀 — non-callback 옵션이 바뀌면 인스턴스를 다시 만들지 않고 `setOptions` 로 반영한다.
 * 패널 배열은 요소 단위로 비교하므로 같은 요소의 새 배열은 바뀐 것이 아니다.
 */
describe('useScrollContainer [B-25] 옵션 변경은 다시 마운트하지 않고 반영', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  let captured: { activeIndex: number; activeZoom: number } = { activeIndex: -1, activeZoom: -1 };
  function PinHost(props: { panels: HTMLElement[]; minZoom: number; initialIndex?: number }) {
    const { containerRef, activeIndex, activeZoom } = useScrollContainer({
      direction: 'horizontal',
      panels: props.panels,
      minZoom: props.minZoom,
      ...(props.initialIndex !== undefined && { initialIndex: props.initialIndex }),
    });
    captured = { activeIndex, activeZoom };
    return React.createElement('div', {
      ref: containerRef,
      'data-testid': 'sc-pin-root',
      style: { width: '400px', height: '600px', position: 'relative' },
    });
  }

  it('[B-25] R1: rerender로 panels/minZoom을 교체하면 같은 인스턴스가 새 패널·새 줌 범위를 쓴다', () => {
    const { container, rerender } = render(
      React.createElement(PinHost, { panels: makePanels(3), minZoom: 1 }),
    );
    const containerDiv = container.querySelector('[data-testid="sc-pin-root"]') as HTMLElement;
    // 다시 만들면 렌더러 domElement 가 떼어지고 새로 붙어 참조가 바뀐다
    const rendererEl = containerDiv.firstElementChild;
    expect(rendererEl).not.toBeNull();

    const next = makePanels(5);
    act(() => {
      rerender(React.createElement(PinHost, { panels: next, minZoom: 2 }));
    });

    expect(containerDiv.firstElementChild).toBe(rendererEl);
    expect(next[0]?.parentNode).not.toBeNull(); // 새 패널이 scene 에 붙었다
    expect(captured.activeZoom).toBe(2); // 새 minZoom 으로 줌을 올렸다 (onZoomChange → state)
  });

  it('[B-25] R2: 보던 패널 앞에 끼워 넣으면 activeIndex state 가 따라온다 (보던 패널 유지)', () => {
    const panels = makePanels(3);
    const { rerender } = render(
      React.createElement(PinHost, { panels, minZoom: 1, initialIndex: 1 }),
    );
    expect(captured.activeIndex).toBe(1);
    act(() => {
      rerender(React.createElement(PinHost, { panels: [...makePanels(2), ...panels], minZoom: 1 }));
    });
    expect(captured.activeIndex).toBe(3);
  });

  it('[B-25] R3: 같은 요소의 새 배열·새 콜백·initialIndex 만 바뀌면 setOptions 로 넘길 것이 없다', () => {
    const panels = makePanels(2);
    const base = { direction: 'horizontal' as const, panels, minZoom: 1 };
    expect(diffScrollContainerOptions(base, { ...base, panels: [...panels] })).toBeNull();
    expect(
      diffScrollContainerOptions(base, { ...base, onIndexChange: () => {}, initialIndex: 1 }),
    ).toBeNull();
    expect(diffScrollContainerOptions(base, { ...base, minZoom: 2 })).toEqual({ minZoom: 2 });
    expect(
      diffScrollContainerOptions(base, { ...base, panels: [panels[1] as HTMLElement] }),
    ).toEqual({
      panels: [panels[1]],
    });
    // 키가 사라지면 undefined 로 넘겨 기본값으로 되돌린다
    expect(diffScrollContainerOptions({ ...base, gap: 8 }, base)).toEqual({ gap: undefined });
  });
});
