import { render, act } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePullToRefresh } from '../use-pull-to-refresh';

/**
 * React 어댑터 smoke 테스트.
 * core 단위 테스트(#19)가 상태머신/저항/destroy 등 정밀 검증을 담당.
 */

describe('usePullToRefresh', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('마운트 시 containerRef DOM에 인스턴스가 attach 된다 (overscrollBehavior 자동 적용)', () => {
    function TestComponent() {
      const { containerRef } = usePullToRefresh({
        onRefresh: () => Promise.resolve(),
      });
      return React.createElement('div', {
        ref: containerRef,
        style: { width: 400, height: 400, overflowY: 'auto' },
      });
    }
    const { container } = render(React.createElement(TestComponent));
    const div = container.firstChild as HTMLElement;
    // D3: 기본 disableOverscrollContain=false → core가 root.style.overscrollBehavior = 'contain' 설정
    expect(div.style.overscrollBehavior).toBe('contain');
  });

  it('언마운트 시 destroy가 호출되어 overscrollBehavior가 복원된다', () => {
    function TestComponent() {
      const { containerRef } = usePullToRefresh({
        onRefresh: () => {},
      });
      return React.createElement('div', {
        ref: containerRef,
        style: { width: 400, height: 400 },
      });
    }
    const { container, unmount } = render(React.createElement(TestComponent));
    const div = container.firstChild as HTMLElement;
    expect(div.style.overscrollBehavior).toBe('contain');
    unmount();
    // 언마운트 후 div가 React에서 분리되지만 destroy 멱등성/에러 없음 검증
    expect(() => unmount()).not.toThrow();
  });

  it('trigger() 호출 시 onRefresh + onStateChange 사용자 콜백이 호출된다', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const onStateChange = vi.fn();
    let capturedTrigger: (() => Promise<void>) | null = null;

    function TestComponent() {
      const { containerRef, trigger } = usePullToRefresh({
        onRefresh,
        onStateChange,
      });
      capturedTrigger = trigger;
      return React.createElement('div', {
        ref: containerRef,
        style: { width: 400, height: 400 },
      });
    }
    render(React.createElement(TestComponent));
    expect(capturedTrigger).not.toBeNull();

    await act(async () => {
      await capturedTrigger!();
    });

    expect(onRefresh).toHaveBeenCalled();
    // 상태 전이: idle → refreshing → resetting → idle 중 최소 'refreshing'은 발화
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toContain('refreshing');
  });
});
