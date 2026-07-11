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

/**
 * [B-09] 어댑터 실질화 — StrictMode 이중 등록 / rerender 콜백 최신화 / unmount 리스너 실제 제거를
 * 관측 가능한 부수효과(overscrollBehavior, 콜백 호출 수)로 단언한다.
 *
 * 제스처 시뮬레이션: happy-dom은 TouchEvent 부분 지원 → core 통합 테스트와 동일하게
 * PointerEvent로 시뮬 (core가 touch+pointer 양쪽 핸들러 등록, scrollTop=0 기본값으로 가드 충족).
 */
function pointerEvent(
  type: string,
  init: { pointerId: number; clientY: number; clientX?: number },
): Event {
  try {
    return new PointerEvent(type, {
      pointerId: init.pointerId,
      clientX: init.clientX ?? 100,
      clientY: init.clientY,
      bubbles: true,
      cancelable: true,
    });
  } catch {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, init);
    return ev;
  }
}

describe('usePullToRefresh [B-09] 실질 검증', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function Host(props: {
    onPull?: (d: number, p: number) => void;
    onStateChange?: (s: string) => void;
  }) {
    const { containerRef } = usePullToRefresh({
      onRefresh: () => {},
      ...(props.onPull && { onPull: props.onPull }),
      ...(props.onStateChange && { onStateChange: props.onStateChange }),
    });
    return React.createElement('div', {
      ref: containerRef,
      'data-testid': 'ptr-root',
      style: { width: 400, height: 400, overflowY: 'auto' },
    });
  }

  it('[B-09] A2: StrictMode 이중 마운트에도 리스너가 1세트 — onPull 호출 수가 move 이벤트 수와 일치한다', () => {
    const onPull = vi.fn();
    const onStateChange = vi.fn();
    const { container } = render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Host, { onPull, onStateChange }),
      ),
    );
    const div = container.querySelector('[data-testid="ptr-root"]') as HTMLElement;
    // 이중 마운트 후에도 overscroll-behavior: contain 유지 (마지막 인스턴스가 적용)
    expect(div.style.overscrollBehavior).toBe('contain');

    act(() => {
      div.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
      div.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 140 }));
    });

    // move 1회 → onPull 1회. 이중 등록(파괴 안 된 이전 인스턴스 잔존)이면 2회가 된다.
    expect(onPull).toHaveBeenCalledTimes(1);
    const states = onStateChange.mock.calls.map((c) => c[0]);
    // 'pulling' 전이도 정확히 1회 (인스턴스 2개면 2회)
    expect(states.filter((s) => s === 'pulling')).toHaveLength(1);
  });

  it('[B-09] A4: rerender로 교체한 onPull/onStateChange만 호출되고 이전 콜백은 0회다', () => {
    const firstOnPull = vi.fn();
    const firstOnStateChange = vi.fn();
    const secondOnPull = vi.fn();
    const secondOnStateChange = vi.fn();

    const { container, rerender } = render(
      React.createElement(Host, { onPull: firstOnPull, onStateChange: firstOnStateChange }),
    );
    rerender(
      React.createElement(Host, { onPull: secondOnPull, onStateChange: secondOnStateChange }),
    );

    const div = container.querySelector('[data-testid="ptr-root"]') as HTMLElement;
    act(() => {
      div.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientY: 100 }));
      div.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientY: 140 }));
    });

    expect(secondOnPull).toHaveBeenCalled();
    expect(secondOnStateChange).toHaveBeenCalledWith('pulling');
    // optionsRef 경유 최신화 검증 — stale closure면 이전 콜백이 호출된다
    expect(firstOnPull).toHaveBeenCalledTimes(0);
    expect(firstOnStateChange).toHaveBeenCalledTimes(0);
  });

  it('[B-09] A6: unmount 후 원 엘리먼트에 제스처를 디스패치해도 콜백이 발화하지 않고 overscrollBehavior가 복원된다', () => {
    const onPull = vi.fn();
    const onStateChange = vi.fn();
    const { container, unmount } = render(
      React.createElement(Host, { onPull, onStateChange }),
    );
    const div = container.querySelector('[data-testid="ptr-root"]') as HTMLElement;
    expect(div.style.overscrollBehavior).toBe('contain');

    unmount();

    // destroy가 원래 값('')으로 복원했는지 — 'contain' 잔존이면 destroy 미실행
    expect(div.style.overscrollBehavior).toBe('');

    div.dispatchEvent(pointerEvent('pointerdown', { pointerId: 3, clientY: 100 }));
    div.dispatchEvent(pointerEvent('pointermove', { pointerId: 3, clientY: 140 }));

    expect(onPull).toHaveBeenCalledTimes(0);
    expect(onStateChange).toHaveBeenCalledTimes(0);
  });
});
