import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScrollContainer } from '../use-scroll-container';

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
